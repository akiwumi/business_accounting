import * as XLSX from "xlsx";

type ProfitLossReport = Awaited<ReturnType<typeof import("./reports").buildProfitAndLoss>>;
type BalanceSheetReport = Awaited<ReturnType<typeof import("./reports").buildBalanceSheet>>;
type VatReport = Awaited<ReturnType<typeof import("./reports").buildVatReport>>;
type TaxEstimate = {
  profitBeforeTax: number;
  estimatedSocialContributions: number;
  deductionForContributions: number;
  taxableIncome: number;
  estimatedIncomeTax: number;
  totalEstimatedTax: number;
  notes: string[];
};
type NeDraft = Awaited<ReturnType<typeof import("./reports").buildNeBilagaDraft>>;

export const buildAccountingWorkbook = (data: {
  profitAndLoss: ProfitLossReport;
  balanceSheet: BalanceSheetReport;
  vat: VatReport;
  taxEstimate: TaxEstimate;
  neDraft: NeDraft;
}) => {
  const workbook = XLSX.utils.book_new();

  const pnlRows = [
    ["Metric", "Amount"],
    ["Revenue", data.profitAndLoss.revenue],
    ["Expenses", data.profitAndLoss.expenses],
    ["Operating Profit", data.profitAndLoss.operatingProfit],
    [],
    ["Revenue Accounts", ""],
    ...data.profitAndLoss.incomeAccounts.map((item) => [`${item.accountCode} ${item.accountName}`, item.amount]),
    [],
    ["Expense Accounts", ""],
    ...data.profitAndLoss.expenseAccounts.map((item) => [`${item.accountCode} ${item.accountName}`, item.amount])
  ];

  const balanceRows = [
    ["Metric", "Amount"],
    ["Total Assets", data.balanceSheet.totalAssets],
    ["Total Liabilities", data.balanceSheet.totalLiabilities],
    ["Total Equity", data.balanceSheet.totalEquity],
    ["Current Year Result", data.balanceSheet.currentYearResult],
    ["Liabilities + Equity", data.balanceSheet.liabilitiesAndEquity],
    ["Difference", data.balanceSheet.difference],
    [],
    ["Assets", ""],
    ...data.balanceSheet.assets.map((item) => [`${item.accountCode} ${item.accountName}`, item.amount]),
    [],
    ["Liabilities", ""],
    ...data.balanceSheet.liabilities.map((item) => [`${item.accountCode} ${item.accountName}`, item.amount]),
    [],
    ["Equity", ""],
    ...data.balanceSheet.equity.map((item) => [`${item.accountCode} ${item.accountName}`, item.amount])
  ];

  const vatRows = [
    ["Metric", "Amount"],
    ["Taxable Sales", data.vat.taxableSales],
    ["Taxable Purchases", data.vat.taxablePurchases],
    ["Output VAT", data.vat.outputVat],
    ["Input VAT", data.vat.inputVat],
    ["VAT Payable", data.vat.vatPayable]
  ];

  const taxRows = [
    ["Metric", "Amount"],
    ["Profit Before Tax", data.taxEstimate.profitBeforeTax],
    ["Estimated Social Contributions", data.taxEstimate.estimatedSocialContributions],
    ["Deduction For Contributions", data.taxEstimate.deductionForContributions],
    ["Taxable Income", data.taxEstimate.taxableIncome],
    ["Estimated Income Tax", data.taxEstimate.estimatedIncomeTax],
    ["Total Estimated Tax", data.taxEstimate.totalEstimatedTax],
    [],
    ["Notes", ""],
    ...data.taxEstimate.notes.map((note) => [note, ""])
  ];

  const neRows = [
    ["Section", "NE Line", "Amount"],
    ...Object.entries(data.neDraft.incomeLines).map(([key, value]) => ["Income", key, value]),
    ...Object.entries(data.neDraft.expenseLines).map(([key, value]) => ["Expense", key, value]),
    ["Totals", "totalIncome", data.neDraft.totalIncome],
    ["Totals", "totalExpenses", data.neDraft.totalExpenses],
    ["Result", "R47_overskottUnderskott", data.neDraft.R47_overskottUnderskott],
    ["Result", "R48_skattemassigResultat", data.neDraft.R48_skattemassigResultat],
    ["Adjustment", "perisFond_withdrawal", data.neDraft.taxAdjustments.perisFond_withdrawal],
    ["Adjustment", "perisFond_allocation", data.neDraft.taxAdjustments.perisFond_allocation],
    ["Adjustment", "expFond_withdrawal", data.neDraft.taxAdjustments.expFond_withdrawal],
    ["Adjustment", "expFond_allocation", data.neDraft.taxAdjustments.expFond_allocation],
    ["Supplementary", "fixedAssetCount", data.neDraft.supplementary.fixedAssetCount],
    ["Supplementary", "mileageDeduction", data.neDraft.supplementary.mileageDeduction],
    [],
    ["Notes", ""],
    ...data.neDraft.notes.map((note) => [note, ""])
  ];

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(pnlRows), "ProfitLoss");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(balanceRows), "BalanceSheet");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(vatRows), "VAT");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(taxRows), "TaxEstimate");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(neRows), "NE_Draft");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};
