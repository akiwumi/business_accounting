import { type Prisma } from "@prisma/client";

import { asNumber, round2 } from "@/lib/accounting/math";
import { calculateExpenseBreakdown, calculateSalaryBreakdown } from "@/lib/salaries/calculations";
import { convertToSekAtDate, normalizeCurrency } from "@/lib/fx/sek";
import { TransactionDirections } from "@/lib/domain/enums";

type DraftLine = {
  accountId: string;
  debit: number;
  credit: number;
  note?: string | null;
};

const getExpenseAccountCode = (category: string) => {
  const normalized = category.trim().toLowerCase();
  if (normalized.includes("travel")) return "5800";
  if (normalized.includes("meal")) return "5830";
  if (normalized.includes("equipment")) return "5410";
  if (normalized.includes("phone")) return "6212";
  if (normalized.includes("training")) return "6560";
  if (normalized.includes("representation")) return "6490";
  return "7690";
};

const rebalanceLines = (lines: DraftLine[]) => {
  const debit = round2(lines.reduce((sum, line) => sum + line.debit, 0));
  const credit = round2(lines.reduce((sum, line) => sum + line.credit, 0));
  const diff = round2(debit - credit);
  if (diff === 0) return lines;

  const counterparty = lines.find((line) => line.note === "counterparty_bank");
  if (!counterparty) {
    throw new Error("Payroll journal lines are not balanced.");
  }

  if (diff > 0) {
    counterparty.credit = round2(counterparty.credit + diff);
  } else {
    counterparty.debit = round2(counterparty.debit + Math.abs(diff));
  }
  return lines;
};

const findAccountsByCode = async (
  tx: Prisma.TransactionClient,
  businessId: string,
  codes: string[]
) => {
  const uniqueCodes = [...new Set(codes)];
  const accounts = await tx.account.findMany({
    where: {
      businessId,
      code: { in: uniqueCodes }
    }
  });

  const lookup = new Map(accounts.map((account) => [account.code, account]));
  for (const code of uniqueCodes) {
    if (!lookup.has(code)) {
      throw new Error(`Missing account ${code}. Initialize chart of accounts first.`);
    }
  }

  return lookup;
};

export const postSalaryPaymentTransaction = async (
  tx: Prisma.TransactionClient,
  input: {
    businessId: string;
    salaryEntryId: string;
    employeeName: string;
    payrollDate: Date;
    grossSalary: number;
    bonusAmount: number;
    overtimeAmount: number;
    benefitsAmount: number;
    preliminaryTaxRate: number;
    employerContributionRate: number;
    pensionRate: number;
    reference?: string | null;
  }
) => {
  const amounts = calculateSalaryBreakdown({
    grossSalary: input.grossSalary,
    bonusAmount: input.bonusAmount,
    overtimeAmount: input.overtimeAmount,
    benefitsAmount: input.benefitsAmount,
    preliminaryTaxRate: input.preliminaryTaxRate,
    employerContributionRate: input.employerContributionRate,
    pensionRate: input.pensionRate
  });

  const accountLookup = await findAccountsByCode(tx, input.businessId, ["7010", "7410", "7300", "2710", "2730", "1930"]);
  const liabilitiesSocial = round2(amounts.employerContributionAmount + amounts.pensionAmount);

  const lines: DraftLine[] = [
    {
      accountId: accountLookup.get("7010")!.id,
      debit: amounts.taxableGross,
      credit: 0,
      note: "salary_cost"
    },
    {
      accountId: accountLookup.get("7410")!.id,
      debit: amounts.employerContributionAmount,
      credit: 0,
      note: "employer_contributions_cost"
    },
    {
      accountId: accountLookup.get("7300")!.id,
      debit: amounts.pensionAmount,
      credit: 0,
      note: "pension_cost"
    },
    {
      accountId: accountLookup.get("2710")!.id,
      debit: 0,
      credit: amounts.preliminaryTaxAmount,
      note: "withheld_tax_liability"
    },
    {
      accountId: accountLookup.get("2730")!.id,
      debit: 0,
      credit: liabilitiesSocial,
      note: "social_fees_and_pension_liability"
    },
    {
      accountId: accountLookup.get("1930")!.id,
      debit: 0,
      credit: amounts.netSalary,
      note: "counterparty_bank"
    }
  ];

  rebalanceLines(lines);

  return tx.transaction.create({
    data: {
      businessId: input.businessId,
      txnDate: input.payrollDate,
      description: `Salary payment ${input.employeeName}`,
      direction: TransactionDirections.EXPENSE,
      grossAmount: amounts.totalEmployerCost,
      netAmount: amounts.totalEmployerCost,
      vatAmount: 0,
      vatRate: 0,
      currency: "SEK",
      source: "SALARY",
      reference: input.reference?.trim() || input.salaryEntryId,
      lines: {
        create: lines.map((line) => ({
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          note: line.note
        }))
      }
    }
  });
};

