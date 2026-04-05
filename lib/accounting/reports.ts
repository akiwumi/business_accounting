import { prisma } from "@/lib/db";
import { asNumber, round2 } from "@/lib/accounting/math";
import { AccountTypes, TransactionDirections, type AccountType } from "@/lib/domain/enums";
import { calculateTotalDepreciation, type FixedAssetInput } from "@/lib/tax/depreciation";

type PeriodInput = {
  businessId: string;
  from: Date;
  to: Date;
};

type AccountMovement = {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debit: number;
  credit: number;
  amount: number;
};

const accountSignedAmount = (type: AccountType, debit: number, credit: number): number => {
  if (type === AccountTypes.ASSET || type === AccountTypes.EXPENSE) {
    return round2(debit - credit);
  }
  return round2(credit - debit);
};

const fetchMovements = async ({ businessId, from, to }: PeriodInput): Promise<AccountMovement[]> => {
  const lines = await prisma.journalLine.findMany({
    where: {
      transaction: {
        businessId,
        txnDate: {
          gte: from,
          lte: to
        }
      }
    },
    include: {
      account: true
    }
  });

  const grouped = new Map<string, AccountMovement>();
  for (const line of lines) {
    const key = line.accountId;
    const existing = grouped.get(key);
    const debit = asNumber(line.debit as unknown as string | number);
    const credit = asNumber(line.credit as unknown as string | number);

    if (existing) {
      existing.debit = round2(existing.debit + debit);
      existing.credit = round2(existing.credit + credit);
      existing.amount = accountSignedAmount(existing.accountType, existing.debit, existing.credit);
      continue;
    }

    grouped.set(key, {
      accountCode: line.account.code,
      accountName: line.account.name,
      accountType: line.account.type as AccountType,
      debit,
      credit,
      amount: accountSignedAmount(line.account.type as AccountType, debit, credit)
    });
  }

  return [...grouped.values()].sort((a, b) => a.accountCode.localeCompare(b.accountCode));
};

export const buildProfitAndLoss = async (period: PeriodInput) => {
  const movements = await fetchMovements(period);
  const incomeAccounts = movements
    .filter((movement) => movement.accountType === AccountTypes.INCOME)
    .map((movement) => ({ ...movement, amount: Math.abs(movement.amount) }));
  const expenseAccounts = movements
    .filter((movement) => movement.accountType === AccountTypes.EXPENSE)
    .map((movement) => ({ ...movement, amount: Math.abs(movement.amount) }));

  const revenue = round2(incomeAccounts.reduce((sum, item) => sum + item.amount, 0));
  const expenses = round2(expenseAccounts.reduce((sum, item) => sum + item.amount, 0));
  const operatingProfit = round2(revenue - expenses);

  return {
    period,
    revenue,
    expenses,
    operatingProfit,
    incomeAccounts,
    expenseAccounts
  };
};

export const buildBalanceSheet = async (period: PeriodInput) => {
  const movements = await fetchMovements(period);
  const assets = movements
    .filter((movement) => movement.accountType === AccountTypes.ASSET)
    .map((movement) => ({ ...movement, amount: Math.abs(movement.amount) }));
  const liabilities = movements
    .filter((movement) => movement.accountType === AccountTypes.LIABILITY)
    .map((movement) => ({ ...movement, amount: Math.abs(movement.amount) }));
  const equity = movements
    .filter((movement) => movement.accountType === AccountTypes.EQUITY)
    .map((movement) => ({ ...movement, amount: Math.abs(movement.amount) }));

  const pnl = await buildProfitAndLoss(period);
  const currentYearResult = pnl.operatingProfit;

  const totalAssets = round2(assets.reduce((sum, item) => sum + item.amount, 0));
  const totalLiabilities = round2(liabilities.reduce((sum, item) => sum + item.amount, 0));
  const totalEquity = round2(equity.reduce((sum, item) => sum + item.amount, 0));
  const liabilitiesAndEquity = round2(totalLiabilities + totalEquity + currentYearResult);

  return {
    period,
    assets,
    liabilities,
    equity,
    currentYearResult,
    totalAssets,
    totalLiabilities,
    totalEquity,
    liabilitiesAndEquity,
    difference: round2(totalAssets - liabilitiesAndEquity)
  };
};

