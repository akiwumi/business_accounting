import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { asNumber, round2 } from "@/lib/accounting/math";
import {
  buildBalanceSheet,
  buildDashboardSummary,
  buildNeBilagaDraft,
  buildProfitAndLoss,
  buildVatReport
} from "@/lib/accounting/reports";
import { ensureBusiness } from "@/lib/data/business";
import { fiscalYearPeriod, formatTaxYearLabel, getFiscalYearStartMonth, parseTaxYear } from "@/lib/data/period";
import { getClosedTaxYearsForBusiness, getLatestClosedTaxYear } from "@/lib/data/taxYears";
import { isPayrollPrismaReady, prisma } from "@/lib/db";
import { type Jurisdiction } from "@/lib/domain/enums";
import { getTaxEngine } from "@/lib/tax/engines";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExportRow = Record<string, string | number | boolean | null>;

type AggregateTotals = {
  entries: number;
  gross: number;
  net: number;
  vat: number;
  revenue: number;
  expenses: number;
  operatingProfit: number;
  currencies: string;
};

const dateIso = (value: Date | null | undefined) => (value ? value.toISOString().slice(0, 10) : null);

const toSheetName = (value: string, index: number) => {
  const clean = value.replace(/[\\/*?:[\]]/g, " ").trim() || `Sheet ${index + 1}`;
  return clean.slice(0, 31);
};

const sanitizeFileNamePart = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "accounts";

const appendSheet = (workbook: XLSX.WorkBook, name: string, rows: ExportRow[], index: number) => {
  const safeRows = rows.length > 0 ? rows : [{ Message: "No data" }];
  const worksheet = XLSX.utils.json_to_sheet(safeRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, toSheetName(name, index));
};

const aggregateTransactions = (
  transactions: Array<{
    txnDate: Date;
    direction: string;
    grossAmount: unknown;
    netAmount: unknown;
    vatAmount: unknown;
    currency: string;
  }>,
  from?: Date,
  to?: Date
): AggregateTotals => {
  const totals = transactions.reduce(
    (accumulator, transaction) => {
      if (from && transaction.txnDate < from) return accumulator;
      if (to && transaction.txnDate > to) return accumulator;

      const gross = asNumber(transaction.grossAmount);
      const net = asNumber(transaction.netAmount);
      const vat = asNumber(transaction.vatAmount);

      accumulator.entries += 1;
      accumulator.gross += Number.isFinite(gross) ? gross : 0;
      accumulator.net += Number.isFinite(net) ? net : 0;
      accumulator.vat += Number.isFinite(vat) ? vat : 0;

      if (transaction.direction === "INCOME") {
        accumulator.revenue += Number.isFinite(net) ? net : 0;
      } else if (transaction.direction === "EXPENSE") {
        accumulator.expenses += Number.isFinite(net) ? net : 0;
      }

      const currency = (transaction.currency || "").trim().toUpperCase();
      if (currency) {
        accumulator.currencySet.add(currency);
      }
      return accumulator;
    },
    {
      entries: 0,
      gross: 0,
      net: 0,
      vat: 0,
      revenue: 0,
      expenses: 0,
      currencySet: new Set<string>()
    }
  );

  return {
    entries: totals.entries,
    gross: round2(totals.gross),
    net: round2(totals.net),
    vat: round2(totals.vat),
    revenue: round2(totals.revenue),
    expenses: round2(totals.expenses),
    operatingProfit: round2(totals.revenue - totals.expenses),
    currencies: totals.currencySet.size > 0 ? [...totals.currencySet].sort().join(", ") : ""
  };
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const business = await ensureBusiness();
  const fiscalYearStartMonth = getFiscalYearStartMonth(business.fiscalYearStart);
  const closedTaxYears = await getClosedTaxYearsForBusiness(business.id, fiscalYearStartMonth);
  const requestedYear = parseTaxYear(url.searchParams.get("year"));
  const selectedYear =
    requestedYear && closedTaxYears.includes(requestedYear)
      ? requestedYear
      : (closedTaxYears[0] ?? getLatestClosedTaxYear(fiscalYearStartMonth));
  const period = fiscalYearPeriod(selectedYear, fiscalYearStartMonth);
  const taxYearLabel = formatTaxYearLabel(selectedYear, fiscalYearStartMonth);
  const payrollReady = isPayrollPrismaReady();

  const [
    summary,
    profitAndLoss,
    balanceSheet,
    vat,
    neDraft,
    accounts,
    customers,
    employeesPayroll,
    salaryEntries,
    employeeExpenses,
    receipts,
    transactions,
    invoices,
    bankImportBatches,
    bankImportRows,
    fixedAssets,
    mileageEntries,
    periodisationEntries
  ] = await Promise.all([
    buildDashboardSummary({ businessId: business.id, ...period }),
    buildProfitAndLoss({ businessId: business.id, ...period }),
    buildBalanceSheet({ businessId: business.id, ...period }),
    buildVatReport({ businessId: business.id, ...period }),
    buildNeBilagaDraft({ businessId: business.id, ...period }),
    prisma.account.findMany({
      where: { businessId: business.id },
      orderBy: { code: "asc" }
    }),
    prisma.customer.findMany({
      where: { businessId: business.id },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }]
    }),
    payrollReady
      ? prisma.employee.findMany({
          where: { businessId: business.id },
          orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }]
        })
      : Promise.resolve([]),
    payrollReady
      ? prisma.salaryEntry.findMany({
          where: { businessId: business.id },
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                employeeNumber: true
              }
            }
          },
          orderBy: [{ payrollDate: "desc" }, { createdAt: "desc" }],
          take: 20000
        })
      : Promise.resolve([]),
    payrollReady
      ? prisma.employeeExpense.findMany({
          where: { businessId: business.id },
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                employeeNumber: true
              }
            }
          },
          orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
          take: 20000
        })
      : Promise.resolve([]),
    prisma.receipt.findMany({
      where: { businessId: business.id },
      include: { transactions: { select: { id: true } } },
      orderBy: [{ receiptDate: "desc" }, { createdAt: "desc" }],
      take: 20000
    }),
    prisma.transaction.findMany({
      where: { businessId: business.id },
      include: {
        receipt: { select: { id: true, vendor: true, receiptNumber: true, originalFileName: true } },
        paidInvoice: { select: { id: true, invoiceNumber: true, customerName: true } },
        lines: { include: { account: true } }
      },
      orderBy: [{ txnDate: "desc" }, { createdAt: "desc" }],
      take: 20000
    }),
    prisma.invoice.findMany({
      where: { businessId: business.id },
      include: {
        customer: true,
        paidTransaction: { select: { id: true } },
        items: true
      },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      take: 20000
    }),
    prisma.bankImportBatch.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      take: 20000
    }),
    prisma.bankImportRow.findMany({
      where: { batch: { businessId: business.id } },
      include: { batch: { select: { fileName: true, createdAt: true } } },
      orderBy: [{ txnDate: "desc" }, { rowNumber: "asc" }],
      take: 20000
    }),
    prisma.fixedAsset.findMany({
      where: { businessId: business.id },
      orderBy: [{ acquisitionDate: "desc" }, { createdAt: "desc" }],
      take: 20000
    }),
    prisma.mileageEntry.findMany({
      where: { businessId: business.id },
      orderBy: [{ tripDate: "desc" }, { createdAt: "desc" }],
      take: 20000
    }),
    prisma.periodisationEntry.findMany({
      where: { businessId: business.id },
      orderBy: [{ taxYear: "desc" }, { createdAt: "desc" }],
      take: 20000
    })
  ]);

  const taxEstimate = business.taxConfig
    ? getTaxEngine(business.jurisdiction as Jurisdiction).estimate({
        profitBeforeTax: profitAndLoss.operatingProfit,
        municipalTaxRate: asNumber(business.taxConfig.municipalTaxRate),
        socialContributionRate: asNumber(business.taxConfig.socialContributionRate),
        generalDeductionRate: asNumber(business.taxConfig.generalDeductionRate)
      })
    : null;

  const selectedPeriodTotals = aggregateTransactions(transactions, period.from, period.to);
  const allTimeTotals = aggregateTransactions(transactions);

  const salaryEntriesAscending = [...salaryEntries].sort((a, b) => {
    const dateDiff = a.payrollDate.getTime() - b.payrollDate.getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  let runningGross = 0;
  let runningTax = 0;
  let runningEmployer = 0;
  let runningPension = 0;
  let runningNet = 0;
  const salaryRunningRows = salaryEntriesAscending.map((entry) => {
    runningGross += asNumber(entry.taxableGross);
    runningTax += asNumber(entry.preliminaryTaxAmount);
    runningEmployer += asNumber(entry.employerContributionAmount);
    runningPension += asNumber(entry.pensionAmount);
    runningNet += asNumber(entry.netSalary);
    return {
      PayrollDate: dateIso(entry.payrollDate),
      Employee: `${entry.employee.firstName} ${entry.employee.lastName}`.trim(),
      EmployeeNumber: entry.employee.employeeNumber ?? null,
      SalaryEntryId: entry.id,
      GrossThisEntry: asNumber(entry.taxableGross),
      TaxThisEntry: asNumber(entry.preliminaryTaxAmount),
      EmployerContributionThisEntry: asNumber(entry.employerContributionAmount),
      PensionThisEntry: asNumber(entry.pensionAmount),
      NetThisEntry: asNumber(entry.netSalary),
      RunningGrossTotal: round2(runningGross),
      RunningTaxTotal: round2(runningTax),
      RunningEmployerContributionTotal: round2(runningEmployer),
      RunningPensionTotal: round2(runningPension),
      RunningNetTotal: round2(runningNet)
    };
  });

  const workbook = XLSX.utils.book_new();
  const generatedAt = new Date().toISOString();

  const sheets: Array<{ name: string; rows: ExportRow[] }> = [
    {
      name: "Overview",
      rows: [
        {
          GeneratedAt: generatedAt,
          BusinessName: business.name,
          Jurisdiction: business.jurisdiction,
          OrgType: business.orgType,
          BookkeepingMethod: business.bookkeepingMethod,
          VatRegistered: business.vatRegistered,
          VatFrequency: business.vatFrequency,
          FiscalYearStartMonth: fiscalYearStartMonth,
          SelectedTaxYear: taxYearLabel,
          SelectedPeriodFrom: dateIso(period.from),
          SelectedPeriodTo: dateIso(period.to),
          BaseCurrency: business.baseCurrency,
          Locale: business.locale,
          InvoiceNumberPattern: business.invoiceNumberPattern,
          NextInvoiceSequence: business.nextInvoiceSequence
        }
      ]
    },
    {
      name: "SelectedYear_Summary",
      rows: [
        { Metric: "Revenue", Value: summary.revenue },
        { Metric: "Expenses", Value: summary.expenses },
        { Metric: "Operating Profit", Value: summary.operatingProfit },
        { Metric: "VAT Payable", Value: summary.vatPayable },
        { Metric: "Output VAT", Value: summary.vatOutput },
        { Metric: "Input VAT", Value: summary.vatInput },
        { Metric: "Transactions (Selected Year)", Value: selectedPeriodTotals.entries },
        { Metric: "Receipts Stored (All Time)", Value: receipts.length },
        { Metric: "Invoices Stored (All Time)", Value: invoices.length }
      ]
    },
    {
      name: "SelectedYear_PnL",
      rows: [
        { Section: "Summary", AccountCode: "", AccountName: "Revenue", Amount: profitAndLoss.revenue },
        { Section: "Summary", AccountCode: "", AccountName: "Expenses", Amount: profitAndLoss.expenses },
        { Section: "Summary", AccountCode: "", AccountName: "Operating Profit", Amount: profitAndLoss.operatingProfit },
        ...profitAndLoss.incomeAccounts.map((item) => ({
          Section: "Income Account",
          AccountCode: item.accountCode,
          AccountName: item.accountName,
          Amount: item.amount
        })),
        ...profitAndLoss.expenseAccounts.map((item) => ({
          Section: "Expense Account",
          AccountCode: item.accountCode,
          AccountName: item.accountName,
          Amount: item.amount
        }))
      ]
    },
    {
      name: "SelectedYear_Balance",
      rows: [
        { Section: "Summary", AccountCode: "", AccountName: "Total Assets", Amount: balanceSheet.totalAssets },
        {
          Section: "Summary",
          AccountCode: "",
          AccountName: "Total Liabilities",
          Amount: balanceSheet.totalLiabilities
        },
        { Section: "Summary", AccountCode: "", AccountName: "Total Equity", Amount: balanceSheet.totalEquity },
        {
          Section: "Summary",
          AccountCode: "",
          AccountName: "Current Year Result",
          Amount: balanceSheet.currentYearResult
        },
        {
          Section: "Summary",
          AccountCode: "",
          AccountName: "Liabilities + Equity",
          Amount: balanceSheet.liabilitiesAndEquity
        },
        { Section: "Summary", AccountCode: "", AccountName: "Difference", Amount: balanceSheet.difference },
        ...balanceSheet.assets.map((item) => ({
          Section: "Asset",
          AccountCode: item.accountCode,
          AccountName: item.accountName,
          Amount: item.amount
        })),
        ...balanceSheet.liabilities.map((item) => ({
          Section: "Liability",
          AccountCode: item.accountCode,
          AccountName: item.accountName,
          Amount: item.amount
        })),
        ...balanceSheet.equity.map((item) => ({
          Section: "Equity",
          AccountCode: item.accountCode,
          AccountName: item.accountName,
          Amount: item.amount
        }))
      ]
    },
    {
      name: "SelectedYear_VAT",
      rows: [
        { Metric: "Taxable Sales", Amount: vat.taxableSales },
        { Metric: "Taxable Purchases", Amount: vat.taxablePurchases },
        { Metric: "Output VAT", Amount: vat.outputVat },
        { Metric: "Input VAT", Amount: vat.inputVat },
        { Metric: "VAT Payable", Amount: vat.vatPayable }
      ]
    },
    {
      name: "SelectedYear_TaxEstimate",
      rows: taxEstimate
        ? [
            { Metric: "Profit Before Tax", Amount: taxEstimate.profitBeforeTax },
            { Metric: "Estimated Social Contributions", Amount: taxEstimate.estimatedSocialContributions },
            { Metric: "Deduction For Contributions", Amount: taxEstimate.deductionForContributions },
            { Metric: "Taxable Income", Amount: taxEstimate.taxableIncome },
            { Metric: "Estimated Income Tax", Amount: taxEstimate.estimatedIncomeTax },
            { Metric: "Total Estimated Tax", Amount: taxEstimate.totalEstimatedTax },
            ...taxEstimate.notes.map((note) => ({ Metric: "Note", Amount: note }))
          ]
        : [{ Metric: "Error", Amount: "Missing tax configuration." }]
    },
    {
      name: "SelectedYear_NE_Draft",
      rows: [
        ...Object.entries(neDraft.incomeLines).map(([line, amount]) => ({
          Section: "Income",
          Line: line,
          Amount: amount
        })),
        ...Object.entries(neDraft.expenseLines).map(([line, amount]) => ({
          Section: "Expense",
          Line: line,
          Amount: amount
        })),
        { Section: "Totals", Line: "totalIncome", Amount: neDraft.totalIncome },
        { Section: "Totals", Line: "totalExpenses", Amount: neDraft.totalExpenses },
        { Section: "Result", Line: "R47_overskottUnderskott", Amount: neDraft.R47_overskottUnderskott },
        { Section: "Result", Line: "R48_skattemassigResultat", Amount: neDraft.R48_skattemassigResultat },
        {
          Section: "Adjustment",
          Line: "perisFond_withdrawal",
          Amount: neDraft.taxAdjustments.perisFond_withdrawal
        },
        {
          Section: "Adjustment",
          Line: "perisFond_allocation",
          Amount: neDraft.taxAdjustments.perisFond_allocation
        },
        {
          Section: "Adjustment",
          Line: "expFond_withdrawal",
          Amount: neDraft.taxAdjustments.expFond_withdrawal
        },
        {
          Section: "Adjustment",
          Line: "expFond_allocation",
          Amount: neDraft.taxAdjustments.expFond_allocation
        },
        ...neDraft.notes.map((note) => ({ Section: "Note", Line: "", Amount: note }))
      ]
    },
    {
      name: "Ledger_Totals",
      rows: [
        {
          Scope: `Selected Year ${taxYearLabel}`,
          Entries: selectedPeriodTotals.entries,
          TotalGrossAmount: selectedPeriodTotals.gross,
          TotalNetAmount: selectedPeriodTotals.net,
          TotalVatAmount: selectedPeriodTotals.vat,
          RevenueNetAmount: selectedPeriodTotals.revenue,
          ExpensesNetAmount: selectedPeriodTotals.expenses,
          OperatingProfitLoss: selectedPeriodTotals.operatingProfit,
          Currencies: selectedPeriodTotals.currencies
        },
        {
          Scope: "All Time",
          Entries: allTimeTotals.entries,
          TotalGrossAmount: allTimeTotals.gross,
          TotalNetAmount: allTimeTotals.net,
          TotalVatAmount: allTimeTotals.vat,
          RevenueNetAmount: allTimeTotals.revenue,
          ExpensesNetAmount: allTimeTotals.expenses,
          OperatingProfitLoss: allTimeTotals.operatingProfit,
          Currencies: allTimeTotals.currencies
        }
      ]
    },
    {
      name: "Ledger_Transactions",
      rows: transactions.map((transaction) => ({
        Date: dateIso(transaction.txnDate),
        Description: transaction.description,
        Vendor: transaction.receipt?.vendor ?? transaction.paidInvoice?.customerName ?? null,
        Direction: transaction.direction,
        GrossAmount: asNumber(transaction.grossAmount),
        NetAmount: asNumber(transaction.netAmount),
        VatAmount: asNumber(transaction.vatAmount),
        VatRate: asNumber(transaction.vatRate),
        Currency: transaction.currency,
        SourceCurrency: transaction.sourceCurrency ?? null,
        FxRateToSek: transaction.fxRateToSek !== null ? asNumber(transaction.fxRateToSek) : null,
        Source: transaction.source,
        Reference: transaction.reference ?? null,
        ReceiptId: transaction.receiptId ?? null,
        InvoiceId: transaction.paidInvoice?.id ?? null,
        InvoiceNumber: transaction.paidInvoice?.invoiceNumber ?? null,
        Journal: transaction.lines
          .map((line) => {
            const debit = asNumber(line.debit);
            const credit = asNumber(line.credit);
            const amount = debit > 0 ? `D ${debit.toFixed(2)}` : `C ${credit.toFixed(2)}`;
            return `${line.account.code} ${amount}`;
          })
          .join(" | "),
        CreatedAt: dateIso(transaction.createdAt)
      }))
    },
    {
      name: "Receipts",
      rows: receipts.map((receipt) => ({
        IssueDate: dateIso(receipt.receiptDate),
        RecordedDate: dateIso(receipt.createdAt),
        ReceiptNumber: receipt.receiptNumber ?? null,
        Vendor: receipt.vendor ?? null,
        ItemPurchased: receipt.itemPurchased ?? null,
        Category: receipt.category ?? null,
        FileName: receipt.originalFileName,
        Source: receipt.source,
        GrossAmount: receipt.grossAmount !== null ? asNumber(receipt.grossAmount) : null,
        NetAmount: receipt.netAmount !== null ? asNumber(receipt.netAmount) : null,
        VatAmount: receipt.vatAmount !== null ? asNumber(receipt.vatAmount) : null,
        VatRate: receipt.vatRate !== null ? asNumber(receipt.vatRate) : null,
        Currency: receipt.currency,
        SourceCurrency: receipt.sourceCurrency ?? null,
        FxRateToSek: receipt.fxRateToSek !== null ? asNumber(receipt.fxRateToSek) : null,
        NeedsReview: receipt.needsReview,
        LinkedTransactions: receipt.transactions.length
      }))
    },
    {
      name: "Invoices",
      rows: invoices.map((invoice) => ({
        InvoiceNumber: invoice.invoiceNumber,
        Customer: invoice.customerName,
        CustomerEmail: invoice.customerEmail ?? null,
        ProjectName: invoice.projectName ?? null,
        IssueDate: dateIso(invoice.issueDate),
        DueDate: dateIso(invoice.dueDate),
        Status: invoice.status,
        SubtotalAmount: asNumber(invoice.subtotalAmount),
        VatAmount: asNumber(invoice.vatAmount),
        GrossAmount: asNumber(invoice.grossAmount),
        VatRate: asNumber(invoice.vatRate),
        Currency: invoice.currency,
        SentAt: dateIso(invoice.sentAt),
        PaidAt: dateIso(invoice.paidAt),
        LinkedPaymentTransactionId: invoice.paidTransaction?.id ?? null,
        ItemCount: invoice.items.length
      }))
    },
    {
      name: "Invoice_Items",
      rows: invoices.flatMap((invoice) =>
        invoice.items.map((item) => ({
          InvoiceNumber: invoice.invoiceNumber,
          Customer: invoice.customerName,
          IssueDate: dateIso(invoice.issueDate),
          Description: item.description,
          Quantity: asNumber(item.quantity),
          UnitPrice: asNumber(item.unitPrice),
          VatMode: item.vatMode,
          VatRate: asNumber(item.vatRate),
          NetAmount: asNumber(item.netAmount),
          VatAmount: asNumber(item.vatAmount),
          TotalAmount: asNumber(item.totalAmount)
        }))
      )
    },
    {
      name: "Customers",
      rows: customers.map((customer) => ({
        Name: customer.name,
        Email: customer.email ?? null,
        Phone: customer.phone ?? null,
        Website: customer.website ?? null,
        AddressLine1: customer.addressLine1 ?? null,
        AddressLine2: customer.addressLine2 ?? null,
        City: customer.city ?? null,
        PostalCode: customer.postalCode ?? null,
        Country: customer.country ?? null,
        Notes: customer.notes ?? null,
        CreatedAt: dateIso(customer.createdAt)
      }))
    },
    {
      name: "Employees",
      rows: employeesPayroll.map((employee) => ({
        Employee: `${employee.firstName} ${employee.lastName}`.trim(),
        EmployeeNumber: employee.employeeNumber ?? null,
        PersonalNumber: employee.personalNumber,
        Email: employee.email ?? null,
        Phone: employee.phone ?? null,
        TaxTable: employee.taxTable ?? null,
        PreliminaryTaxRate: asNumber(employee.preliminaryTaxRate),
        EmployerContributionRate: asNumber(employee.employerContributionRate),
        PensionRate: asNumber(employee.pensionRate),
        BankAccountName: employee.bankAccountName ?? null,
        BankClearingNumber: employee.bankClearingNumber ?? null,
        BankAccountNumber: employee.bankAccountNumber ?? null,
        IBAN: employee.iban ?? null,
        BIC: employee.bic ?? null,
        Status: employee.status
      }))
    },
    {
      name: "Salary_Entries",
      rows: salaryEntries.map((entry) => ({
        PayrollDate: dateIso(entry.payrollDate),
        PeriodFrom: dateIso(entry.periodFrom),
        PeriodTo: dateIso(entry.periodTo),
        Employee: `${entry.employee.firstName} ${entry.employee.lastName}`.trim(),
        EmployeeNumber: entry.employee.employeeNumber ?? null,
        GrossSalary: asNumber(entry.grossSalary),
        BonusAmount: asNumber(entry.bonusAmount),
        OvertimeAmount: asNumber(entry.overtimeAmount),
        BenefitsAmount: asNumber(entry.benefitsAmount),
        TaxableGross: asNumber(entry.taxableGross),
        PreliminaryTaxRate: asNumber(entry.preliminaryTaxRate),
        PreliminaryTaxAmount: asNumber(entry.preliminaryTaxAmount),
        EmployerContributionRate: asNumber(entry.employerContributionRate),
        EmployerContributionAmount: asNumber(entry.employerContributionAmount),
        PensionRate: asNumber(entry.pensionRate),
        PensionAmount: asNumber(entry.pensionAmount),
        NetSalary: asNumber(entry.netSalary),
        Status: entry.status,
        ApprovedAt: dateIso(entry.approvedAt),
        PaidAt: dateIso(entry.paidAt),
        PaymentReference: entry.paymentReference ?? null,
        LedgerTransactionId: entry.transactionId ?? null
      }))
    },
    {
      name: "Salary_Running_Totals",
      rows: salaryRunningRows
    },
    {
      name: "Employee_Expenses",
      rows: employeeExpenses.map((entry) => ({
        ExpenseDate: dateIso(entry.expenseDate),
        Employee: `${entry.employee.firstName} ${entry.employee.lastName}`.trim(),
        EmployeeNumber: entry.employee.employeeNumber ?? null,
        Category: entry.category,
        Description: entry.description,
        GrossAmount: asNumber(entry.grossAmount),
        VatAmount: asNumber(entry.vatAmount),
        NetAmount: asNumber(entry.netAmount),
        Currency: entry.currency,
        Status: entry.status,
        ReceiptReference: entry.receiptReference ?? null,
        PaymentReference: entry.paymentReference ?? null,
        ApprovedAt: dateIso(entry.approvedAt),
        PaidAt: dateIso(entry.paidAt),
        LedgerTransactionId: entry.transactionId ?? null
      }))
    },
    {
      name: "Chart_Of_Accounts",
      rows: accounts.map((account) => ({
        Code: account.code,
        Name: account.name,
        Type: account.type,
        VatCode: account.vatCode ?? null,
        IsSystem: account.isSystem
      }))
    },
    {
      name: "Bank_Import_Batches",
      rows: bankImportBatches.map((batch) => ({
        Date: dateIso(batch.createdAt),
        FileName: batch.fileName,
        ImportedRows: batch.importedRows,
        AcceptedRows: batch.acceptedRows,
        RejectedRows: batch.rejectedRows
      }))
    },
    {
      name: "Bank_Import_Rows",
      rows: bankImportRows.map((row) => ({
        BatchFileName: row.batch.fileName,
        BatchDate: dateIso(row.batch.createdAt),
        RowNumber: row.rowNumber,
        TxnDate: dateIso(row.txnDate),
        Description: row.description,
        Amount: asNumber(row.amount),
        Status: row.status,
        RejectionReason: row.rejectionReason ?? null,
        TransactionId: row.transactionId ?? null
      }))
    },
    {
      name: "Fixed_Assets",
      rows: fixedAssets.map((asset) => ({
        Description: asset.description,
        Category: asset.category,
        AcquisitionDate: dateIso(asset.acquisitionDate),
        AcquisitionCost: asNumber(asset.acquisitionCost),
        DepreciationMethod: asset.depreciationMethod,
        DisposalDate: dateIso(asset.disposalDate),
        DisposalValue: asset.disposalValue !== null ? asNumber(asset.disposalValue) : null,
        Notes: asset.notes ?? null,
        CreatedAt: dateIso(asset.createdAt)
      }))
    },
    {
      name: "Mileage",
      rows: mileageEntries.map((entry) => ({
        TripDate: dateIso(entry.tripDate),
        Destination: entry.destination,
        Purpose: entry.purpose,
        Kilometers: asNumber(entry.kilometers),
        RatePerKm: asNumber(entry.ratePerKm),
        DeductionAmount: asNumber(entry.deductionAmount),
        Notes: entry.notes ?? null
      }))
    },
    {
      name: "Periodisation",
      rows: periodisationEntries.map((entry) => ({
        TaxYear: entry.taxYear,
        EntryType: entry.entryType,
        Direction: entry.direction,
        Amount: asNumber(entry.amount),
        Notes: entry.notes ?? null,
        CreatedAt: dateIso(entry.createdAt)
      }))
    },
    {
      name: "Tax_Config",
      rows: business.taxConfig
        ? [
            {
              MunicipalTaxRate: asNumber(business.taxConfig.municipalTaxRate),
              SocialContributionRate: asNumber(business.taxConfig.socialContributionRate),
              GeneralDeductionRate: asNumber(business.taxConfig.generalDeductionRate),
              VatStandardRate: asNumber(business.taxConfig.vatStandardRate),
              VatReducedRateFood: asNumber(business.taxConfig.vatReducedRateFood),
              VatReducedRateCulture: asNumber(business.taxConfig.vatReducedRateCulture)
            }
          ]
        : [{ Message: "No tax configuration found." }]
    }
  ];

  sheets.forEach((sheet, index) => appendSheet(workbook, sheet.name, sheet.rows, index));

  const workbookBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const fileName = `${sanitizeFileNamePart(business.name)}-accounts-${selectedYear}.xlsx`;

  return new NextResponse(new Uint8Array(workbookBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=${fileName}`
    }
  });
}
