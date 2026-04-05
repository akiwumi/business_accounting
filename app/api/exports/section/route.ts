import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { buildAccountingWorkbook } from "@/lib/accounting/excel";
import { asNumber, round2 } from "@/lib/accounting/math";
import { buildSimplePdf } from "@/lib/accounting/pdf";
import {
  buildBalanceSheet,
  buildDashboardSummary,
  buildNeBilagaDraft,
  buildProfitAndLoss,
  buildVatReport
} from "@/lib/accounting/reports";
import { ensureBusiness } from "@/lib/data/business";
import {
  calendarMonthPeriod,
  calendarYearPeriod,
  fiscalYearPeriod,
  formatTaxYearLabel,
  getFiscalYearEndMonth,
  getFiscalYearStartMonth,
  getLatestClosedTaxYear as getLatestClosedFiscalTaxYear,
  parseMonth,
  parseTaxYear,
  resolveReportPeriod
} from "@/lib/data/period";
import { PAYROLL_PRISMA_NOT_READY, isPayrollPrismaReady, prisma } from "@/lib/db";
import { type Jurisdiction } from "@/lib/domain/enums";
import { isExportSection, type ExportSection } from "@/lib/exports/sections";
import { getTaxEngine } from "@/lib/tax/engines";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExportFormat = "excel" | "pdf";
type CellValue = string | number | boolean | null;
type ExportTable = {
  name: string;
  rows: Array<Record<string, CellValue>>;
};

type ExportResult = {
  section: ExportSection;
  title: string;
  subtitle?: string;
  tables: ExportTable[];
  workbookBuffer?: Buffer;
};

