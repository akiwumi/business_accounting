import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { createCashMethodTransaction } from "@/lib/accounting/posting";
import { asNumber, round2 } from "@/lib/accounting/math";
import { ensureBusiness } from "@/lib/data/business";
import { supportsReceiptItemPurchasedField } from "@/lib/data/receiptItemSupport";
import { prisma } from "@/lib/db";
import { EntrySources, TransactionDirections } from "@/lib/domain/enums";
import { convertToSekAtDate, normalizeCurrency } from "@/lib/fx/sek";
import { extractReceiptData } from "@/lib/receipts/extract";
import { accountCodeForCategory, normalizeReceiptCategory } from "@/lib/receipts/mapper";
import { inferReceiptMimeType } from "@/lib/receipts/mime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uploadDir = join(process.cwd(), "uploads", "receipts");
const round4 = (value: number) => Math.round(value * 10000) / 10000;

const sanitizeFileName = (fileName: string): string => fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

export async function POST(request: Request) {
  try {
    const business = await ensureBusiness();
    const canUseItemPurchased = await supportsReceiptItemPurchasedField();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file upload." }, { status: 400 });
    }

    const effectiveMimeType = inferReceiptMimeType(file.name, file.type);
    const buffer = Buffer.from(await file.arrayBuffer());
    await mkdir(uploadDir, { recursive: true });

    const fileName = `${Date.now()}-${randomUUID()}-${sanitizeFileName(file.name)}`;
    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    const extracted = await extractReceiptData({
      fileName: file.name,
      mimeType: effectiveMimeType,
      buffer
    });

  let grossAmount = extracted.grossAmount !== undefined ? round2(asNumber(extracted.grossAmount)) : undefined;
  const receiptDate = extracted.issueDate ?? extracted.receiptDate;
  const vatRateDefault = business.taxConfig ? asNumber(business.taxConfig.vatStandardRate as unknown as number | string) : 0.25;
  const vatAmountFromExtract = extracted.vatAmount !== undefined ? round2(asNumber(extracted.vatAmount)) : undefined;
  const netAmountFromExtract = extracted.netAmount !== undefined ? round2(asNumber(extracted.netAmount)) : undefined;
  let vatRate =
    extracted.vatRate !== undefined && extracted.vatRate !== null
      ? asNumber(extracted.vatRate)
      : undefined;

  let vatAmount = vatAmountFromExtract;
  let netAmount = netAmountFromExtract;

  if (grossAmount !== undefined && vatAmount !== undefined && vatRate === undefined) {
    const base = grossAmount - vatAmount;
    if (base > 0) vatRate = round4(vatAmount / base);
  }

  const vatRateForPosting = vatRate ?? vatRateDefault;
  if (grossAmount !== undefined && vatAmount === undefined) {
    netAmount = round2(grossAmount / (1 + vatRateForPosting));
    vatAmount = round2(grossAmount - netAmount);
  } else if (grossAmount !== undefined && vatAmount !== undefined && netAmount === undefined) {
    netAmount = round2(grossAmount - vatAmount);
  }

  const sourceCurrency = normalizeCurrency(extracted.currency ?? "SEK");
  const receiptCurrency = sourceCurrency;
  const receiptSourceCurrency = sourceCurrency === "SEK" ? null : sourceCurrency;
  let postingGrossAmount = grossAmount;
  let postingNetAmount = netAmount;
  let postingVatAmount = vatAmount;
  let postingCurrency = "SEK";
  let postingSourceCurrency: string | null = null;
  let fxRateToSek: number | null = null;
  let fxRateDate: Date | null = null;

  if (grossAmount !== undefined) {
    try {
      const converted = await convertToSekAtDate({
        currency: sourceCurrency,
        date: receiptDate ?? new Date(),
        grossAmount,
        netAmount,
        vatAmount
      });
      postingGrossAmount = converted.grossAmountSek;
      postingNetAmount = converted.netAmountSek;
      postingVatAmount = converted.vatAmountSek;
      postingCurrency = converted.currency;
      postingSourceCurrency = converted.sourceCurrency;
      fxRateToSek = converted.fxRateToSek;
      fxRateDate = converted.fxDate;
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Could not convert receipt currency to SEK."
        },
        { status: 400 }
      );
    }
  }

  const normalizedCategory = normalizeReceiptCategory(extracted.category);
  const category = normalizedCategory === "sales" ? "other" : normalizedCategory;
  const rawItemPurchased = extracted.description?.trim();
  const itemPurchased =
    rawItemPurchased && !/^receipt from\s+/i.test(rawItemPurchased) && !/^imported from\s+/i.test(rawItemPurchased)
      ? rawItemPurchased
      : null;

    const receipt = await prisma.receipt.create({
      data: {
        businessId: business.id,
        source: "upload",
        originalFileName: file.name,
        mimeType: effectiveMimeType,
        filePath,
        receiptNumber: extracted.receiptNumber,
        vendor: extracted.vendor,
        ...(canUseItemPurchased && itemPurchased ? { itemPurchased } : {}),
        receiptDate: receiptDate ? new Date(`${receiptDate}T00:00:00.000Z`) : undefined,
        grossAmount,
        netAmount,
        vatAmount,
        currency: receiptCurrency,
        sourceCurrency: receiptSourceCurrency ?? undefined,
        fxRateToSek: fxRateToSek ?? undefined,
        fxRateDate: fxRateDate ?? undefined,
        vatRate: vatRateForPosting,
        category,
        confidence: extracted.confidence,
        needsReview: extracted.needsReview
      }
    });

    let transaction = null;
    if (postingGrossAmount !== undefined && postingGrossAmount > 0) {
      const direction = TransactionDirections.EXPENSE;

      transaction = await createCashMethodTransaction({
        businessId: business.id,
        txnDate: receiptDate ? new Date(`${receiptDate}T00:00:00.000Z`) : new Date(),
        description: itemPurchased ?? extracted.description ?? extracted.vendor ?? extracted.receiptNumber ?? file.name,
        direction,
        grossAmount: postingGrossAmount,
        vatRate: vatRateForPosting,
        netAmount: postingNetAmount,
        vatAmount: postingVatAmount,
        source: EntrySources.RECEIPT,
        receiptId: receipt.id,
        currency: postingCurrency,
        sourceCurrency: postingSourceCurrency ?? undefined,
        fxRateToSek: fxRateToSek ?? undefined,
        fxRateDate: fxRateDate ?? undefined,
        incomeAccountCode: "3001",
        expenseAccountCode: accountCodeForCategory(category, direction),
        reference: extracted.receiptNumber
      });
    }

    return NextResponse.json({
      receipt,
      transaction,
      extracted
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Receipt upload failed."
      },
      { status: 500 }
    );
  }
}
