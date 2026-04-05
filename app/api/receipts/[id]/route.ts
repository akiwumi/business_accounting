import { NextResponse } from "next/server";
import { z } from "zod";

import { asNumber, round2 } from "@/lib/accounting/math";
import { supportsReceiptItemPurchasedField } from "@/lib/data/receiptItemSupport";
import { prisma } from "@/lib/db";
import { EntrySources, TransactionDirections, type TransactionDirection } from "@/lib/domain/enums";
import { convertToSekAtDate, normalizeCurrency } from "@/lib/fx/sek";
import { accountCodeForCategory, normalizeReceiptCategory } from "@/lib/receipts/mapper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const round4 = (value: number) => Math.round(value * 10000) / 10000;

type RouteContext = {
  params: {
    id: string;
  };
};

const patchSchema = z.object({
  needsReview: z.boolean().optional(),
  receiptNumber: z.string().trim().max(120).nullable().optional(),
  vendor: z.string().trim().max(120).nullable().optional(),
  itemPurchased: z.string().trim().max(200).nullable().optional(),
  source: z.string().trim().max(32).nullable().optional(),
  originalFileName: z.string().trim().max(255).nullable().optional(),
  mimeType: z.string().trim().max(120).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  createdDate: z.string().nullable().optional(),
  receiptDate: z.string().nullable().optional(),
  category: z.string().trim().max(64).nullable().optional(),
  vatRate: z.number().min(0).max(1).nullable().optional(),
  vatAmount: z.number().min(0).nullable().optional(),
  grossAmount: z.number().positive().nullable().optional(),
  netAmount: z.number().min(0).nullable().optional(),
  currency: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/).nullable().optional()
})
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field must be provided."
  });

const createLines = (params: {
  direction: TransactionDirection;
  gross: number;
  net: number;
  vat: number;
  bankAccountId: string;
  mainAccountId: string;
  vatAccountId?: string;
}) => {
  if (params.direction === TransactionDirections.INCOME) {
    return [
      {
        accountId: params.bankAccountId,
        debit: params.gross,
        credit: 0,
        note: "counterparty_bank"
      },
      {
        accountId: params.mainAccountId,
        debit: 0,
        credit: params.net,
        note: null
      },
      ...(params.vat > 0 && params.vatAccountId
        ? [
            {
              accountId: params.vatAccountId,
              debit: 0,
              credit: params.vat,
              note: null
            }
          ]
        : [])
    ];
  }

  return [
    {
      accountId: params.mainAccountId,
      debit: params.net,
      credit: 0,
      note: null
    },
    ...(params.vat > 0 && params.vatAccountId
      ? [
          {
            accountId: params.vatAccountId,
            debit: params.vat,
            credit: 0,
            note: null
          }
        ]
      : []),
    {
      accountId: params.bankAccountId,
      debit: 0,
      credit: params.gross,
      note: "counterparty_bank"
    }
  ];
};

