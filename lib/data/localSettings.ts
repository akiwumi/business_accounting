import { promises as fs } from "node:fs";
import path from "node:path";

export type LocalBusinessSettings = {
  name: string;
  jurisdiction: string;
  locale: string;
  baseCurrency: string;
  bookkeepingMethod: string;
  vatRegistered: boolean;
  vatFrequency: string;
  fiscalYearStartMonth: number;
  sniCode?: string;
  vatNumber?: string;
  fSkattRegistered?: boolean;
  personnummer?: string;
  invoiceNumberPattern?: string;
  invoiceSenderName?: string;
  invoiceSenderAddress?: string;
  invoiceSenderOrgNumber?: string;
  invoiceSenderEmail?: string;
  invoiceSenderPhone?: string;
  invoiceSenderWebsite?: string;
  invoiceEmailFrom?: string;
  invoiceDefaultLogo?: string;
  invoiceDefaultSignature?: string;
  municipalTaxRate?: number;
  socialContributionRate?: number;
  generalDeductionRate?: number;
};

const LOCAL_SETTINGS_PATH = path.join(process.cwd(), "data", "local-settings.json");

type LocalSettingsFile = {
  updatedAt: string;
  settings: LocalBusinessSettings;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeSettings = (value: unknown): LocalBusinessSettings | null => {
  if (!isObject(value)) return null;

  return {
    name: typeof value.name === "string" ? value.name : "My Sole Trader Business",
    jurisdiction: typeof value.jurisdiction === "string" ? value.jurisdiction : "SWEDEN",
    locale: typeof value.locale === "string" ? value.locale : "en",
    baseCurrency: typeof value.baseCurrency === "string" ? value.baseCurrency : "SEK",
    bookkeepingMethod: typeof value.bookkeepingMethod === "string" ? value.bookkeepingMethod : "kontantmetoden",
    vatRegistered: typeof value.vatRegistered === "boolean" ? value.vatRegistered : true,
    vatFrequency: typeof value.vatFrequency === "string" ? value.vatFrequency : "yearly",
    fiscalYearStartMonth: Math.min(12, Math.max(1, Math.trunc(toNumber(value.fiscalYearStartMonth, 1)))),
    sniCode: typeof value.sniCode === "string" ? value.sniCode : "",
    vatNumber: typeof value.vatNumber === "string" ? value.vatNumber : "",
    fSkattRegistered: typeof value.fSkattRegistered === "boolean" ? value.fSkattRegistered : true,
    personnummer: typeof value.personnummer === "string" ? value.personnummer : "",
    invoiceNumberPattern:
      typeof value.invoiceNumberPattern === "string" ? value.invoiceNumberPattern : "INV-{YYYY}-{SEQ:4}",
    invoiceSenderName: typeof value.invoiceSenderName === "string" ? value.invoiceSenderName : "",
    invoiceSenderAddress: typeof value.invoiceSenderAddress === "string" ? value.invoiceSenderAddress : "",
    invoiceSenderOrgNumber: typeof value.invoiceSenderOrgNumber === "string" ? value.invoiceSenderOrgNumber : "",
    invoiceSenderEmail: typeof value.invoiceSenderEmail === "string" ? value.invoiceSenderEmail : "",
    invoiceSenderPhone: typeof value.invoiceSenderPhone === "string" ? value.invoiceSenderPhone : "",
    invoiceSenderWebsite: typeof value.invoiceSenderWebsite === "string" ? value.invoiceSenderWebsite : "",
    invoiceEmailFrom: typeof value.invoiceEmailFrom === "string" ? value.invoiceEmailFrom : "",
    invoiceDefaultLogo: typeof value.invoiceDefaultLogo === "string" ? value.invoiceDefaultLogo : "",
    invoiceDefaultSignature: typeof value.invoiceDefaultSignature === "string" ? value.invoiceDefaultSignature : "",
    municipalTaxRate: toNumber(value.municipalTaxRate, 0.32),
    socialContributionRate: toNumber(value.socialContributionRate, 0.2897),
    generalDeductionRate: toNumber(value.generalDeductionRate, 0.25)
  };
};

export const writeLocalSettings = async (settings: LocalBusinessSettings) => {
  const payload: LocalSettingsFile = {
    updatedAt: new Date().toISOString(),
    settings
  };

  await fs.mkdir(path.dirname(LOCAL_SETTINGS_PATH), { recursive: true });
  await fs.writeFile(LOCAL_SETTINGS_PATH, JSON.stringify(payload, null, 2), "utf8");
};

export const readLocalSettings = async (): Promise<LocalBusinessSettings | null> => {
  try {
    const raw = await fs.readFile(LOCAL_SETTINGS_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (isObject(parsed) && "settings" in parsed) {
      return normalizeSettings(parsed.settings);
    }
    return normalizeSettings(parsed);
  } catch {
    return null;
  }
};

export const mergeBusinessWithLocalSettings = <T extends { [key: string]: unknown }>(
  business: T,
  local: LocalBusinessSettings | null
): T => {
  if (!local) return business;

  const merged = {
    ...business,
    name: local.name,
    jurisdiction: local.jurisdiction,
    locale: local.locale,
    baseCurrency: local.baseCurrency,
    bookkeepingMethod: local.bookkeepingMethod,
    vatRegistered: local.vatRegistered,
    vatFrequency: local.vatFrequency,
    sniCode: local.sniCode || null,
    vatNumber: local.vatNumber || null,
    fSkattRegistered: local.fSkattRegistered ?? true,
    personnummer: local.personnummer || null,
    invoiceNumberPattern: local.invoiceNumberPattern || "INV-{YYYY}-{SEQ:4}",
    invoiceSenderName: local.invoiceSenderName || null,
    invoiceSenderAddress: local.invoiceSenderAddress || null,
    invoiceSenderOrgNumber: local.invoiceSenderOrgNumber || null,
    invoiceSenderEmail: local.invoiceSenderEmail || null,
    invoiceSenderPhone: local.invoiceSenderPhone || null,
    invoiceSenderWebsite: local.invoiceSenderWebsite || null,
    invoiceEmailFrom: local.invoiceEmailFrom || null,
    invoiceDefaultLogo: local.invoiceDefaultLogo || null,
    invoiceDefaultSignature: local.invoiceDefaultSignature || null,
    fiscalYearStart: new Date(Date.UTC(2000, local.fiscalYearStartMonth - 1, 1, 0, 0, 0, 0))
  } as T;

  const mergedRecord = merged as Record<string, unknown>;
  const maybeTaxConfig = mergedRecord.taxConfig;
  if (maybeTaxConfig && typeof maybeTaxConfig === "object") {
    mergedRecord.taxConfig = {
      ...(maybeTaxConfig as Record<string, unknown>),
      municipalTaxRate: local.municipalTaxRate ?? (maybeTaxConfig as Record<string, unknown>).municipalTaxRate,
      socialContributionRate:
        local.socialContributionRate ?? (maybeTaxConfig as Record<string, unknown>).socialContributionRate,
      generalDeductionRate:
        local.generalDeductionRate ?? (maybeTaxConfig as Record<string, unknown>).generalDeductionRate
    };
  }

  return merged;
};
