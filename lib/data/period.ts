export const parseTaxYear = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{4}$/.test(trimmed)) return null;

  const year = Number(trimmed);
  if (!Number.isInteger(year) || year < 1970 || year > 9999) return null;
  return year;
};

export const normalizeFiscalYearStartMonth = (month: number | null | undefined) => {
  if (!Number.isInteger(month)) return 1;
  if (month === null || month === undefined) return 1;
  if (month < 1 || month > 12) return 1;
  return month;
};

export const getFiscalYearStartMonth = (fiscalYearStart: Date | string | null | undefined) => {
  if (!fiscalYearStart) return 1;
  const value = fiscalYearStart instanceof Date ? fiscalYearStart : new Date(fiscalYearStart);
  if (Number.isNaN(value.valueOf())) return 1;
  return value.getUTCMonth() + 1;
};

export const getFiscalYearEndMonth = (startMonth: number) => {
  const normalized = normalizeFiscalYearStartMonth(startMonth);
  return normalized === 1 ? 12 : normalized - 1;
};

export const getFiscalYearForDate = (date: Date, startMonth: number) => {
  const normalized = normalizeFiscalYearStartMonth(startMonth);
  const month = date.getUTCMonth() + 1;
  return month >= normalized ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
};

export const getLatestClosedTaxYear = (startMonth: number, now = new Date()) =>
  getFiscalYearForDate(now, startMonth) - 1;

export const fiscalYearPeriod = (taxYear: number, startMonth: number) => {
  const normalized = normalizeFiscalYearStartMonth(startMonth);
  const from = new Date(Date.UTC(taxYear, normalized - 1, 1));
  const to = new Date(Date.UTC(taxYear + 1, normalized - 1, 0, 23, 59, 59, 999));
  return { from, to };
};

export const formatTaxYearLabel = (taxYear: number, startMonth: number) => {
  const normalized = normalizeFiscalYearStartMonth(startMonth);
  if (normalized === 1) return String(taxYear);
  return `${taxYear}/${taxYear + 1}`;
};

export const calendarYearPeriod = (year: number) => ({
  from: new Date(Date.UTC(year, 0, 1)),
  to: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
});

export const parseMonth = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;

  const month = Number(trimmed);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return month;
};

export const calendarMonthPeriod = (year: number, month: number) => ({
  from: new Date(Date.UTC(year, month - 1, 1)),
  to: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
});

export const resolveReportPeriod = (params: URLSearchParams, fiscalYearStartMonth = 1) => {
  const taxYear = parseTaxYear(params.get("year"));
  if (taxYear !== null) {
    return fiscalYearPeriod(taxYear, fiscalYearStartMonth);
  }

  const fromRaw = params.get("from");
  const toRaw = params.get("to");

  const now = new Date();
  const currentTaxYear = getFiscalYearForDate(now, fiscalYearStartMonth);
  const currentFiscalPeriod = fiscalYearPeriod(currentTaxYear, fiscalYearStartMonth);

  const from = fromRaw ? new Date(fromRaw) : currentFiscalPeriod.from;
  const to = toRaw ? new Date(toRaw) : currentFiscalPeriod.to;

  if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf())) {
    throw new Error("Invalid date range.");
  }

  return { from, to };
};