export async function PATCH(request: Request, context: RouteContext) {
  const receiptId = context.params.id;
  if (!receiptId) {
    return NextResponse.json({ error: "Missing receipt id." }, { status: 400 });
  }

  const rawPayload = patchSchema.parse(await request.json());
  const canUseItemPurchased = await supportsReceiptItemPurchasedField();

  const existing = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      transactions: {
        select: {
          id: true,
          direction: true,
          grossAmount: true,
          vatRate: true,
          txnDate: true
        }
      }
    }
  });
  if (!existing) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  const parsedReceiptDate =
    rawPayload.receiptDate === undefined
      ? undefined
      : rawPayload.receiptDate === null
        ? null
        : new Date(`${rawPayload.receiptDate}T00:00:00.000Z`);
  if (parsedReceiptDate !== undefined && parsedReceiptDate !== null && Number.isNaN(parsedReceiptDate.valueOf())) {
    return NextResponse.json({ error: "Invalid receipt date." }, { status: 400 });
  }
  const parsedCreatedDate =
    rawPayload.createdDate === undefined
      ? undefined
      : rawPayload.createdDate === null
        ? null
        : new Date(`${rawPayload.createdDate}T00:00:00.000Z`);
  if (parsedCreatedDate !== undefined && parsedCreatedDate !== null && Number.isNaN(parsedCreatedDate.valueOf())) {
    return NextResponse.json({ error: "Invalid created date." }, { status: 400 });
  }

  const categoryValue =
    rawPayload.category === undefined ? undefined : rawPayload.category === null ? null : rawPayload.category.trim();
  const submittedCurrency =
    rawPayload.currency === undefined || rawPayload.currency === null
      ? undefined
      : normalizeCurrency(rawPayload.currency);
  const shouldRefreshReceiptFinancials =
    rawPayload.grossAmount !== undefined ||
    rawPayload.netAmount !== undefined ||
    rawPayload.vatRate !== undefined ||
    rawPayload.vatAmount !== undefined;
  const shouldRecalculateConvertedFinancials =
    shouldRefreshReceiptFinancials ||
    rawPayload.currency !== undefined ||
    rawPayload.receiptDate !== undefined;
  const shouldRebookLinkedTransactions =
    rawPayload.receiptDate !== undefined ||
    rawPayload.category !== undefined ||
    rawPayload.vatRate !== undefined ||
    rawPayload.vatAmount !== undefined ||
    rawPayload.grossAmount !== undefined ||
    rawPayload.netAmount !== undefined ||
    rawPayload.currency !== undefined;
  const shouldUpdateTransactionReference = rawPayload.receiptNumber !== undefined;

  const existingGross = existing.grossAmount !== null ? asNumber(existing.grossAmount) : null;
  const existingVatRate = existing.vatRate !== null ? asNumber(existing.vatRate) : null;
  const existingVatAmount = existing.vatAmount !== null ? asNumber(existing.vatAmount) : null;
  const existingNetAmount = existing.netAmount !== null ? asNumber(existing.netAmount) : null;

  let derivedGrossAmount =
    rawPayload.grossAmount !== undefined ? rawPayload.grossAmount : existingGross;
  let derivedNetAmount =
    rawPayload.netAmount !== undefined ? rawPayload.netAmount : existingNetAmount;
  let derivedVatAmount =
    rawPayload.vatAmount !== undefined ? rawPayload.vatAmount : existingVatAmount;
  let effectiveVatRate =
    rawPayload.vatRate !== undefined ? rawPayload.vatRate : existingVatRate;

  if (derivedGrossAmount !== null && derivedNetAmount !== null && derivedVatAmount === null) {
    derivedVatAmount = round2(derivedGrossAmount - derivedNetAmount);
  }

  if (derivedGrossAmount !== null && derivedVatAmount !== null && derivedNetAmount === null) {
    derivedNetAmount = round2(derivedGrossAmount - derivedVatAmount);
  }

  if (derivedNetAmount !== null && derivedVatAmount !== null && derivedGrossAmount === null) {
    derivedGrossAmount = round2(derivedNetAmount + derivedVatAmount);
  }

  if (derivedGrossAmount !== null && derivedVatAmount === null && effectiveVatRate !== null) {
    derivedVatAmount = round2(derivedGrossAmount - derivedGrossAmount / (1 + effectiveVatRate));
  }

  if (derivedGrossAmount !== null && derivedNetAmount === null && derivedVatAmount !== null) {
    derivedNetAmount = round2(derivedGrossAmount - derivedVatAmount);
  }

  if (derivedNetAmount !== null && derivedGrossAmount === null && effectiveVatRate !== null) {
    derivedGrossAmount = round2(derivedNetAmount * (1 + effectiveVatRate));
  }

  if (
    (effectiveVatRate === null || effectiveVatRate === 0) &&
    derivedNetAmount !== null &&
    derivedVatAmount !== null &&
    derivedNetAmount > 0
  ) {
    effectiveVatRate = round4(derivedVatAmount / derivedNetAmount);
  } else if (
    (effectiveVatRate === null || effectiveVatRate === 0) &&
    derivedGrossAmount !== null &&
    derivedVatAmount !== null
  ) {
    const base = derivedGrossAmount - derivedVatAmount;
    if (base > 0) {
      effectiveVatRate = round4(derivedVatAmount / base);
    }
  }

  const derivedVatRate = effectiveVatRate ?? null;
  if (derivedGrossAmount !== null && derivedNetAmount !== null && derivedNetAmount > derivedGrossAmount) {
    return NextResponse.json({ error: "Net amount cannot exceed gross amount." }, { status: 400 });
  }
  if (derivedGrossAmount !== null && derivedVatAmount !== null && derivedVatAmount > derivedGrossAmount) {
    return NextResponse.json({ error: "VAT amount cannot exceed gross amount." }, { status: 400 });
  }

  const effectiveReceiptCurrency = submittedCurrency ?? normalizeCurrency(existing.currency ?? "SEK");
  const fxDateInput = parsedReceiptDate ?? existing.receiptDate ?? new Date();

  let receiptCurrency = effectiveReceiptCurrency;
  let receiptSourceCurrency: string | null = effectiveReceiptCurrency === "SEK" ? null : effectiveReceiptCurrency;
  let receiptFxRateToSek = existing.fxRateToSek !== null ? asNumber(existing.fxRateToSek) : null;
  let receiptFxRateDate = existing.fxRateDate ?? null;

  let postingGrossAmount = derivedGrossAmount;
  let postingNetAmount = derivedNetAmount;
  let postingVatAmount = derivedVatAmount;
  let postingSourceCurrency: string | null = null;

  if (derivedGrossAmount !== null && (shouldRebookLinkedTransactions || existing.transactions.length === 0)) {
    try {
      const converted = await convertToSekAtDate({
        currency: effectiveReceiptCurrency,
        date: fxDateInput,
        grossAmount: derivedGrossAmount,
        netAmount: derivedNetAmount ?? undefined,
        vatAmount: derivedVatAmount ?? undefined
      });
      postingGrossAmount = converted.grossAmountSek;
      postingNetAmount = converted.netAmountSek ?? (derivedNetAmount ?? null);
      postingVatAmount = converted.vatAmountSek ?? (derivedVatAmount ?? null);
      postingSourceCurrency = converted.sourceCurrency;
      receiptFxRateToSek = converted.fxRateToSek;
      receiptFxRateDate = converted.fxDate;
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

  const updated = await prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.update({
      where: { id: receiptId },
      data: {
        ...(rawPayload.needsReview !== undefined ? { needsReview: rawPayload.needsReview } : {}),
        ...(rawPayload.receiptNumber !== undefined ? { receiptNumber: rawPayload.receiptNumber?.trim() || null } : {}),
        ...(rawPayload.vendor !== undefined ? { vendor: rawPayload.vendor?.trim() || null } : {}),
        ...(canUseItemPurchased && rawPayload.itemPurchased !== undefined
          ? { itemPurchased: rawPayload.itemPurchased?.trim() || null }
          : {}),
        ...(rawPayload.source !== undefined ? { source: rawPayload.source?.trim() || "upload" } : {}),
        ...(rawPayload.originalFileName !== undefined
          ? { originalFileName: rawPayload.originalFileName?.trim() || existing.originalFileName }
          : {}),
        ...(rawPayload.mimeType !== undefined ? { mimeType: rawPayload.mimeType?.trim() || existing.mimeType } : {}),
        ...(rawPayload.confidence !== undefined ? { confidence: rawPayload.confidence } : {}),
        ...(rawPayload.createdDate !== undefined ? { createdAt: parsedCreatedDate ?? existing.createdAt } : {}),
        ...(rawPayload.receiptDate !== undefined ? { receiptDate: parsedReceiptDate } : {}),
        ...(rawPayload.category !== undefined ? { category: categoryValue } : {}),
        ...(shouldRecalculateConvertedFinancials
          ? {
              grossAmount: derivedGrossAmount,
              vatRate: derivedVatRate,
              vatAmount: derivedVatAmount,
              netAmount: derivedNetAmount
            }
          : {}),
        ...(shouldRecalculateConvertedFinancials || rawPayload.currency !== undefined
          ? {
              currency: receiptCurrency,
              sourceCurrency: receiptSourceCurrency ?? null,
              fxRateToSek: receiptFxRateToSek,
              fxRateDate: receiptFxRateDate
            }
          : {})
      },
      select: {
        businessId: true,
        id: true,
        needsReview: true,
        originalFileName: true,
        source: true,
        mimeType: true,
        receiptNumber: true,
        vendor: true,
        ...(canUseItemPurchased ? { itemPurchased: true } : {}),
        confidence: true,
        receiptDate: true,
        category: true,
        vatRate: true,
        grossAmount: true,
        netAmount: true,
        vatAmount: true,
        currency: true,
        sourceCurrency: true,
        fxRateToSek: true,
        fxRateDate: true,
        createdAt: true
      }
    });

    if ((shouldRebookLinkedTransactions || shouldUpdateTransactionReference) && existing.transactions.length > 0) {
      for (const transaction of existing.transactions) {
        if (!shouldRebookLinkedTransactions && shouldUpdateTransactionReference) {
          await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              reference: rawPayload.receiptNumber?.trim() || null
            }
          });
          continue;
        }

        const direction = transaction.direction as TransactionDirection;
        const gross =
          postingGrossAmount !== null
            ? postingGrossAmount
            : asNumber(transaction.grossAmount);
        const vatRate =
          derivedVatRate !== null
            ? derivedVatRate
            : asNumber(transaction.vatRate);
        const vat =
          postingVatAmount !== null
            ? round2(postingVatAmount)
            : vatRate > 0
              ? round2(gross - gross / (1 + vatRate))
              : 0;
        const net =
          postingNetAmount !== null
            ? round2(postingNetAmount)
            : round2(gross - vat);
        const normalizedCategory = normalizeReceiptCategory(
          rawPayload.category !== undefined ? rawPayload.category ?? undefined : existing.category ?? undefined
        );
        const mainAccountCode = accountCodeForCategory(normalizedCategory, direction);
        const bankAccountCode = "1930";
        const vatAccountCode = direction === TransactionDirections.INCOME ? "2610" : "2641";

        const neededCodes = [bankAccountCode, mainAccountCode, ...(vat > 0 ? [vatAccountCode] : [])];
        const accounts = await tx.account.findMany({
          where: {
            businessId: existing.businessId,
            code: { in: neededCodes }
          },
          select: { id: true, code: true }
        });

        const byCode = new Map(accounts.map((account) => [account.code, account.id]));
        const bankAccountId = byCode.get(bankAccountCode);
        const mainAccountId = byCode.get(mainAccountCode);
        const vatAccountId = byCode.get(vatAccountCode);
        if (!bankAccountId || !mainAccountId || (vat > 0 && !vatAccountId)) {
          throw new Error("Missing required account(s) for receipt rebooking.");
        }

        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            ...(parsedReceiptDate ? { txnDate: parsedReceiptDate } : {}),
            ...(rawPayload.receiptNumber !== undefined ? { reference: rawPayload.receiptNumber?.trim() || null } : {}),
            grossAmount: gross,
            vatRate,
            netAmount: net,
            vatAmount: vat,
            currency: "SEK",
            sourceCurrency: postingSourceCurrency ?? null,
            fxRateToSek: receiptFxRateToSek,
            fxRateDate: receiptFxRateDate
          }
        });

        await tx.journalLine.deleteMany({
          where: { transactionId: transaction.id }
        });

        const lines = createLines({
          direction,
          gross,
          net,
          vat,
          bankAccountId,
          mainAccountId,
          vatAccountId
        });

        await tx.journalLine.createMany({
          data: lines.map((line) => ({
            transactionId: transaction.id,
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            note: line.note
          }))
        });
      }
    }

    if (existing.transactions.length === 0) {
      if (postingGrossAmount !== null && postingGrossAmount > 0) {
        const direction = TransactionDirections.EXPENSE;
        const vatRate = derivedVatRate ?? 0.25;
        const vat =
          postingVatAmount !== null
            ? round2(postingVatAmount)
            : vatRate > 0
              ? round2(postingGrossAmount - postingGrossAmount / (1 + vatRate))
              : 0;
        const net =
          postingNetAmount !== null
            ? round2(postingNetAmount)
            : round2(postingGrossAmount - vat);
        const normalizedCategory = normalizeReceiptCategory(receipt.category);
        const category = normalizedCategory === "sales" ? "other" : normalizedCategory;
        const bankAccountCode = "1930";
        const mainAccountCode = accountCodeForCategory(category, direction);
        const vatAccountCode = "2641";
        const neededCodes = [bankAccountCode, mainAccountCode, ...(vat > 0 ? [vatAccountCode] : [])];

        const accounts = await tx.account.findMany({
          where: {
            businessId: receipt.businessId,
            code: { in: neededCodes }
          },
          select: { id: true, code: true }
        });

        const byCode = new Map(accounts.map((account) => [account.code, account.id]));
        const bankAccountId = byCode.get(bankAccountCode);
        const mainAccountId = byCode.get(mainAccountCode);
        const vatAccountId = byCode.get(vatAccountCode);
        if (!bankAccountId || !mainAccountId || (vat > 0 && !vatAccountId)) {
          throw new Error("Missing required account(s) for receipt posting.");
        }

        const transaction = await tx.transaction.create({
          data: {
            businessId: receipt.businessId,
            receiptId: receipt.id,
            txnDate: parsedReceiptDate ?? receipt.receiptDate ?? receipt.createdAt,
            description:
              ((receipt as { itemPurchased?: string }).itemPurchased?.trim() ||
              receipt.vendor?.trim() ||
              receipt.receiptNumber?.trim() ||
              `Receipt ${receipt.originalFileName}`),
            direction,
            grossAmount: postingGrossAmount,
            netAmount: net,
            vatAmount: vat,
            vatRate,
            currency: "SEK",
            sourceCurrency: postingSourceCurrency ?? undefined,
            fxRateToSek: receiptFxRateToSek ?? undefined,
            fxRateDate: receiptFxRateDate ?? undefined,
            source: EntrySources.RECEIPT,
            reference: receipt.receiptNumber?.trim() || null
          },
          select: { id: true }
        });

        const lines = createLines({
          direction,
          gross: postingGrossAmount,
          net,
          vat,
          bankAccountId,
          mainAccountId,
          vatAccountId
        });

        await tx.journalLine.createMany({
          data: lines.map((line) => ({
            transactionId: transaction.id,
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            note: line.note
          }))
        });
      }
    }

    return receipt;
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const receiptId = context.params.id;
  if (!receiptId) {
    return NextResponse.json({ error: "Missing receipt id." }, { status: 400 });
  }

  const existing = await prisma.receipt.findUnique({
    where: { id: receiptId },
    select: { id: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const removedTransactions = await tx.transaction.deleteMany({
      where: { receiptId }
    });

    await tx.receipt.delete({
      where: { id: receiptId }
    });

    return {
      deletedReceiptId: receiptId,
      deletedTransactions: removedTransactions.count
    };
  });

  return NextResponse.json(deleted);
}
