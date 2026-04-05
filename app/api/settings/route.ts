import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureBusiness } from "@/lib/data/business";
import { prisma } from "@/lib/db";
import { Jurisdictions } from "@/lib/domain/enums";
import {
  mergeBusinessWithLocalSettings,
  readLocalSettings,
  type LocalBusinessSettings,
  writeLocalSettings
} from "@/lib/data/localSettings";
import { sanitizeInvoiceNumberPattern } from "@/lib/invoices/numbering";

const updateSchema = z.object({
  name: z.string().min(2).max(120),
  jurisdiction: z.enum([Jurisdictions.SWEDEN, Jurisdictions.EU_GENERIC, Jurisdictions.UK]),
  locale: z.enum(["en", "sv"]).default("en"),
  baseCurrency: z.enum(["SEK", "EUR", "GBP"]).default("SEK"),
  bookkeepingMethod: z.enum(["kontantmetoden", "fakturametoden"]).default("kontantmetoden"),
  vatRegistered: z.boolean().default(true),
  vatFrequency: z.enum(["monthly", "quarterly", "yearly"]).default("yearly"),
  fiscalYearStartMonth: z.number().int().min(1).max(12).default(1),
  // Swedish registration fields
  sniCode: z.string().trim().max(20).optional().or(z.literal("")),
  vatNumber: z.string().trim().max(30).optional().or(z.literal("")),
  fSkattRegistered: z.boolean().default(true),
  personnummer: z.string().trim().max(20).optional().or(z.literal("")),
  // Invoice fields
  invoiceNumberPattern: z.string().trim().min(1).max(80).default("INV-{YYYY}-{SEQ:4}"),
  invoiceSenderName: z.string().trim().max(120).optional(),
  invoiceSenderAddress: z.string().trim().max(500).optional(),
  invoiceSenderOrgNumber: z.string().trim().max(80).optional(),
  invoiceSenderEmail: z.string().trim().email().max(120).optional().or(z.literal("")),
  invoiceSenderPhone: z.string().trim().max(80).optional(),
  invoiceSenderWebsite: z.string().trim().max(120).optional(),
  invoiceEmailFrom: z.string().trim().email().max(120).optional().or(z.literal("")),
  invoiceDefaultLogo: z.string().trim().max(1_500_000).optional(),
  invoiceDefaultSignature: z.string().trim().max(1_500_000).optional(),
  // Tax rates
  municipalTaxRate: z.number().min(0).max(1),
  socialContributionRate: z.number().min(0).max(1),
  generalDeductionRate: z.number().min(0).max(1)
});

export const dynamic = "force-dynamic";

export async function GET() {
  const business = await ensureBusiness();
  const fullBusiness = await prisma.business.findUnique({
    where: { id: business.id },
    include: { taxConfig: true }
  });
  const localSettings = await readLocalSettings();
  return NextResponse.json(mergeBusinessWithLocalSettings(fullBusiness ?? business, localSettings));
}

export async function PUT(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    let payload: z.infer<typeof updateSchema>;
    try {
      payload = updateSchema.parse(body);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Validation error" },
        { status: 422 }
      );
    }

    const localPayload: LocalBusinessSettings = {
      name: payload.name,
      jurisdiction: payload.jurisdiction,
      locale: payload.locale,
      baseCurrency: payload.baseCurrency,
      bookkeepingMethod: payload.bookkeepingMethod,
      vatRegistered: payload.vatRegistered,
      vatFrequency: payload.vatFrequency,
      fiscalYearStartMonth: payload.fiscalYearStartMonth,
      sniCode: payload.sniCode ?? "",
      vatNumber: payload.vatNumber ?? "",
      fSkattRegistered: payload.fSkattRegistered,
      personnummer: payload.personnummer ?? "",
      invoiceNumberPattern: sanitizeInvoiceNumberPattern(payload.invoiceNumberPattern),
      invoiceSenderName: payload.invoiceSenderName ?? "",
      invoiceSenderAddress: payload.invoiceSenderAddress ?? "",
      invoiceSenderOrgNumber: payload.invoiceSenderOrgNumber ?? "",
      invoiceSenderEmail: payload.invoiceSenderEmail ?? "",
      invoiceSenderPhone: payload.invoiceSenderPhone ?? "",
      invoiceSenderWebsite: payload.invoiceSenderWebsite ?? "",
      invoiceEmailFrom: payload.invoiceEmailFrom ?? "",
      invoiceDefaultLogo: payload.invoiceDefaultLogo ?? "",
      invoiceDefaultSignature: payload.invoiceDefaultSignature ?? "",
      municipalTaxRate: payload.municipalTaxRate,
      socialContributionRate: payload.socialContributionRate,
      generalDeductionRate: payload.generalDeductionRate
    };

    // Always persist locally so settings survive even if DB write fails.
    await writeLocalSettings(localPayload);

    const business = await ensureBusiness();

    try {
      const updated = await prisma.business.update({
        where: { id: business.id },
        data: {
          name: payload.name,
          jurisdiction: payload.jurisdiction,
          locale: payload.locale,
          baseCurrency: payload.baseCurrency,
          bookkeepingMethod: payload.bookkeepingMethod,
          vatRegistered: payload.vatRegistered,
          vatFrequency: payload.vatFrequency,
          fiscalYearStart: new Date(Date.UTC(2000, payload.fiscalYearStartMonth - 1, 1, 0, 0, 0, 0)),
          sniCode: payload.sniCode?.trim() || null,
          vatNumber: payload.vatNumber?.trim() || null,
          fSkattRegistered: payload.fSkattRegistered,
          personnummer: payload.personnummer?.trim() || null,
          invoiceNumberPattern: sanitizeInvoiceNumberPattern(payload.invoiceNumberPattern),
          invoiceSenderName: payload.invoiceSenderName?.trim() || null,
          invoiceSenderAddress: payload.invoiceSenderAddress?.trim() || null,
          invoiceSenderOrgNumber: payload.invoiceSenderOrgNumber?.trim() || null,
          invoiceSenderEmail: payload.invoiceSenderEmail?.trim() || null,
          invoiceSenderPhone: payload.invoiceSenderPhone?.trim() || null,
          invoiceSenderWebsite: payload.invoiceSenderWebsite?.trim() || null,
          invoiceEmailFrom: payload.invoiceEmailFrom?.trim() || null,
          invoiceDefaultLogo: payload.invoiceDefaultLogo?.trim() || null,
          invoiceDefaultSignature: payload.invoiceDefaultSignature?.trim() || null,
          taxConfig: {
            upsert: {
              create: {
                municipalTaxRate: payload.municipalTaxRate,
                socialContributionRate: payload.socialContributionRate,
                generalDeductionRate: payload.generalDeductionRate
              },
              update: {
                municipalTaxRate: payload.municipalTaxRate,
                socialContributionRate: payload.socialContributionRate,
                generalDeductionRate: payload.generalDeductionRate
              }
            }
          }
        },
        include: {
          taxConfig: true
        }
      });

      return NextResponse.json({
        ...updated,
        savedLocally: true
      });
    } catch (dbError) {
      const merged = mergeBusinessWithLocalSettings(business, localPayload);
      return NextResponse.json({
        ...merged,
        savedLocally: true,
        warning:
          dbError instanceof Error
            ? `Saved locally only: ${dbError.message}`
            : "Saved locally only: database update failed."
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save settings."
      },
      { status: 500 }
    );
  }
}
