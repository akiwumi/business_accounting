import { ManualReceiptForm } from "@/components/forms/ManualReceiptForm";
import { ReceiptUploadForm } from "@/components/forms/ReceiptUploadForm";
import { SectionExportBar } from "@/components/layout/SectionExportBar";
import { ReceiptsTable } from "@/components/receipts/ReceiptsTable";
import { asNumber } from "@/lib/accounting/math";
import { ensureBusiness } from "@/lib/data/business";
import { calendarMonthPeriod, calendarYearPeriod, parseMonth, parseTaxYear } from "@/lib/data/period";
import { prisma } from "@/lib/db";
import { getRequestLocale } from "@/lib/i18n/locale";

type ReceiptsPageProps = {
  searchParams?: {
    year?: string;
    month?: string;
    q?: string;
    view?: string;
  };
};

export default async function ReceiptsPage({ searchParams }: ReceiptsPageProps) {
  const locale = getRequestLocale();
  const copy =
    locale === "sv"
      ? {
          title: "Kvittoregistrering",
          subtitle: "Registrera utgående betalningar från kvitton via foto/PDF, e-postwebhook eller manuell inmatning.",
          uploadTitle: "Uppladdning",
          manualTitle: "Manuell inmatning",
          recent: "Senaste kvitton",
          issueDate: "Utfärdandedatum",
          createdDate: "Registrerad",
          receiptNumber: "Kvittonummer",
          vendor: "Leverantör",
          file: "Fil",
          gross: "Brutto",
          status: "Status",
          posted: "Bokförd",
          yes: "Ja",
          no: "Nej",
          none: "Inga kvitton ännu.",
          unknown: "Okänd",
          na: "Saknas",
          needsReview: "Kräver granskning",
          ready: "Klar",
          actions: "Åtgärder",
          delete: "Radera",
          deleting: "Raderar...",
          deleteSelected: "Radera markerade",
          deletingSelected: "Raderar markerade...",
          selectedCount: "Markerade",
          selectAll: "Markera alla",
          selectRow: "Markera rad",
          deleteSelectedConfirm: "Radera alla markerade kvitton och tillhörande bokföringspost(er)?",
          review: "Granska",
          deleteConfirm: "Radera det här kvittot och tillhörande bokföringspost(er)?",
          deleteFailed: "Kunde inte radera kvittot.",
          unknownDeleteError: "Okänt fel vid radering.",
          filterTitle: "Sök kvitton",
          year: "År",
          month: "Månad",
          allMonths: "Alla månader",
          search: "Sök",
          searchPlaceholder: "Kvittonummer, leverantör eller filnamn",
          filter: "Filtrera",
          showAllStored: "Visa alla lagrade kvitton",
          showRecent: "Visa senaste kvitton",
          allStored: "Alla lagrade kvitton"
        }
      : {
          title: "Receipt Capture",
          subtitle: "Record outgoing payments from receipts via photo/PDF upload, email webhook, or manual entry.",
          uploadTitle: "Upload",
          manualTitle: "Manual Entry",
          recent: "Recent Receipts",
          issueDate: "Issue Date",
          createdDate: "Recorded",
          receiptNumber: "Receipt Number",
          vendor: "Vendor",
          file: "File",
          gross: "Gross",
          status: "Status",
          posted: "Posted",
          yes: "Yes",
          no: "No",
          none: "No receipts yet.",
          unknown: "Unknown",
          na: "N/A",
          needsReview: "Needs Review",
          ready: "Ready",
          actions: "Actions",
          delete: "Delete",
          deleting: "Deleting...",
          deleteSelected: "Delete selected",
          deletingSelected: "Deleting selected...",
          selectedCount: "Selected",
          selectAll: "Select all",
          selectRow: "Select row",
          deleteSelectedConfirm: "Delete all selected receipts and their linked ledger transaction(s)?",
          review: "Review",
          deleteConfirm: "Delete this receipt and its linked ledger transaction(s)?",
          deleteFailed: "Failed to delete receipt.",
          unknownDeleteError: "Unknown delete error.",
          filterTitle: "Search Receipts",
          year: "Year",
          month: "Month",
          allMonths: "All months",
          search: "Search",
          searchPlaceholder: "Receipt number, vendor or filename",
          filter: "Filter",
          showAllStored: "Show all receipts stored",
          showRecent: "Show recent receipts",
          allStored: "All Receipts Stored"
        };

  const business = await ensureBusiness();
  const isAllView = searchParams?.view === "all";
  const nowYear = new Date().getUTCFullYear();
  const minReceipt = await prisma.receipt.aggregate({
    where: { businessId: business.id },
    _min: { receiptDate: true, createdAt: true }
  });
  const earliest = [minReceipt._min.receiptDate, minReceipt._min.createdAt]
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const minYear = earliest?.getUTCFullYear() ?? nowYear;
  const startYear = Math.min(minYear, nowYear);
  const yearOptions = Array.from({ length: nowYear - startYear + 1 }, (_item, index) => nowYear - index);
  const requestedYear = parseTaxYear(searchParams?.year);
  const selectedYear =
    requestedYear && requestedYear >= startYear && requestedYear <= nowYear ? requestedYear : nowYear;
  const selectedMonth = parseMonth(searchParams?.month);
  const period = selectedMonth ? calendarMonthPeriod(selectedYear, selectedMonth) : calendarYearPeriod(selectedYear);
  const query = searchParams?.q?.trim() || "";
  const buildViewHref = (nextView: "all" | "recent") => {
    const params = new URLSearchParams();
    if (nextView === "all") {
      params.set("view", "all");
    } else {
      params.set("year", String(selectedYear));
      if (selectedMonth) params.set("month", String(selectedMonth));
    }
    if (query) params.set("q", query);
    const suffix = params.toString();
    return suffix ? `/receipts?${suffix}` : "/receipts";
  };

  const whereAnd: Array<Record<string, unknown>> = [
    ...(isAllView
      ? []
      : [
          {
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
        ]),
    ...(query
      ? [
          {
            OR: [
              { receiptNumber: { contains: query } },
              { vendor: { contains: query } },
              { originalFileName: { contains: query } }
            ]
          }
        ]
      : [])
  ];

  const receipts = await prisma.receipt.findMany({
    where: {
      businessId: business.id,
      ...(whereAnd.length > 0 ? { AND: whereAnd } : {})
    },
    include: {
      transactions: {
        select: { id: true }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    ...(isAllView ? {} : { take: 20 })
  });

  return (
    <section className="page">
      <h1 className="title">{copy.title}</h1>
      <p className="subtitle">{copy.subtitle}</p>
      <SectionExportBar
        locale={locale}
        section="receipts"
        params={{
          year: String(selectedYear),
          month: selectedMonth ? String(selectedMonth) : undefined,
          q: query || undefined,
          view: isAllView ? "all" : undefined
        }}
      />

      <article className="card" id="upload">
        <h2>{copy.uploadTitle}</h2>
        <ReceiptUploadForm
          locale={locale}
          activeYear={selectedYear}
          activeMonth={selectedMonth ?? null}
        />
      </article>

      <article className="card" id="manual-entry">
        <h2>{copy.manualTitle}</h2>
        <ManualReceiptForm
          locale={locale}
          activeYear={selectedYear}
          activeMonth={selectedMonth ?? null}
        />
      </article>

      <article className="card" id="receipt-filters">
        <h2>{copy.filterTitle}</h2>
        <form className="row" method="get">
          {isAllView ? <input type="hidden" name="view" value="all" /> : null}
          {!isAllView && (
            <label className="stack">
              {copy.year}
              <select name="year" defaultValue={String(selectedYear)}>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!isAllView && (
            <label className="stack">
              {copy.month}
              <select name="month" defaultValue={selectedMonth ? String(selectedMonth) : ""}>
                <option value="">{copy.allMonths}</option>
                {Array.from({ length: 12 }).map((_value, index) => (
                  <option key={index + 1} value={index + 1}>
                    {new Intl.DateTimeFormat(locale === "sv" ? "sv-SE" : "en-GB", { month: "long" }).format(
                      new Date(Date.UTC(2026, index, 1))
                    )}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="stack" style={{ minWidth: 260 }}>
            {copy.search}
            <input name="q" defaultValue={query} placeholder={copy.searchPlaceholder} />
          </label>

          <div className="row" style={{ alignItems: "end" }}>
            <button type="submit">{copy.filter}</button>
          </div>
        </form>
      </article>

      <article className="card" id="recent-receipts">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2>{isAllView ? copy.allStored : copy.recent}</h2>
          <a className="button secondary" href={buildViewHref(isAllView ? "recent" : "all")}>
            {isAllView ? copy.showRecent : copy.showAllStored}
          </a>
        </div>
        <ReceiptsTable
          locale={locale}
          rows={receipts.map((receipt) => ({
            id: receipt.id,
            createdAt: receipt.createdAt.toISOString(),
            receiptDate: receipt.receiptDate ? receipt.receiptDate.toISOString() : null,
            receiptNumber: receipt.receiptNumber ?? null,
            vendor: receipt.vendor,
            originalFileName: receipt.originalFileName,
            grossAmount: receipt.grossAmount
              ? asNumber(receipt.grossAmount as unknown as number | string)
              : null,
            currency: receipt.currency ?? "SEK",
            needsReview: receipt.needsReview,
            transactionsCount: receipt.transactions.length
          }))}
          copy={{
            issueDate: copy.issueDate,
            createdDate: copy.createdDate,
            receiptNumber: copy.receiptNumber,
            vendor: copy.vendor,
            file: copy.file,
            gross: copy.gross,
            status: copy.status,
            posted: copy.posted,
            actions: copy.actions,
            yes: copy.yes,
            no: copy.no,
            none: copy.none,
            needsReview: copy.needsReview,
            ready: copy.ready,
            delete: copy.delete,
            deleting: copy.deleting,
            deleteSelected: copy.deleteSelected,
            deletingSelected: copy.deletingSelected,
            selectedCount: copy.selectedCount,
            selectAll: copy.selectAll,
            selectRow: copy.selectRow,
            deleteSelectedConfirm: copy.deleteSelectedConfirm,
            review: copy.review,
            deleteConfirm: copy.deleteConfirm,
            deleteFailed: copy.deleteFailed,
            unknownDeleteError: copy.unknownDeleteError
          }}
        />
      </article>
    </section>
  );
}