const parseDateParam = (value: string | null, endOfDay = false) => {
  if (!value) return null;
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const parsed = new Date(`${value}${suffix}`);
  if (Number.isNaN(parsed.valueOf())) return null;
  return parsed;
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
    .replace(/^-+|-+$/g, "") || "export";

const buildWorkbookFromTables = (tables: ExportTable[]) => {
  const workbook = XLSX.utils.book_new();

  tables.forEach((table, index) => {
    const rows = table.rows.length > 0 ? table.rows : [{ Message: "No data" }];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, toSheetName(table.name, index));
  });

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

const tablesToPdfLines = (tables: ExportTable[]) => {
  const lines: string[] = [];

  tables.forEach((table) => {
    lines.push(`[${table.name}]`);
    if (table.rows.length === 0) {
      lines.push("No data");
      lines.push("");
      return;
    }

    table.rows.forEach((row) => {
      const serialized = Object.entries(row)
        .map(([key, value]) => `${key}: ${value === null ? "-" : String(value)}`)
        .join(" | ");
      lines.push(serialized);
    });
    lines.push("");
  });

  return lines;
};

const buildDashboardExport = async (params: URLSearchParams): Promise<ExportResult> => {
  const business = await ensureBusiness();
  const fiscalYearStartMonth = getFiscalYearStartMonth(business.fiscalYearStart);
  const selectedYear = parseTaxYear(params.get("year")) ?? getLatestClosedFiscalTaxYear(fiscalYearStartMonth);
  const period = fiscalYearPeriod(selectedYear, fiscalYearStartMonth);
  const taxYearLabel = formatTaxYearLabel(selectedYear, fiscalYearStartMonth);
  const [summary, transactionCount, receiptCount] = await Promise.all([
    buildDashboardSummary({
      businessId: business.id,
      ...period
    }),
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

  return {
    section: "dashboard",
    title: "Dashboard Export",
    subtitle: `${business.name} | ${business.jurisdiction} | ${taxYearLabel}`,
    tables: [
      {
        name: "Business",
        rows: [
          {
            Name: business.name,
            Jurisdiction: business.jurisdiction,
            Method: business.bookkeepingMethod,
            VatFrequency: business.vatFrequency,
            BaseCurrency: business.baseCurrency
          }
        ]
      },
      {
        name: "Summary",
        rows: [
          { Metric: `Revenue (${taxYearLabel})`, Value: summary.revenue },
          { Metric: `Expenses (${taxYearLabel})`, Value: summary.expenses },
          { Metric: `Operating Profit (${taxYearLabel})`, Value: summary.operatingProfit },
          { Metric: "Estimated VAT Payable", Value: summary.vatPayable },
          { Metric: "Output VAT (Running)", Value: summary.vatOutput },
          { Metric: "Input VAT (Running)", Value: summary.vatInput },
          { Metric: "Transactions Posted", Value: transactionCount },
          { Metric: "Receipts Stored", Value: receiptCount }
        ]
      }
    ]
  };
};

const buildReceiptsExport = async (params: URLSearchParams): Promise<ExportResult> => {
  const business = await ensureBusiness();
  const selectedYear = parseTaxYear(params.get("year")) ?? new Date().getUTCFullYear();
  const selectedMonth = parseMonth(params.get("month"));
  const query = params.get("q")?.trim() || "";
  const period = selectedMonth ? calendarMonthPeriod(selectedYear, selectedMonth) : calendarYearPeriod(selectedYear);

  const receipts = await prisma.receipt.findMany({
    where: {
      businessId: business.id,
      AND: [
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
        },
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
      ]
    },
    include: { transactions: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
    take: 1000
  });

  return {
    section: "receipts",
    title: "Receipts Export",
    subtitle: `${business.name} | ${selectedYear}${selectedMonth ? `-${String(selectedMonth).padStart(2, "0")}` : ""}`,
    tables: [
      {
        name: "Receipts",
        rows: receipts.map((receipt) => ({
          IssueDate: dateIso(receipt.receiptDate),
          RecordedDate: dateIso(receipt.createdAt),
          ReceiptNumber: receipt.receiptNumber ?? null,
          Vendor: receipt.vendor ?? null,
          File: receipt.originalFileName,
          Source: receipt.source,
          GrossAmount: receipt.grossAmount !== null ? asNumber(receipt.grossAmount) : null,
          NetAmount: receipt.netAmount !== null ? asNumber(receipt.netAmount) : null,
          VatAmount: receipt.vatAmount !== null ? asNumber(receipt.vatAmount) : null,
          Currency: receipt.currency,
          SourceCurrency: receipt.sourceCurrency ?? null,
          FxRateToSek: receipt.fxRateToSek !== null ? asNumber(receipt.fxRateToSek) : null,
          NeedsReview: receipt.needsReview,
          LinkedTransactions: receipt.transactions.length
        }))
      }
    ]
  };
};

const buildInvoicesExport = async (params: URLSearchParams): Promise<ExportResult> => {
  const business = await ensureBusiness();
  const selectedYear = parseTaxYear(params.get("year")) ?? new Date().getUTCFullYear();
  const selectedMonth = parseMonth(params.get("month"));
  const query = params.get("q")?.trim() || "";
  const period = selectedMonth ? calendarMonthPeriod(selectedYear, selectedMonth) : calendarYearPeriod(selectedYear);

  const invoices = await prisma.invoice.findMany({
    where: {
      businessId: business.id,
      issueDate: {
        gte: period.from,
        lte: period.to
      },
      ...(query
        ? {
            OR: [
              { invoiceNumber: { contains: query } },
              { customerName: { contains: query } },
              { projectName: { contains: query } }
            ]
          }
        : {})
    },
    include: {
      paidTransaction: { select: { id: true } },
      items: { select: { id: true } }
    },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    take: 1000
  });

  return {
    section: "invoices",
    title: "Invoices Export",
    subtitle: `${business.name} | ${selectedYear}${selectedMonth ? `-${String(selectedMonth).padStart(2, "0")}` : ""}`,
    tables: [
      {
        name: "Invoices",
        rows: invoices.map((invoice) => ({
          InvoiceNumber: invoice.invoiceNumber,
          Customer: invoice.customerName,
          CustomerEmail: invoice.customerEmail ?? null,
          Project: invoice.projectName ?? null,
          IssueDate: dateIso(invoice.issueDate),
          DueDate: dateIso(invoice.dueDate),
          Description: invoice.description ?? null,
          Notes: invoice.notes ?? null,
          SubtotalAmount: asNumber(invoice.subtotalAmount),
          VatAmount: asNumber(invoice.vatAmount),
          GrossAmount: asNumber(invoice.grossAmount),
          VatRate: asNumber(invoice.vatRate),
          Currency: invoice.currency,
          Status: invoice.status,
          EmailTo: invoice.emailTo ?? null,
          SentAt: dateIso(invoice.sentAt),
          PaidAt: dateIso(invoice.paidAt),
          PaidTransactionId: invoice.paidTransaction?.id ?? null,
          ItemCount: invoice.items.length
        }))
      }
    ]
  };
};

const buildImportsExport = async (): Promise<ExportResult> => {
  const business = await ensureBusiness();
  const batches = await prisma.bankImportBatch.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    take: 1000
  });

  return {
    section: "imports",
    title: "Bank Imports Export",
    subtitle: business.name,
    tables: [
      {
        name: "Import Batches",
        rows: batches.map((batch) => ({
          Date: dateIso(batch.createdAt),
          FileName: batch.fileName,
          ImportedRows: batch.importedRows,
          AcceptedRows: batch.acceptedRows,
          RejectedRows: batch.rejectedRows
        }))
      }
    ]
  };
};

const buildTransactionsExport = async (): Promise<ExportResult> => {
  const business = await ensureBusiness();
  const transactions = await prisma.transaction.findMany({
    where: { businessId: business.id },
    include: {
      receipt: { select: { id: true, vendor: true } },
      paidInvoice: { select: { customerName: true, invoiceNumber: true } },
      lines: { include: { account: true } }
    },
    orderBy: [{ txnDate: "desc" }, { createdAt: "desc" }],
    take: 1000
  });

  return {
    section: "transactions",
    title: "Transactions Export",
    subtitle: business.name,
    tables: [
      {
        name: "Transactions",
        rows: transactions.map((txn) => ({
          Date: dateIso(txn.txnDate),
          Description: txn.description,
          Vendor: txn.receipt?.vendor ?? txn.paidInvoice?.customerName ?? null,
          Direction: txn.direction,
          GrossAmount: asNumber(txn.grossAmount),
          NetAmount: asNumber(txn.netAmount),
          VatAmount: asNumber(txn.vatAmount),
          VatRate: asNumber(txn.vatRate),
          Currency: txn.currency,
          SourceCurrency: txn.sourceCurrency ?? null,
          FxRateToSek: txn.fxRateToSek !== null ? asNumber(txn.fxRateToSek) : null,
          Source: txn.source,
          Reference: txn.reference ?? null,
          LinkedReceiptId: txn.receiptId ?? null,
          Journal: txn.lines
            .map((line) => {
              const debit = asNumber(line.debit);
              const credit = asNumber(line.credit);
              const amount = debit > 0 ? `D ${debit.toFixed(2)}` : `C ${credit.toFixed(2)}`;
              return `${line.account.code} ${amount}`;
            })
            .join(" | ")
        }))
      }
    ]
  };
};

const buildSalariesExport = async (params: URLSearchParams): Promise<ExportResult> => {
  const business = await ensureBusiness();
  if (!isPayrollPrismaReady()) {
    return {
      section: "salaries",
      title: "Salaries Export",
      subtitle: business.name,
      tables: [
        {
          name: "Status",
          rows: [{ Message: PAYROLL_PRISMA_NOT_READY }]
        }
      ]
    };
  }

  const fiscalYearStartMonth = getFiscalYearStartMonth(business.fiscalYearStart);
  const selectedYear = parseTaxYear(params.get("year"));
  const selectedYearPeriod = selectedYear ? fiscalYearPeriod(selectedYear, fiscalYearStartMonth) : null;
  const from = selectedYearPeriod?.from ?? parseDateParam(params.get("from"));
  const to = selectedYearPeriod?.to ?? parseDateParam(params.get("to"), true);

  const [employees, salaryEntries, expenseClaims] = await Promise.all([
    prisma.employee.findMany({
      where: { businessId: business.id },
      orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }]
    }),
    prisma.salaryEntry.findMany({
      where: {
        businessId: business.id,
        ...(from || to
          ? {
              payrollDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {})
              }
            }
          : {})
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true
          }
        }
      },
      orderBy: [{ payrollDate: "asc" }, { createdAt: "asc" }],
      take: 5000
    }),
    prisma.employeeExpense.findMany({
      where: {
        businessId: business.id,
        ...(from || to
          ? {
              expenseDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {})
              }
            }
          : {})
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true
          }
        }
      },
      orderBy: [{ expenseDate: "asc" }, { createdAt: "asc" }],
      take: 5000
    })
  ]);

  const runningSalaryRows: Array<Record<string, CellValue>> = [];
  let cumulativeGross = 0;
  let cumulativeTax = 0;
  let cumulativeEmployer = 0;
  let cumulativePension = 0;
  let cumulativeNet = 0;

  for (const entry of salaryEntries) {
    cumulativeGross += asNumber(entry.taxableGross);
    cumulativeTax += asNumber(entry.preliminaryTaxAmount);
    cumulativeEmployer += asNumber(entry.employerContributionAmount);
    cumulativePension += asNumber(entry.pensionAmount);
    cumulativeNet += asNumber(entry.netSalary);
    runningSalaryRows.push({
      PayrollDate: dateIso(entry.payrollDate),
      Employee: `${entry.employee.firstName} ${entry.employee.lastName}`.trim(),
      EmployeeNumber: entry.employee.employeeNumber ?? null,
      SalaryEntryId: entry.id,
      GrossThisEntry: asNumber(entry.taxableGross),
      TaxThisEntry: asNumber(entry.preliminaryTaxAmount),
      EmployerContributionThisEntry: asNumber(entry.employerContributionAmount),
      PensionThisEntry: asNumber(entry.pensionAmount),
      NetThisEntry: asNumber(entry.netSalary),
      RunningGrossTotal: round2(cumulativeGross),
      RunningTaxTotal: round2(cumulativeTax),
      RunningEmployerContributionTotal: round2(cumulativeEmployer),
      RunningPensionTotal: round2(cumulativePension),
      RunningNetTotal: round2(cumulativeNet)
    });
  }

  const employeeTotalsMap = new Map<
    string,
    {
      employeeId: string;
      employee: string;
      employeeNumber: string | null;
      salaryGross: number;
      salaryTax: number;
      salaryEmployer: number;
      salaryPension: number;
      salaryNet: number;
      salaryCount: number;
      expenseGross: number;
      expenseVat: number;
      expenseNet: number;
      expenseCount: number;
    }
  >();

  for (const employee of employees) {
    employeeTotalsMap.set(employee.id, {
      employeeId: employee.id,
      employee: `${employee.firstName} ${employee.lastName}`.trim(),
      employeeNumber: employee.employeeNumber ?? null,
      salaryGross: 0,
      salaryTax: 0,
      salaryEmployer: 0,
      salaryPension: 0,
      salaryNet: 0,
      salaryCount: 0,
      expenseGross: 0,
      expenseVat: 0,
      expenseNet: 0,
      expenseCount: 0
    });
  }

  for (const entry of salaryEntries) {
    const totals = employeeTotalsMap.get(entry.employeeId);
    if (!totals) continue;
    totals.salaryGross += asNumber(entry.taxableGross);
    totals.salaryTax += asNumber(entry.preliminaryTaxAmount);
    totals.salaryEmployer += asNumber(entry.employerContributionAmount);
    totals.salaryPension += asNumber(entry.pensionAmount);
    totals.salaryNet += asNumber(entry.netSalary);
    totals.salaryCount += 1;
  }

  for (const entry of expenseClaims) {
    const totals = employeeTotalsMap.get(entry.employeeId);
    if (!totals) continue;
    totals.expenseGross += asNumber(entry.grossAmount);
    totals.expenseVat += asNumber(entry.vatAmount);
    totals.expenseNet += asNumber(entry.netAmount);
    totals.expenseCount += 1;
  }

  const totalsRows = [...employeeTotalsMap.values()].map((totals) => ({
    Employee: totals.employee,
    EmployeeNumber: totals.employeeNumber,
    SalaryGrossTotal: round2(totals.salaryGross),
    SalaryTaxTotal: round2(totals.salaryTax),
    SalaryEmployerContributionTotal: round2(totals.salaryEmployer),
    SalaryPensionTotal: round2(totals.salaryPension),
    SalaryNetTotal: round2(totals.salaryNet),
    SalaryRunCount: totals.salaryCount,
    ExpenseGrossTotal: round2(totals.expenseGross),
    ExpenseVatTotal: round2(totals.expenseVat),
    ExpenseNetTotal: round2(totals.expenseNet),
    ExpenseCount: totals.expenseCount
  }));

  const overallTotals = totalsRows.reduce(
    (accumulator, row) => {
      accumulator.SalaryGrossTotal += asNumber(row.SalaryGrossTotal);
      accumulator.SalaryTaxTotal += asNumber(row.SalaryTaxTotal);
      accumulator.SalaryEmployerContributionTotal += asNumber(row.SalaryEmployerContributionTotal);
      accumulator.SalaryPensionTotal += asNumber(row.SalaryPensionTotal);
      accumulator.SalaryNetTotal += asNumber(row.SalaryNetTotal);
      accumulator.ExpenseGrossTotal += asNumber(row.ExpenseGrossTotal);
      accumulator.ExpenseVatTotal += asNumber(row.ExpenseVatTotal);
      accumulator.ExpenseNetTotal += asNumber(row.ExpenseNetTotal);
      return accumulator;
    },
    {
      SalaryGrossTotal: 0,
      SalaryTaxTotal: 0,
      SalaryEmployerContributionTotal: 0,
      SalaryPensionTotal: 0,
      SalaryNetTotal: 0,
      ExpenseGrossTotal: 0,
      ExpenseVatTotal: 0,
      ExpenseNetTotal: 0
    }
  );

  return {
    section: "salaries",
    title: "Salaries Export",
    subtitle: `${business.name}${
      selectedYear
        ? ` | Tax Year ${formatTaxYearLabel(selectedYear, fiscalYearStartMonth)}`
        : from || to
          ? ` | ${dateIso(from)} to ${dateIso(to)}`
          : ""
    }`,
    tables: [
      {
        name: "Employees",
        rows: employees.map((employee) => ({
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
        name: "Salary Entries",
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
        name: "Running Salary Totals",
        rows: runningSalaryRows
      },
      {
        name: "Expense Claims",
        rows: expenseClaims.map((entry) => ({
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
        name: "Employee Totals",
        rows: totalsRows
      },
      {
        name: "Overall Totals",
        rows: [
          {
            ...Object.fromEntries(
              Object.entries(overallTotals).map(([key, value]) => [key, round2(value)])
            )
          }
        ]
      }
    ]
  };
};

const buildLedgerExport = async (params: URLSearchParams): Promise<ExportResult> => {
  const business = await ensureBusiness();
  const fiscalYearStartMonth = getFiscalYearStartMonth(business.fiscalYearStart);
  const selectedYear = parseTaxYear(params.get("year"));
  const selectedYearPeriod = selectedYear ? fiscalYearPeriod(selectedYear, fiscalYearStartMonth) : null;
  const from = selectedYearPeriod?.from ?? parseDateParam(params.get("from"));
  const to = selectedYearPeriod?.to ?? parseDateParam(params.get("to"), true);
  const source = params.get("source")?.trim();

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
      ...(source ? { source } : {})
    },
    include: {
      receipt: { select: { id: true, vendor: true } },
      paidInvoice: { select: { customerName: true, invoiceNumber: true } },
      lines: { include: { account: true } }
    },
    orderBy: [{ txnDate: "desc" }, { createdAt: "desc" }],
    take: 2000
  });

  const ledgerRows = transactions.map((txn) => ({
    Date: dateIso(txn.txnDate),
    Description: txn.description,
    Vendor: txn.receipt?.vendor ?? txn.paidInvoice?.customerName ?? null,
    Direction: txn.direction,
    GrossAmount: asNumber(txn.grossAmount),
    NetAmount: asNumber(txn.netAmount),
    VatAmount: asNumber(txn.vatAmount),
    Currency: txn.currency,
    Source: txn.source,
    Reference: txn.reference ?? null,
    Journal: txn.lines
      .map((line) => {
        const debit = asNumber(line.debit);
        const credit = asNumber(line.credit);
        const amount = debit > 0 ? `D ${debit.toFixed(2)}` : `C ${credit.toFixed(2)}`;
        return `${line.account.code} ${amount}`;
      })
      .join(" | "),
    LinkedReceiptId: txn.receiptId ?? null
  }));

  const totals = transactions.reduce(
    (accumulator, txn) => {
      const gross = asNumber(txn.grossAmount);
      const net = asNumber(txn.netAmount);
      const vat = asNumber(txn.vatAmount);

      accumulator.totalGross += Number.isFinite(gross) ? gross : 0;
      accumulator.totalNet += Number.isFinite(net) ? net : 0;
      accumulator.totalVat += Number.isFinite(vat) ? vat : 0;

      if (txn.direction === "INCOME") {
        accumulator.revenue += Number.isFinite(net) ? net : 0;
      } else if (txn.direction === "EXPENSE") {
        accumulator.expenses += Number.isFinite(net) ? net : 0;
      }

      accumulator.currencies.add((txn.currency || "").toUpperCase());
      return accumulator;
    },
    {
      totalGross: 0,
      totalNet: 0,
      totalVat: 0,
      revenue: 0,
      expenses: 0,
      currencies: new Set<string>()
    }
  );

  const operatingProfit = totals.revenue - totals.expenses;
  const currencyList = [...totals.currencies].filter(Boolean).sort();
  const rangeLabel = selectedYear
    ? `Tax Year ${formatTaxYearLabel(selectedYear, fiscalYearStartMonth)}`
    : from || to
      ? `${dateIso(from) ?? "-"} to ${dateIso(to) ?? "-"}`
      : "All Dates";

  return {
    section: "ledger",
    title: "Ledger Export",
    subtitle: `${business.name} | ${rangeLabel}${source ? ` | Source: ${source}` : ""}`,
    tables: [
      {
        name: "Ledger Entries",
        rows: ledgerRows
      },
      {
        name: "Ledger Totals",
        rows: [
          {
            EntryCount: ledgerRows.length,
            TotalGrossAmount: totals.totalGross,
            TotalNetAmount: totals.totalNet,
            TotalVatAmount: totals.totalVat,
            Currencies: currencyList.length > 0 ? currencyList.join(", ") : business.baseCurrency
          }
        ]
      },
      {
        name: "Profit and Loss",
        rows: [
          { Metric: "Revenue (Net, INCOME)", Amount: totals.revenue },
          { Metric: "Expenses (Net, EXPENSE)", Amount: totals.expenses },
          { Metric: "Operating Profit/Loss", Amount: operatingProfit }
        ]
      }
    ]
  };
};

const buildReviewExport = async (): Promise<ExportResult> => {
  const business = await ensureBusiness();
  const [needsReviewReceipts, recentReceipts, otherInputs] = await Promise.all([
    prisma.receipt.findMany({
      where: { businessId: business.id, needsReview: true },
      orderBy: { createdAt: "desc" },
      take: 1000
    }),
    prisma.receipt.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      take: 1000
    }),
    prisma.transaction.findMany({
      where: { businessId: business.id, receiptId: null },
      orderBy: [{ txnDate: "desc" }, { createdAt: "desc" }],
      take: 1000
    })
  ]);

  return {
    section: "review",
    title: "Review Export",
    subtitle: business.name,
    tables: [
      {
        name: "Needs Review",
        rows: needsReviewReceipts.map((receipt) => ({
          Date: dateIso(receipt.createdAt),
          Description: receipt.vendor ?? receipt.originalFileName,
          Source: receipt.source,
          ReceiptId: receipt.id
        }))
      },
      {
        name: "Recent Receipts",
        rows: recentReceipts.map((receipt) => ({
          Date: dateIso(receipt.createdAt),
          Description: receipt.vendor ?? receipt.originalFileName,
          Source: receipt.source,
          ReceiptId: receipt.id
        }))
      },
      {
        name: "Other Inputs",
        rows: otherInputs.map((txn) => ({
          Date: dateIso(txn.txnDate),
          Description: txn.description,
          Source: txn.source,
          TransactionId: txn.id
        }))
      }
    ]
  };
};

