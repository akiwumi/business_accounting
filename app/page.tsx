import { buildDashboardSummary } from "@/lib/accounting/reports";
import { SectionExportBar } from "@/components/layout/SectionExportBar";
import { fiscalYearPeriod, formatTaxYearLabel, getFiscalYearStartMonth, parseTaxYear } from "@/lib/data/period";
import { getClosedTaxYearsForBusiness, getLatestClosedTaxYear } from "@/lib/data/taxYears";
import { ensureBusiness } from "@/lib/data/business";
import { formatMoney } from "@/lib/data/format";
import { prisma } from "@/lib/db";
import { getRequestLocale } from "@/lib/i18n/locale";

type DashboardPageProps = {
  searchParams?: {
    year?: string;
  };
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const locale = getRequestLocale();
  const copy =
    locale === "sv"
      ? {
          title: "Bokföringsöversikt",
          annual: "Årsbokslut (historik)",
          taxYear: "Skatteår",
          customNote: "Stängda skatteår följer din valda skatteårsperiod i inställningarna.",
          loadYear: "Ladda år",
          revenue: "Intäkter",
          expenses: "Kostnader",
          operatingProfit: "Rörelseresultat",
          vatPayable: "Beräknad moms att betala",
          vatOutput: "Utgående moms (löpande)",
          vatInput: "Ingående moms (löpande)",
          transactions: "Bokförda transaktioner",
          receipts: "Lagrade kvitton",
          workflow: "Arbetsflöde",
          exportAccounts: "Exportera hela bokföringen (Excel)",
          step1: "1. Ladda upp eller vidarebefordra kvitton på sidan Kvitton.",
          step2: "2. Importera bank-CSV för att bokföra kontantmetodstransaktioner automatiskt.",
          step3: "3. Skapa P&L, balansräkning, moms, skatteprognos och NE-utkast under Rapporter.",
          step4: "4. Exportera arbetsboken till Excel för redovisning och deklarationsunderlag."
        }
      : {
          title: "Accounting Dashboard",
          annual: "Annual Books (Historical)",
          taxYear: "Tax Year",
          customNote: "Closed tax years follow your configured tax-year range in settings.",
          loadYear: "Load Year",
          revenue: "Revenue",
          expenses: "Expenses",
          operatingProfit: "Operating Profit",
          vatPayable: "Estimated VAT Payable",
          vatOutput: "Output VAT (Running)",
          vatInput: "Input VAT (Running)",
          transactions: "Transactions Posted",
          receipts: "Receipts Stored",
          workflow: "Workflow Status",
          exportAccounts: "Export Full Accounts (Excel)",
          step1: "1. Upload or forward receipts from the Receipts page.",
          step2: "2. Import bank CSV to auto-post cash-method transactions.",
          step3: "3. Generate P&L, Balance, VAT, Tax Estimate and NE-bilaga draft under Reports.",
          step4: "4. Export the workbook to Excel for your accountant and tax return prep."
        };
  const numberLocale = locale === "sv" ? "sv-SE" : "en-GB";

  const business = await ensureBusiness();
  const fiscalYearStartMonth = getFiscalYearStartMonth(business.fiscalYearStart);
  const closedTaxYears = await getClosedTaxYearsForBusiness(business.id, fiscalYearStartMonth);
  const requestedYear = parseTaxYear(searchParams?.year);
  const selectedYear =
    requestedYear && closedTaxYears.includes(requestedYear)
      ? requestedYear
      : (closedTaxYears[0] ?? getLatestClosedTaxYear(fiscalYearStartMonth));
  const period = fiscalYearPeriod(selectedYear, fiscalYearStartMonth);
  const taxYearLabel = formatTaxYearLabel(selectedYear, fiscalYearStartMonth);
  const [summary, transactionCount, receiptCount] = await Promise.all([
    buildDashboardSummary({ businessId: business.id, ...period }),
    prisma.transaction.count({
      where: {
        businessId: business.id,
        txnDate: {
          gte: period.from,
          lte: period.to
        }
      }
    }),
    prisma.receipt.count({
      where: {
        businessId: business.id,
        OR: [
          {
            receiptDate: {
              gte: period.from,
              lte: period.to
            }
          },
          {
            receiptDate: null,
            createdAt: {
              gte: period.from,
              lte: period.to
            }
          }
        ]
      }
    })
  ]);

  return (
    <section className="page dashboardPage">
      <h1 className="title">{copy.title}</h1>
      <p className="subtitle dashboardMeta">
        {business.name} · {business.jurisdiction} · {business.bookkeepingMethod} · VAT {business.vatFrequency} ·{" "}
        {copy.taxYear} {taxYearLabel}
      </p>
      <SectionExportBar locale={locale} section="dashboard" params={{ year: String(selectedYear) }} />
      <div className="row dashboardExportRow" id="dashboard-export-accounts">
        <a className="button" href={`/api/exports/accounts?year=${selectedYear}`}>
          {copy.exportAccounts}
        </a>
      </div>

      <article className="card" id="annual-books">
        <h2>{copy.annual}</h2>
        <form className="row dashboardYearForm" method="get">
          <label className="stack">
            {copy.taxYear}
            <select name="year" defaultValue={String(selectedYear)}>
              {closedTaxYears.map((year) => (
                <option key={year} value={year}>
                  {formatTaxYearLabel(year, fiscalYearStartMonth)}
                </option>
              ))}
            </select>
          </label>
          <div className="row dashboardYearFormActions">
            <button type="submit">{copy.loadYear}</button>
          </div>
        </form>
        <p className="note">{copy.customNote}</p>
      </article>

      <div className="grid dashboardKpiGrid" id="summary-kpis">
        <article className="card dashboardKpiCard">
          <p className="label">
            {copy.revenue} ({taxYearLabel})
          </p>
          <p className="kpi">{formatMoney(summary.revenue, "SEK", numberLocale)}</p>
        </article>
        <article className="card dashboardKpiCard">
          <p className="label">
            {copy.expenses} ({taxYearLabel})
          </p>
          <p className="kpi">{formatMoney(summary.expenses, "SEK", numberLocale)}</p>
        </article>
        <article className="card dashboardKpiCard">
          <p className="label">
            {copy.operatingProfit} ({taxYearLabel})
          </p>
          <p className="kpi">{formatMoney(summary.operatingProfit, "SEK", numberLocale)}</p>
        </article>
        <article className="card dashboardKpiCard">
          <p className="label">{copy.vatPayable}</p>
          <p className="kpi">{formatMoney(summary.vatPayable, "SEK", numberLocale)}</p>
        </article>
        <article className="card dashboardKpiCard">
          <p className="label">{copy.vatOutput}</p>
          <p className="kpi">{formatMoney(summary.vatOutput, "SEK", numberLocale)}</p>
        </article>
        <article className="card dashboardKpiCard">
          <p className="label">{copy.vatInput}</p>
          <p className="kpi">{formatMoney(summary.vatInput, "SEK", numberLocale)}</p>
        </article>
      </div>

      <div className="grid dashboardActivityGrid" id="activity-summary">
        <article className="card dashboardKpiCard">
          <p className="label">{copy.transactions}</p>
          <p className="kpi">{transactionCount}</p>
        </article>
        <article className="card dashboardKpiCard">
          <p className="label">{copy.receipts}</p>
          <p className="kpi">{receiptCount}</p>
        </article>
      </div>

      <article className="card" id="workflow">
        <h2>{copy.workflow}</h2>
        <div className="stack dashboardWorkflowList">
          <p className="note">{copy.step1}</p>
          <p className="note">{copy.step2}</p>
          <p className="note">{copy.step3}</p>
          <p className="note">{copy.step4}</p>
        </div>
      </article>
    </section>
  );
}