export const postEmployeeExpenseTransaction = async (
  tx: Prisma.TransactionClient,
  input: {
    businessId: string;
    expenseId: string;
    employeeName: string;
    expenseDate: Date;
    category: string;
    description: string;
    grossAmount: number;
    vatAmount: number;
    currency: string;
    reference?: string | null;
  }
) => {
  const breakdown = calculateExpenseBreakdown(input.grossAmount, input.vatAmount);
  const expenseAccountCode = getExpenseAccountCode(input.category);
  const accountLookup = await findAccountsByCode(tx, input.businessId, ["1930", "2641", expenseAccountCode]);

  const normalizedCurrency = normalizeCurrency(input.currency);
  let gross = breakdown.grossAmount;
  let net = breakdown.netAmount;
  let vat = breakdown.vatAmount;
  let sourceCurrency: string | null = null;
  let fxRateToSek: number | null = null;
  let fxRateDate: Date | null = null;

  if (normalizedCurrency !== "SEK") {
    const converted = await convertToSekAtDate({
      currency: normalizedCurrency,
      date: input.expenseDate,
      grossAmount: gross,
      netAmount: net,
      vatAmount: vat
    });
    gross = converted.grossAmountSek;
    net = converted.netAmountSek ?? net;
    vat = converted.vatAmountSek ?? vat;
    sourceCurrency = converted.sourceCurrency;
    fxRateToSek = converted.fxRateToSek;
    fxRateDate = converted.fxDate;
  }

  const lines: DraftLine[] = [
    {
      accountId: accountLookup.get(expenseAccountCode)!.id,
      debit: net,
      credit: 0,
      note: "employee_expense_cost"
    },
    ...(vat > 0
      ? [
          {
            accountId: accountLookup.get("2641")!.id,
            debit: vat,
            credit: 0,
            note: "employee_expense_input_vat"
          }
        ]
      : []),
    {
      accountId: accountLookup.get("1930")!.id,
      debit: 0,
      credit: gross,
      note: "counterparty_bank"
    }
  ];

  rebalanceLines(lines);

  return tx.transaction.create({
    data: {
      businessId: input.businessId,
      txnDate: input.expenseDate,
      description: `Employee expense ${input.employeeName}: ${input.description}`,
      direction: TransactionDirections.EXPENSE,
      grossAmount: gross,
      netAmount: net,
      vatAmount: vat,
      vatRate: net > 0 ? round2(vat / net) : 0,
      currency: "SEK",
      sourceCurrency: sourceCurrency ?? undefined,
      fxRateToSek: fxRateToSek ?? undefined,
      fxRateDate: fxRateDate ?? undefined,
      source: "EMPLOYEE_EXPENSE",
      reference: input.reference?.trim() || input.expenseId,
      lines: {
        create: lines.map((line) => ({
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          note: line.note
        }))
      }
    }
  });
};