const buildReportsExport = async (params: URLSearchParams): Promise<ExportResult> => {
  const business = await ensureBusiness();
  const period = resolveReportPeriod(params, getFiscalYearStartMonth(business.fiscalYearStart));

  const [profitAndLoss, balanceSheet, vat, neDraft] = await Promise.all([
    buildProfitAndLoss({ businessId: business.id, ...period }),
    buildBalanceSheet({ businessId: business.id, ...period }),
    buildVatReport({ businessId: business.id, ...period }),
    buildNeBilagaDraft({ businessId: business.id, ...period })
  ]);

  if (!business.taxConfig) {
    throw new Error("Missing tax configuration.");
  }

  const engine = getTaxEngine(business.jurisdiction as Jurisdiction);
  const taxEstimate = engine.estimate({
    profitBeforeTax: profitAndLoss.operatingProfit,
    municipalTaxRate: asNumber(business.taxConfig.municipalTaxRate),
    socialContributionRate: asNumber(business.taxConfig.socialContributionRate),
    generalDeductionRate: asNumber(business.taxConfig.generalDeductionRate)
  });

  const workbookBuffer = buildAccountingWorkbook({
    profitAndLoss,
    balanceSheet,
    vat,
    taxEstimate,
    neDraft
  });

  return {
    section: "reports",
    title: "Reports Export",
    subtitle: `${dateIso(period.from)} to ${dateIso(period.to)}`,
    workbookBuffer,
    tables: [
      {
        name: "Profit and Loss",
        rows: [
          { Metric: "Revenue", Amount: profitAndLoss.revenue },
          { Metric: "Expenses", Amount: profitAndLoss.expenses },
          { Metric: "Operating Profit", Amount: profitAndLoss.operatingProfit }
        ]
      },
      {
        name: "Balance Sheet",
        rows: [
          { Metric: "Total Assets", Amount: balanceSheet.totalAssets },
          { Metric: "Total Liabilities", Amount: balanceSheet.totalLiabilities },
          { Metric: "Total Equity", Amount: balanceSheet.totalEquity },
          { Metric: "Current Year Result", Amount: balanceSheet.currentYearResult },
          { Metric: "Liabilities + Equity", Amount: balanceSheet.liabilitiesAndEquity },
          { Metric: "Difference", Amount: balanceSheet.difference }
        ]
      },
      {
        name: "VAT",
        rows: [
          { Metric: "Taxable Sales", Amount: vat.taxableSales },
          { Metric: "Taxable Purchases", Amount: vat.taxablePurchases },
          { Metric: "Output VAT", Amount: vat.outputVat },
          { Metric: "Input VAT", Amount: vat.inputVat },
          { Metric: "VAT Payable", Amount: vat.vatPayable }
        ]
      },
      {
        name: "Tax Estimate",
        rows: [
          { Metric: "Profit Before Tax", Amount: taxEstimate.profitBeforeTax },
          { Metric: "Estimated Social Contributions", Amount: taxEstimate.estimatedSocialContributions },
          { Metric: "Deduction For Contributions", Amount: taxEstimate.deductionForContributions },
          { Metric: "Taxable Income", Amount: taxEstimate.taxableIncome },
          { Metric: "Estimated Income Tax", Amount: taxEstimate.estimatedIncomeTax },
          { Metric: "Total Estimated Tax", Amount: taxEstimate.totalEstimatedTax }
        ]
      },
      {
        name: "NE Draft",
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
          {
            Section: "Supplementary",
            Line: "fixedAssetCount",
            Amount: neDraft.supplementary.fixedAssetCount
          },
          {
            Section: "Supplementary",
            Line: "mileageDeduction",
            Amount: neDraft.supplementary.mileageDeduction
          }
        ]
      }
    ]
  };
};

