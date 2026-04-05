import { LedgerTransactionsTable } from "@/components/ledger/LedgerTransactionsTable";
import { SectionExportBar } from "@/components/layout/SectionExportBar";
import { asNumber } from "@/lib/accounting/math";
import { ensureBusiness } from "@/lib/data/business";
import { fiscalYearPeriod, formatTaxYearLabel, getFiscalYearStartMonth, parseTaxYear } from "@/lib/data/period";
import { supportsReceiptItemPurchasedField } from "@/lib/data/receiptItemSupport";
import { getClosedTaxYearsForBusiness } from "@/lib/data/taxYears";
import { prisma } from "@/lib/db";
import { getRequestLocale } from "@/lib/i18n/locale";

type LedgerPageProps = {
  searchParams?: {
    year?: string;
    from?: string;
    to?: string;
    source?: string;
  };
};

const parseDate = (value: string | undefined, endOfDay = false) => {
  if (!value) return null;
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const parsed = new Date(`${value}${suffix}`);
  if (Number.isNaN(parsed.valueOf())) return null;
  return parsed;
};

export default async function LedgerPage({ searchParams }: LedgerPageProps) {
  const locale = getRequestLocale();
  const copy =
    locale === "sv"
      ? {
          title: "Huvudbok",
          subtitle: "Fullständig lista över bokförda transaktioner.",
          taxYear: "Skatteår",
          customRange: "Eget intervall",
          from: "Från",
          to: "Till",
          source: "Källa",
          allSources: "Alla källor",
          filter: "Filtrera",
          date: "Datum",
          itemPurchased: "Inköpt vara",
          description: "Beskrivning",
          vendor: "Leverantör",
          direction: "Riktning",
          gross: "Brutto",
          net: "Netto",
          vat: "Moms",
          totalGross: "Totalt brutto",
          totalNet: "Totalt netto",
          totalVat: "Total moms",
          sourceCol: "Källa",
          reference: "Referens",
          journal: "Verifikation",
          input: "Underlag",
          erase: "Radera",
          erasing: "Raderar...",
          eraseSelected: "Radera markerade",
          erasingSelected: "Raderar markerade...",
          selectedCount: "Markerade",
          selectAll: "Markera alla",
          selectRow: "Markera rad",
          deleteSelectedConfirm: "Radera alla markerade huvudboksposter?",
          none: "Inga transaktioner hittades.",
          reviewReceipt: "Granska kvitto",
          reviewTransaction: "Granska post",
          reviewInput: "Granska underlag",
          deleteConfirm: "Radera den här huvudboksposten?",
          deleteFailed: "Kunde inte radera posten.",
          unknownDeleteError: "Okänt fel vid radering."
        }
      : {
          title: "Ledger",
          subtitle: "Complete register of all posted transactions.",
          taxYear: "Tax Year",
          customRange: "Custom range",
          from: "From",
          to: "To",
          source: "Source",
          allSources: "All sources",
          filter: "Filter",
          date: "Date",
          itemPurchased: "Item Purchased",
          description: "Description",
          vendor: "Vendor",
          direction: "Direction",
          gross: "Gross",
          net: "Net",
          vat: "VAT",
          totalGross: "Total gross",
          totalNet: "Total net",
          totalVat: "Total VAT",
          sourceCol: "Source",
          reference: "Reference",
          journal: "Journal",
          input: "Input",
          erase: "Delete",
          erasing: "Deleting...",
          eraseSelected: "Delete selected",
          erasingSelected: "Deleting selected...",
          selectedCount: "Selected",
          selectAll: "Select all",
          selectRow: "Select row",
          deleteSelectedConfirm: "Delete all selected ledger entries?",
          none: "No transactions found.",
          reviewReceipt: "Review receipt",
          reviewTransaction: "Review entry",
          reviewInput: "Review input",
          deleteConfirm: "Delete this ledger entry?",
          deleteFailed: "Failed to delete entry.",
          unknownDeleteError: "Unknown delete error."
        };

  const business = await ensureBusiness();
  const fiscalYearStartMonth = getFiscalYearStartMonth(business.fiscalYearStart);
  const closedTaxYears = await getClosedTaxYearsForBusiness(business.id, fiscalYearStartMonth);
  const requestedYear = parseTaxYear(searchParams?.year);
  const selectedYear =
    requestedYear && closedTaxYears.includes(requestedYear)
      ? requestedYear
      : null;
  const selectedYearPeriod = selectedYear ? fiscalYearPeriod(selectedYear, fiscalYearStartMonth) : null;

  const from = selectedYearPeriod?.from ?? parseDate(searchParams?.from);
  const to = selectedYearPeriod?.to ?? parseDate(searchParams?.to, true);
  const fromInputValue = selectedYearPeriod?.from.toISOString().slice(0, 10) ?? searchParams?.from ?? "";
  const toInputValue = selectedYearPeriod?.to.toISOString().slice(0, 10) ?? searchParams?.to ?? "";
  const sourceFilter = searchParams?.source?.trim();
  const canUseItemPurchased = await supportsReceiptItemPurchasedField();

  const receiptSelect = canUseItemPurchased
    ? { id: true, vendor: true, originalFileName: true, itemPurchased: true }
    : { id: true, vendor: true, originalFileName: true };

  const transactions = await prisma.transaction.findMany({
    where: {
      businessId: business.id,
      ...(from || to
        ? {
            txnDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {})
            }
          }
        : {}),
      ...(sourceFilter ? { source: sourceFilter } : {})
    },
    include: {
      receipt: {
        select: receiptSelect as any
      },
      paidInvoice: {
        select: {
          customerName: true,
          invoiceNumber: true
        }
      },
      lines: {
        include: {
          account: true
        }
      }
    },
    orderBy: [{ txnDate: "desc" }, { createdAt: "desc" }],
    take: 500
  });

  const sources = await prisma.transaction.findMany({
    where: { businessId: business.id },
    select: { source: true },
    distinct: ["source"],
    orderBy: { source: "asc" }
  });

  const ledgerRows = (transactions as any[]).map((txn) => ({
    id: txn.id,
    txnDate: txn.txnDate.toISOString(),
    itemPurchased: (() => {
      const description = String(txn.description ?? "").trim();
      const receiptItem = String(txn.receipt?.itemPurchased ?? "").trim();
      const fileName = String(txn.receipt?.originalFileName ?? "").trim();
      const itemFromFile = fileName
        ? fileName
            .replace(/\.[a-z0-9]+$/i, "")
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
        : "";

      if (receiptItem) return receiptItem;
      if (
        description &&
        !/^receipt from\s+/i.test(description) &&
        !/^manual receipt\s+/i.test(description) &&
        !/^imported from receipt/i.test(description)
      ) {
        return description;
      }
      if (itemFromFile) return itemFromFile;
      if (txn.reference?.trim()) return txn.reference.trim();
      return "-";
    })(),
    description: txn.description,
    vendor: txn.receipt?.vendor ?? txn.paidInvoice?.customerName ?? null,
    direction: txn.direction,
    grossAmount: asNumber(txn.grossAmount),
    netAmount: asNumber(txn.netAmount),
    vatAmount: asNumber(txn.vatAmount),
    currency: txn.currency,
    source: txn.source,
    reference: txn.reference ?? null,
    journal: txn.lines
      .map((line: any) => {
        const debit = asNumber(line.debit);
        const credit = asNumber(line.credit);
        const amount = debit > 0 ? `D ${debit.toFixed(2)}` : `C ${credit.toFixed(2)}`;
        return `${line.account.code} ${amount}`;
      })
      .join(" | "),
    receiptId: txn.receipt?.id ?? null
  }));

  return (
    <section className="page">
      <h1 className="title">{copy.title}</h1>
      <p className="subtitle">{copy.subtitle}</p>
      <SectionExportBar
        locale={locale}
        section="ledger"
        params={{
          year: selectedYear ? String(selectedYear) : undefined,
          from: selectedYear ? undefined : searchParams?.from,
          to: selectedYear ? undefined : searchParams?.to,
          source: sourceFilter
        }}
      />

      <article className="card" id="ledger-filters">
        <form className="row" method="get">
          <label className="stack">
            {copy.taxYear}
            <select name="year" defaultValue={selectedYear ? String(selectedYear) : ""}>
              <option value="">{copy.customRange}</option>
              {closedTaxYears.map((year) => (
                <option key={year} value={year}>
                  {formatTaxYearLabel(year, fiscalYearStartMonth)}
                </option>
              ))}
            </select>
          </label>
          <label className="stack">
            {copy.from}
            <input type="date" name="from" defaultValue={fromInputValue} />
          </label>
          <label className="stack">
            {copy.to}
            <input type="date" name="to" defaultValue={toInputValue} />
          </label>
          <label className="stack">
            {copy.source}
            <select name="source" defaultValue={sourceFilter ?? ""}>
              <option value="">{copy.allSources}</option>
              {sources.map((source) => (
                <option key={source.source} value={source.source}>
                  {source.source}
                </option>
              ))}
            </select>
          </label>
          <div className="row" style={{ alignItems: "end" }}>
            <button type="submit">{copy.filter}</button>
          </div>
        </form>
      </article>

      <article className="card" id="ledger-entries">
        <LedgerTransactionsTable
          locale={locale}
          rows={ledgerRows}
          copy={{
            date: copy.date,
            itemPurchased: copy.itemPurchased,
            description: copy.description,
            vendor: copy.vendor,
            direction: copy.direction,
            gross: copy.gross,
            net: copy.net,
            vat: copy.vat,
            totalGross: copy.totalGross,
            totalNet: copy.totalNet,
            totalVat: copy.totalVat,
            sourceCol: copy.sourceCol,
            reference: copy.reference,
            journal: copy.journal,
            input: copy.input,
            erase: copy.erase,
            erasing: copy.erasing,
            eraseSelected: copy.eraseSelected,
            erasingSelected: copy.erasingSelected,
            selectedCount: copy.selectedCount,
            selectAll: copy.selectAll,
            selectRow: copy.selectRow,
            deleteSelectedConfirm: copy.deleteSelectedConfirm,
            none: copy.none,
            reviewReceipt: copy.reviewReceipt,
            reviewTransaction: copy.reviewTransaction,
            deleteConfirm: copy.deleteConfirm,
            deleteFailed: copy.deleteFailed,
            unknownDeleteError: copy.unknownDeleteError
          }}
        />
      </article>
    </section>
  );
}
