import { swedishSoleTraderDefaultAccounts } from "@/lib/accounting/chartOfAccounts";
import { mergeBusinessWithLocalSettings, readLocalSettings } from "@/lib/data/localSettings";
import { prisma } from "@/lib/db";
import { Jurisdictions } from "@/lib/domain/enums";

const DEFAULT_BUSINESS_NAME = "My Sole Trader Business";

export const ensureBusiness = async () => {
  const existing = await prisma.business.findFirst({
    include: {
      taxConfig: true
    }
  });

  if (existing) {
    const localSettings = await readLocalSettings();
    return mergeBusinessWithLocalSettings(existing, localSettings);
  }

  const business = await prisma.business.create({
    data: {
      name: DEFAULT_BUSINESS_NAME,
      orgType: "sole_trader",
      jurisdiction: Jurisdictions.SWEDEN,
      bookkeepingMethod: "kontantmetoden",
      vatRegistered: true,
      vatFrequency: "yearly",
      fiscalYearStart: new Date("2026-01-01T00:00:00.000Z"),
      baseCurrency: "SEK",
      locale: "en",
      invoiceNumberPattern: "INV-{YYYY}-{SEQ:4}",
      nextInvoiceSequence: 1,
      invoiceSenderName: DEFAULT_BUSINESS_NAME,
      accounts: {
        create: swedishSoleTraderDefaultAccounts.map((account) => ({
          code: account.code,
          name: account.name,
          type: account.type,
          vatCode: account.vatCode,
          isSystem: account.isSystem ?? false
        }))
      },
      taxConfig: {
        create: {
          municipalTaxRate: 0.32,
          socialContributionRate: 0.2897,
          generalDeductionRate: 0.25,
          vatStandardRate: 0.25,
          vatReducedRateFood: 0.12,
          vatReducedRateCulture: 0.06
        }
      }
    },
    include: {
      taxConfig: true
    }
  });

  const localSettings = await readLocalSettings();
  return mergeBusinessWithLocalSettings(business, localSettings);
};