const buildSettingsExport = async (): Promise<ExportResult> => {
  const business = await ensureBusiness();
  const fiscalYearStartMonth = getFiscalYearStartMonth(business.fiscalYearStart);
  const fiscalYearEndMonth = getFiscalYearEndMonth(fiscalYearStartMonth);

  return {
    section: "settings",
    title: "Settings Export",
    subtitle: business.name,
    tables: [
      {
        name: "Business",
        rows: [
          {
            Name: business.name,
            Jurisdiction: business.jurisdiction,
            OrgType: business.orgType,
            BookkeepingMethod: business.bookkeepingMethod,
            VatRegistered: business.vatRegistered,
            VatFrequency: business.vatFrequency,
            FiscalYearStartMonth: fiscalYearStartMonth,
            FiscalYearEndMonth: fiscalYearEndMonth,
            FiscalYearStart: dateIso(business.fiscalYearStart),
            BaseCurrency: business.baseCurrency,
            Locale: business.locale,
            InvoiceNumberPattern: business.invoiceNumberPattern,
            NextInvoiceSequence: business.nextInvoiceSequence,
            InvoiceSenderName: business.invoiceSenderName ?? null,
            InvoiceSenderEmail: business.invoiceSenderEmail ?? null,
            InvoiceEmailFrom: business.invoiceEmailFrom ?? null
          }
        ]
      },
      {
        name: "Tax Config",
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
          : []
      }
    ]
  };
};

