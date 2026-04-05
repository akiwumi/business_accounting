"use client";

import { useMemo, useState } from "react";

import { type Locale } from "@/lib/i18n/locale";

const toISODate = (date: Date) => date.toISOString().slice(0, 10);

const yearRange = (year: number, fiscalYearStartMonth: number) => {
  const normalized = Number.isInteger(fiscalYearStartMonth) && fiscalYearStartMonth >= 1 && fiscalYearStartMonth <= 12
    ? fiscalYearStartMonth
    : 1;
  const from = new Date(Date.UTC(year, normalized - 1, 1));
  const to = new Date(Date.UTC(year + 1, normalized - 1, 0, 23, 59, 59, 999));
  return {
    from: toISODate(from),
    to: toISODate(to)
  };
};

const initialRange = (initialYear: number, fiscalYearStartMonth: number) => {
  if (Number.isInteger(initialYear)) {
    return yearRange(initialYear, fiscalYearStartMonth);
  }

  const now = new Date();
  const normalized = Number.isInteger(fiscalYearStartMonth) && fiscalYearStartMonth >= 1 && fiscalYearStartMonth <= 12
    ? fiscalYearStartMonth
    : 1;
  const currentMonth = now.getUTCMonth() + 1;
  const currentFiscalYear = currentMonth >= normalized ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return {
    from: toISODate(new Date(Date.UTC(currentFiscalYear, normalized - 1, 1))),
    to: toISODate(new Date(Date.UTC(currentFiscalYear + 1, normalized - 1, 0, 23, 59, 59, 999)))
  };
};

const formatTaxYearLabel = (year: number, fiscalYearStartMonth: number) =>
  fiscalYearStartMonth === 1 ? String(year) : `${year}/${year + 1}`;

type ReportsRunnerProps = {
  locale: Locale;
  closedYears: number[];
  fiscalYearStartMonth: number;
  initialYear: number;
};

export const ReportsRunner = ({ locale, closedYears, fiscalYearStartMonth, initialYear }: ReportsRunnerProps) => {
  const copy =
    locale === "sv"
      ? {
          taxYear: "Skatteår",
          customRange: "Eget intervall",
          from: "Från",
          to: "Till",
          loading: "Laddar...",
          pnl: "Resultaträkning",
          balance: "Balansräkning",
          vat: "Momsrapport",
          taxEstimate: "Skatteprognos",
          neDraft: "NE-utkast",
          excel: "Exportera rapporter (Excel)",
          pdf: "Exportera rapporter (PDF)",
          failed: "Kunde inte läsa rapport"
        }
      : {
          taxYear: "Tax Year",
          customRange: "Custom range",
          from: "From",
          to: "To",
          loading: "Loading...",
          pnl: "P&L",
          balance: "Balance Sheet",
          vat: "VAT Report",
          taxEstimate: "Tax Estimate",
          neDraft: "NE-bilaga Draft",
          excel: "Export Reports (Excel)",
          pdf: "Export Reports (PDF)",
          failed: "Failed to load report"
        };

  const [selectedYear, setSelectedYear] = useState(String(initialYear));
  const [range, setRange] = useState(initialRange(initialYear, fiscalYearStartMonth));
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      from: range.from || toISODate(new Date()),
      to: range.to || toISODate(new Date())
    });
    if (selectedYear) {
      params.set("year", selectedYear);
    }
    return params.toString();
  }, [range.from, range.to, selectedYear]);

  const run = async (path: string) => {
    setLoadingKey(path);
    setError(null);
    try {
      const response = await fetch(`${path}?${query}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? copy.failed);
      setResult(json);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Unknown report error");
      setResult(null);
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="stack">
      <div className="row">
        <label>
          {copy.taxYear}
          <select
            value={selectedYear}
            onChange={(event) => {
              const next = event.target.value;
              setSelectedYear(next);
              if (next) {
                setRange(yearRange(Number(next), fiscalYearStartMonth));
              }
            }}
          >
            <option value="">{copy.customRange}</option>
            {closedYears.map((year) => (
              <option key={year} value={year}>
                {formatTaxYearLabel(year, fiscalYearStartMonth)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="row">
        <label>
          {copy.from}
          <input
            type="date"
            value={range.from}
            onChange={(event) => setRange((state) => ({ ...state, from: event.target.value }))}
          />
        </label>
        <label>
          {copy.to}
          <input
            type="date"
            value={range.to}
            onChange={(event) => setRange((state) => ({ ...state, to: event.target.value }))}
          />
        </label>
      </div>

      <div className="row">
        <button type="button" onClick={() => run("/api/reports/pnl")} disabled={Boolean(loadingKey)}>
          {loadingKey === "/api/reports/pnl" ? copy.loading : copy.pnl}
        </button>
        <button type="button" onClick={() => run("/api/reports/balance")} disabled={Boolean(loadingKey)}>
          {loadingKey === "/api/reports/balance" ? copy.loading : copy.balance}
        </button>
        <button type="button" onClick={() => run("/api/reports/vat")} disabled={Boolean(loadingKey)}>
          {loadingKey === "/api/reports/vat" ? copy.loading : copy.vat}
        </button>
        <button type="button" onClick={() => run("/api/reports/tax-estimate")} disabled={Boolean(loadingKey)}>
          {loadingKey === "/api/reports/tax-estimate" ? copy.loading : copy.taxEstimate}
        </button>
        <button type="button" onClick={() => run("/api/reports/ne-bilaga")} disabled={Boolean(loadingKey)}>
          {loadingKey === "/api/reports/ne-bilaga" ? copy.loading : copy.neDraft}
        </button>
      </div>

      <div className="row" id="report-export">
        <a className="button secondary" href={`/api/exports/section?section=reports&format=excel&${query}`}>
          {copy.excel}
        </a>
        <a className="button secondary" href={`/api/exports/section?section=reports&format=pdf&${query}`}>
          {copy.pdf}
        </a>
      </div>

      {error && <p className="error">{error}</p>}
      {result !== null && (
        <pre className="card" style={{ overflowX: "auto", whiteSpace: "pre-wrap", margin: 0 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
};