export const buildVatReport = async (period: PeriodInput) => {
  const transactions = await prisma.transaction.findMany({
    where: {
      businessId: period.businessId,
      txnDate: {
        gte: period.from,
        lte: period.to
      }
    },
    select: {
      direction: true,
      vatAmount: true,
      netAmount: true,
      grossAmount: true
    }
  });

  let outputVat = 0;
  let inputVat = 0;
  let taxableSales = 0;
  let taxablePurchases = 0;

  for (const transaction of transactions) {
    const vatAmount = asNumber(transaction.vatAmount as unknown as string | number);
    const netAmount = asNumber(transaction.netAmount as unknown as string | number);
    const hasVat = vatAmount > 0;

    if (transaction.direction === TransactionDirections.INCOME && hasVat) {
      outputVat = round2(outputVat + vatAmount);
      taxableSales = round2(taxableSales + netAmount);
    } else if (transaction.direction === TransactionDirections.EXPENSE && hasVat) {
      inputVat = round2(inputVat + vatAmount);
      taxablePurchases = round2(taxablePurchases + netAmount);
    }
  }

  return {
    period,
    taxableSales,
    taxablePurchases,
    outputVat,
    inputVat,
    vatPayable: round2(outputVat - inputVat)
  };
};

/**
 * buildNeBilagaDraft
 *
 * Produces a full NE-bilaga (Skatteverket NE annex) draft for the given period.
 * Covers:
 *   R10  – Nettoomsättning (Net revenue)
 *   R2   – Bidrag & försäkringsersättning (Subsidies / insurance received)
 *   R4   – Ränteintäkter (Interest income)
 *   R5   – Vinst avyttring inventarier (Gain on disposal of assets)
 *   R16  – Varor och material (Cost of goods / materials)
 *   R17  – Övriga externa kostnader (Other external costs)
 *   R18  – Personalkostnader (Personnel costs)
 *   R20  – Avskrivningar (Depreciation – from fixed asset register)
 *   R21  – Förlust avyttring inventarier (Loss on disposal of assets)
 *   R22  – Egenavgifter / arbetsgivaravgifter (Social contributions)
 *   R23  – Övriga kostnader (Other costs not in R16-R22)
 *   PeriF_ret – Återföring periodiseringsfond (Withdrawal from tax allocation reserve)
 *   PeriF_all – Avsättning periodiseringsfond (Allocation to tax allocation reserve)
 *   ExpF_ret  – Återföring expansionsfond (Withdrawal from expansion fund)
 *   ExpF_all  – Avsättning expansionsfond (Allocation to expansion fund)
 *   R47  – Överskott/underskott (Surplus/deficit before tax adjustments)
 *   R48  – Taxable result after periodiseringsfond and expansionsfond
 */
