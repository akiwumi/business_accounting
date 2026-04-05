import { round2 } from "@/lib/accounting/math";

export type SupportedCurrency = string;

type FxRateInfo = {
  rateToSek: number;
  fxDateIso: string;
};

type ConvertToSekInput = {
  currency: string;
  date: Date | string;
  grossAmount: number;
  netAmount?: number;
  vatAmount?: number;
};

type ConvertToSekResult = {
  grossAmountSek: number;
  netAmountSek: number | undefined;
  vatAmountSek: number | undefined;
  currency: "SEK";
  sourceCurrency: SupportedCurrency | null;
  fxRateToSek: number | null;
  fxDate: Date | null;
};

const fxCache = new Map<string, FxRateInfo>();
const currencyCodeRegex = /^[A-Z]{3}$/;
const supportedFxCurrencies = new Set([
  "SEK",
  "USD",
  "EUR",
  "GBP",
  "NOK",
  "DKK",
  "CHF",
  "PLN",
  "CZK",
  "HUF",
  "RON",
  "BGN",
  "TRY",
  "HRK",
  "ISK",
  "CAD",
  "AUD",
  "NZD",
  "JPY",
  "CNY",
  "SGD",
  "HKD",
  "ZAR",
  "BRL",
  "MXN",
  "INR",
  "THB",
  "AED",
  "SAR",
  "QAR"
]);

const toDateIso = (value: Date | string): string => {
  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (dateOnly) return dateOnly;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.valueOf())) {
      throw new Error(`Invalid FX date: ${value}`);
    }
    return parsed.toISOString().slice(0, 10);
  }

  if (Number.isNaN(value.valueOf())) {
    throw new Error("Invalid FX date");
  }
  return value.toISOString().slice(0, 10);
};

export const normalizeCurrency = (value?: string): SupportedCurrency => {
  const upper = (value || "SEK").trim().toUpperCase();
  if (!currencyCodeRegex.test(upper)) return "SEK";
  return supportedFxCurrencies.has(upper) ? upper : "SEK";
};

const fetchRateToSek = async (currency: string, dateIso: string): Promise<FxRateInfo> => {
  if (currency === "SEK") {
    return { rateToSek: 1, fxDateIso: dateIso };
  }

  if (!currencyCodeRegex.test(currency)) {
    throw new Error(`Unsupported currency code: ${currency}`);
  }

  const cacheKey = `${currency}:${dateIso}`;
  const cached = fxCache.get(cacheKey);
  if (cached) return cached;

  const url = `https://api.frankfurter.app/${dateIso}?from=${currency}&to=SEK`;
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not fetch FX rate for ${currency} on ${dateIso} (${response.status}).`);
  }

  const json = (await response.json()) as {
    date?: string;
    rates?: {
      SEK?: number;
    };
  };

  const rate = Number(json?.rates?.SEK);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Invalid FX rate response from frankfurter.app");
  }

  const result: FxRateInfo = {
    rateToSek: rate,
    fxDateIso: json.date && /^\d{4}-\d{2}-\d{2}$/.test(json.date) ? json.date : dateIso
  };
  fxCache.set(cacheKey, result);
  return result;
};

export const convertToSekAtDate = async (input: ConvertToSekInput): Promise<ConvertToSekResult> => {
  const currency = normalizeCurrency(input.currency);
  const dateIso = toDateIso(input.date);

  if (currency === "SEK") {
    return {
      grossAmountSek: round2(input.grossAmount),
      netAmountSek: input.netAmount !== undefined ? round2(input.netAmount) : undefined,
      vatAmountSek: input.vatAmount !== undefined ? round2(input.vatAmount) : undefined,
      currency: "SEK",
      sourceCurrency: null,
      fxRateToSek: null,
      fxDate: null
    };
  }

  const rateInfo = await fetchRateToSek(currency, dateIso);
  return {
    grossAmountSek: round2(input.grossAmount * rateInfo.rateToSek),
    netAmountSek: input.netAmount !== undefined ? round2(input.netAmount * rateInfo.rateToSek) : undefined,
    vatAmountSek: input.vatAmount !== undefined ? round2(input.vatAmount * rateInfo.rateToSek) : undefined,
    currency: "SEK",
    sourceCurrency: currency,
    fxRateToSek: rateInfo.rateToSek,
    fxDate: new Date(`${rateInfo.fxDateIso}T00:00:00.000Z`)
  };
};
