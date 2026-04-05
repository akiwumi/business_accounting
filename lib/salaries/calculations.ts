import { round2 } from "@/lib/accounting/math";

type SalaryCalculationInput = {
  grossSalary: number;
  bonusAmount?: number;
  overtimeAmount?: number;
  benefitsAmount?: number;
  preliminaryTaxRate: number;
  employerContributionRate: number;
  pensionRate: number;
};

const clampRate = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const asPositive = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  return round2(value);
};

export const calculateSalaryBreakdown = (input: SalaryCalculationInput) => {
  const grossSalary = asPositive(input.grossSalary);
  const bonusAmount = asPositive(input.bonusAmount ?? 0);
  const overtimeAmount = asPositive(input.overtimeAmount ?? 0);
  const benefitsAmount = asPositive(input.benefitsAmount ?? 0);
  const preliminaryTaxRate = clampRate(input.preliminaryTaxRate);
  const employerContributionRate = clampRate(input.employerContributionRate);
  const pensionRate = clampRate(input.pensionRate);

  const taxableGross = round2(grossSalary + bonusAmount + overtimeAmount + benefitsAmount);
  const preliminaryTaxAmount = round2(taxableGross * preliminaryTaxRate);
  const employerContributionAmount = round2(taxableGross * employerContributionRate);
  const pensionAmount = round2(taxableGross * pensionRate);
  const netSalary = round2(taxableGross - preliminaryTaxAmount);
  const totalEmployerCost = round2(taxableGross + employerContributionAmount + pensionAmount);

  return {
    grossSalary,
    bonusAmount,
    overtimeAmount,
    benefitsAmount,
    taxableGross,
    preliminaryTaxRate,
    preliminaryTaxAmount,
    employerContributionRate,
    employerContributionAmount,
    pensionRate,
    pensionAmount,
    netSalary,
    totalEmployerCost
  };
};

export const calculateExpenseBreakdown = (grossAmount: number, vatAmount: number) => {
  const gross = asPositive(grossAmount);
  const vat = asPositive(vatAmount);
  const net = round2(Math.max(0, gross - vat));
  const vatRate = net > 0 ? round2(vat / net) : 0;

  return {
    grossAmount: gross,
    vatAmount: vat,
    netAmount: net,
    vatRate
  };
};