export const buildNeBilagaDraft = async (period: PeriodInput) => {
  const taxYear = period.to.getFullYear();

  // ── Fetch journal movements ───────────────────────────────────────────
  const movements = await fetchMovements(period);

  const byPrefix = (prefixes: string[]) =>
    round2(
      movements
        .filter((m) => prefixes.some((p) => m.accountCode.startsWith(p)))
        .reduce((sum, m) => sum + Math.abs(m.amount), 0)
    );

  // ── Income rows ───────────────────────────────────────────────────────
  // R10: Net revenue (3001-3590)
  const R10_revenue = byPrefix(["30", "31", "32", "33", "34", "35"]);

  // R2: Subsidies, grants, insurance compensation (3910-3980)
  const R2_subsidiesInsurance = byPrefix(["391", "392", "393", "394", "395", "396", "397", "398"]);

  // R4: Interest income (8310-8390)
  const R4_interestIncome = byPrefix(["831", "832", "833", "834", "835", "836", "837", "838", "839"]);

  // R5: Gain on disposal of assets (3973)
  const R5_disposalGain_journal = byPrefix(["3973"]);

  // ── Cost rows ─────────────────────────────────────────────────────────
  // R16: Cost of goods, materials, subcontractors (4000-4999)
  const R16_costOfGoods = byPrefix(["40", "41", "42", "43", "44", "45", "46", "47", "48", "49"]);

  // R17: Other external costs (5000-6999, excluding depreciation 78xx)
  const R17_externalCosts = byPrefix([
    "50", "51", "52", "53", "54", "55", "56", "57", "58", "59",
    "60", "61", "62", "63", "64", "65", "66", "67", "68", "69"
  ]);

  // R18: Personnel costs (7000-7799, excluding depreciation 78xx and 7970)
  const R18_personnel = byPrefix([
    "70", "71", "72", "73", "74", "75", "76", "77"
  ]);

  // R21: Loss on disposal (7970)
  const R21_disposalLoss_journal = byPrefix(["7970"]);

  // R22: Egenavgifter/arbetsgivaravgifter from journal (7570, 7410)
  const R22_socialContributions = byPrefix(["757", "741"]);

  // R23: Other costs not covered above (e.g. 8400-8499 financial costs)
  const R23_otherCosts = byPrefix(["840", "841", "842", "843", "844", "845", "846", "847", "848", "849"]);

  // ── Fixed asset depreciation (overrides journal if assets are tracked) ─
  let fixedAssets: FixedAssetInput[] = [];
  try {
    const dbAssets = await prisma.fixedAsset.findMany({
      where: { businessId: period.businessId }
    });
    fixedAssets = dbAssets.map((a) => ({
      id: a.id,
      description: a.description,
      category: a.category,
      acquisitionDate: a.acquisitionDate,
      acquisitionCost: asNumber(a.acquisitionCost as unknown as string | number),
      depreciationMethod: a.depreciationMethod,
      disposalDate: a.disposalDate ?? null,
      disposalValue: a.disposalValue ? asNumber(a.disposalValue as unknown as string | number) : null
    }));
  } catch {
    // Table may not exist yet (before migration). Fall back to journal amounts.
    fixedAssets = [];
  }

  let R20_depreciation: number;
  let R5_disposalGain: number;
  let R21_disposalLoss: number;

  if (fixedAssets.length > 0) {
    const depCalc = calculateTotalDepreciation(fixedAssets, taxYear);
    R20_depreciation = depCalc.totalYearDepreciation;
    R5_disposalGain = round2(R5_disposalGain_journal + depCalc.totalDisposalGains);
    R21_disposalLoss = round2(R21_disposalLoss_journal + depCalc.totalDisposalLosses);
  } else {
    // Fall back to journal-posted depreciation (accounts 781x-784x)
    R20_depreciation = byPrefix(["781", "782", "783", "784"]);
    R5_disposalGain = R5_disposalGain_journal;
    R21_disposalLoss = R21_disposalLoss_journal;
  }

  // ── Periodiseringsfond / Expansionsfond (manual tax adjustments) ──────
  let perisFondWithdrawal = 0;
  let perisFondAllocation = 0;
  let expFondWithdrawal = 0;
  let expFondAllocation = 0;

  try {
    const periodEntries = await prisma.periodisationEntry.findMany({
      where: {
        businessId: period.businessId,
        taxYear
      }
    });

    for (const entry of periodEntries) {
      const amount = asNumber(entry.amount as unknown as string | number);
      if (entry.entryType === "periodiseringsfond") {
        if (entry.direction === "withdrawal") perisFondWithdrawal = round2(perisFondWithdrawal + amount);
        if (entry.direction === "allocation") perisFondAllocation = round2(perisFondAllocation + amount);
      }
      if (entry.entryType === "expansionsfond") {
        if (entry.direction === "withdrawal") expFondWithdrawal = round2(expFondWithdrawal + amount);
        if (entry.direction === "allocation") expFondAllocation = round2(expFondAllocation + amount);
      }
    }
  } catch {
    // Table may not exist yet before migration.
  }

  // ── Accounting result (R47) ───────────────────────────────────────────
  // R47 = income – expenses (before tax-only adjustments)
  const totalIncome = round2(R10_revenue + R2_subsidiesInsurance + R4_interestIncome + R5_disposalGain);
  const totalExpenses = round2(
    R16_costOfGoods + R17_externalCosts + R18_personnel + R20_depreciation + R21_disposalLoss + R22_socialContributions + R23_otherCosts
  );
  const R47_accountingResult = round2(totalIncome - totalExpenses);

  // ── Taxable result (R48) after tax adjustments ────────────────────────
  // +Withdrawal from periodiseringsfond (increases taxable income)
  // -Allocation to periodiseringsfond (decreases taxable income, max 30% of R47)
  // +Withdrawal from expansionsfond (increases taxable income)
  // -Allocation to expansionsfond (decreases taxable income)
  const maxPerisFondAllocation = round2(Math.max(0, R47_accountingResult) * 0.3);
  const effectivePerisFondAllocation = Math.min(perisFondAllocation, maxPerisFondAllocation);

  const R48_taxableResult = round2(
    R47_accountingResult
    + perisFondWithdrawal
    - effectivePerisFondAllocation
    + expFondWithdrawal
    - expFondAllocation
  );

  // ── Mileage deduction ─────────────────────────────────────────────────
  let mileageDeductionTotal = 0;
  try {
    const mileageEntries = await prisma.mileageEntry.findMany({
      where: {
        businessId: period.businessId,
        tripDate: { gte: period.from, lte: period.to }
      },
      select: { deductionAmount: true }
    });
    mileageDeductionTotal = round2(
      mileageEntries.reduce((sum, e) => sum + asNumber(e.deductionAmount as unknown as string | number), 0)
    );
  } catch {
    // Table may not exist yet.
  }

  return {
    period,
    taxYear,
    // Income lines
    incomeLines: {
      R10_nettoomsattning: R10_revenue,
      R2_bidragForsäkringsersättning: R2_subsidiesInsurance,
      R4_ranteintakter: R4_interestIncome,
      R5_vinstAvyttringInventarier: R5_disposalGain
    },
    // Expense lines
    expenseLines: {
      R16_varorMaterial: R16_costOfGoods,
      R17_ovrigaExternaKostnader: R17_externalCosts,
      R18_personalkostnader: R18_personnel,
      R20_avskrivningar: R20_depreciation,
      R21_forlusAvyttringInventarier: R21_disposalLoss,
      R22_egenavgifterArbetsgivaravgifter: R22_socialContributions,
      R23_ovrigaKostnader: R23_otherCosts
    },
    // Totals
    totalIncome,
    totalExpenses,
    // R47 = accounting result
    R47_overskottUnderskott: R47_accountingResult,
    // Tax adjustments
    taxAdjustments: {
      perisFond_withdrawal: perisFondWithdrawal,
      perisFond_allocation: effectivePerisFondAllocation,
      perisFond_allocationMax: maxPerisFondAllocation,
      perisFond_allocationRequested: perisFondAllocation,
      expFond_withdrawal: expFondWithdrawal,
      expFond_allocation: expFondAllocation
    },
    // R48 = taxable result after adjustments
    R48_skattemassigResultat: R48_taxableResult,
    // Supplementary info
    supplementary: {
      fixedAssetCount: fixedAssets.length,
      mileageDeduction: mileageDeductionTotal
    },
    notes: [
      "NE-bilaga draft – verify all account mappings against official Skatteverket form before filing.",
      "R20 depreciation is sourced from the fixed asset register when assets are recorded there.",
      "Periodiseringsfond allocation is capped at 30% of R47 (accounting surplus).",
      "Mileage deductions from the körjournal are listed for reference; post to account 5810 to include in R17.",
      "Review private use adjustments (e.g. car, phone) and add any necessary corrections before filing.",
      "The taxable result (R48) feeds into Inkomstdeklaration 1, ruta 1.6 (Överskott aktiv näringsverksamhet)."
    ]
  };
};

export const buildDashboardSummary = async (period: PeriodInput) => {
  const [pnl, vat] = await Promise.all([buildProfitAndLoss(period), buildVatReport(period)]);

  return {
    revenue: pnl.revenue,
    expenses: pnl.expenses,
    operatingProfit: pnl.operatingProfit,
    vatPayable: vat.vatPayable,
    vatOutput: vat.outputVat,
    vatInput: vat.inputVat
  };
};
