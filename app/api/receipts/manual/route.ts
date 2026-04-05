import { NextResponse } from "next/server";
import { z } from "zod";

import { createCashMethodTransaction } from "@/lib/accounting/posting";
import { asNumber, round2 } from "@/lib/accounting/math";
import { ensureBusiness } from "@/lib/data/business";
import { supportsReceiptItemPurchasedField } from "@/lib/data/receiptItemSupport";
import { prisma } from "@/lib/db";
import { EntrySources, TransactionDirections } from "@/lib/domain/enums";
import { convertToSekAtDate, normalizeCurrency } from "@/lib/fx/sek";
import { accountCodeForCategory, normalizeReceiptCategory } from "@/lib/receipts/mapper";

const manualReceiptSchema = z.object({
  receiptNumber: z.string().trim().max(120).optional(),
  vendor: z.string().trim().max(120).optional(),
  description: z.string().trim().max(200).optional(),
  receiptDate: z.string().min(10),
  grossAmount: z.number().positive(),
  vatRate: z.number().min(0).max(1).default(0.25),
  currency: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/).default("SEK"),
  category: z.string().trim().min(1).max(64).default("other")
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const business = await ensureBusiness();
  const canUseItemPurchased = await supportsReceiptItemPurchasedField();
  const payload = manualReceiptSchema.parse(await request.json());

  const txnDate = new Date(`${payload.receiptDate}T00:00:00.000Z`);
  if (Number.isNaN(txnDate.valueOf())) {
    return NextResponse.json({ error: "Invalid receipt date." }, { status: 400 });
  }

  const normalizedCategory = normalizeReceiptCategory(payload.category);
  const category = normalizedCategory === "sales" ? "other" : normalizedCategory;
  const direction = TransactionDirections.EXPENSE;
  const description =
    payload.description?.trim() || payload.vendor?.trim() || `Manual receipt ${payload.receiptDate}`;
  const itemPurchased = payload.description?.trim() || null;
  const netAmountInput = round2(payload.grossAmount / (1 + payload.vatRate));
  const vatAmountInput = round2(payload.grossAmount - netAmountInput);
  const sourceCurrency = normalizeCurrency(payload.currency);
  let converted: Awaited<ReturnType<typeof convertToSekAtDate>>;
  try {
    converted = await convertToSekAtDate({
      currency: sourceCurrency,
      date: payload.receiptDate,
      grossAmount: payload.grossAmount,
      netAmount: netAmountInput,
      vatAmount: vatAmountInput
    });
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
  const postingGrossAmount = converted.grossAmountSek;
  const postingNetAmount = converted.netAmountSek ?? netAmountInput;
  const postingVatAmount = converted.vatAmountSek ?? vatAmountInput;
  const postingCurrency = converted.currency;
  const postingSourceCurrency = converted.sourceCurrency;
  const fxRateToSek = converted.fxRateToSek;
  const fxRateDate = converted.fxDate;
  const receiptCurrency = sourceCurrency;
  const receiptSourceCurrency = sourceCurrency === "SEK" ? null : sourceCurrency;

  const receipt = await prisma.receipt.create({
    data: {
      businessId: business.id,
      source: "manual",
      originalFileName: `manual-${payload.receiptDate}.txt`,
      mimeType: "text/manual",
      filePath: `manual://${Date.now()}`,
      receiptNumber: payload.receiptNumber?.trim() || undefined,
      vendor: payload.vendor?.trim() || undefined,
      ...(canUseItemPurchased && itemPurchased ? { itemPurchased } : {}),
      receiptDate: txnDate,
      grossAmount: payload.grossAmount,
      netAmount: netAmountInput,
      vatAmount: vatAmountInput,
      currency: receiptCurrency,
      sourceCurrency: receiptSourceCurrency ?? undefined,
      fxRateToSek: fxRateToSek ?? undefined,
      fxRateDate: fxRateDate ?? undefined,
      vatRate: payload.vatRate,
      category,
      confidence: 1,
      needsReview: false
    }
  });

  const transaction = await createCashMethodTransaction({
    businessId: business.id,
    txnDate,
    description,
    direction,
    grossAmount: postingGrossAmount,
    vatRate: payload.vatRate,
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
    reference: payload.receiptNumber?.trim() || undefined
  });

  return NextResponse.json({
    receipt: {
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      vendor: receipt.vendor,
      grossAmount: receipt.grossAmount ? asNumber(receipt.grossAmount as unknown as number | string) : null,
      currency: receipt.currency,
      needsReview: receipt.needsReview
    },
    transaction: {
      id: transaction.id
    }
  });
}