const buildExport = async (section: ExportSection, params: URLSearchParams): Promise<ExportResult> => {
  switch (section) {
    case "dashboard":
      return buildDashboardExport(params);
    case "receipts":
      return buildReceiptsExport(params);
    case "invoices":
      return buildInvoicesExport(params);
    case "imports":
      return buildImportsExport();
    case "transactions":
      return buildTransactionsExport();
    case "salaries":
      return buildSalariesExport(params);
    case "ledger":
      return buildLedgerExport(params);
    case "review":
      return buildReviewExport();
    case "reports":
      return buildReportsExport(params);
    case "settings":
      return buildSettingsExport();
    default:
      throw new Error("Unsupported export section.");
  }
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sectionRaw = (url.searchParams.get("section") || "").trim().toLowerCase();
  const formatRaw = (url.searchParams.get("format") || "").trim().toLowerCase();

  if (!isExportSection(sectionRaw)) {
    return NextResponse.json({ error: "Invalid export section." }, { status: 400 });
  }

  const format: ExportFormat = formatRaw === "pdf" ? "pdf" : formatRaw === "excel" ? "excel" : "excel";
  if (formatRaw && formatRaw !== "excel" && formatRaw !== "pdf") {
    return NextResponse.json({ error: "Invalid export format." }, { status: 400 });
  }

  try {
    const data = await buildExport(sectionRaw, url.searchParams);

    if (format === "excel") {
      const workbookBuffer = data.workbookBuffer ?? buildWorkbookFromTables(data.tables);
      const fileName = `${sanitizeFileNamePart(data.section)}-export.xlsx`;
      return new NextResponse(new Uint8Array(workbookBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=${fileName}`
        }
      });
    }

    const pdfLines = tablesToPdfLines(data.tables);
    const pdfBuffer = buildSimplePdf({
      title: data.title,
      subtitle: data.subtitle,
      lines: pdfLines
    });
    const fileName = `${sanitizeFileNamePart(data.section)}-export.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${fileName}`
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Export failed."
      },
      { status: 500 }
    );
  }
}
