import { NextResponse } from "next/server";
import { z } from "zod";

import { asNumber, round2 } from "@/lib/accounting/math";
import { ensureBusiness } from "@/lib/data/business";
import { PAYROLL_PRISMA_NOT_READY, isPayrollPrismaReady, prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const employeeSchema = z.object({
  employeeNumber: z.string().trim().max(40).optional(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(60).optional(),
  personalNumber: z.string().trim().min(6).max(40),
  addressLine1: z.string().trim().max(180).optional(),
  addressLine2: z.string().trim().max(180).optional(),
  postalCode: z.string().trim().max(40).optional(),
  city: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional().default("SE"),
  taxTable: z.string().trim().max(20).optional(),
  preliminaryTaxRate: z.number().min(0).max(1).optional(),
  employerContributionRate: z.number().min(0).max(1).optional(),
  pensionRate: z.number().min(0).max(1).optional(),
  bankAccountName: z.string().trim().max(120).optional(),
  bankClearingNumber: z.string().trim().max(40).optional(),
  bankAccountNumber: z.string().trim().max(60).optional(),
  iban: z.string().trim().max(60).optional(),
  bic: z.string().trim().max(20).optional()
});

const mapEmployee = (employee: {
  id: string;
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  personalNumber: string;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  taxTable: string | null;
  preliminaryTaxRate: unknown;
  employerContributionRate: unknown;
  pensionRate: unknown;
  bankAccountName: string | null;
  bankClearingNumber: string | null;
  bankAccountNumber: string | null;
  iban: string | null;
  bic: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  salaryEntries?: Array<{
    grossSalary: unknown;
    preliminaryTaxAmount: unknown;
    employerContributionAmount: unknown;
    pensionAmount: unknown;
    netSalary: unknown;
    status: string;
  }>;
  expenses?: Array<{
    grossAmount: unknown;
    status: string;
  }>;
}) => {
  const salaryEntries = employee.salaryEntries ?? [];
  const expenses = employee.expenses ?? [];

  const salaryTotals = salaryEntries.reduce(
    (accumulator, entry) => {
      const gross = asNumber(entry.grossSalary);
      const tax = asNumber(entry.preliminaryTaxAmount);
      const employer = asNumber(entry.employerContributionAmount);
      const pension = asNumber(entry.pensionAmount);
      const net = asNumber(entry.netSalary);

      accumulator.gross += Number.isFinite(gross) ? gross : 0;
      accumulator.tax += Number.isFinite(tax) ? tax : 0;
      accumulator.employerContribution += Number.isFinite(employer) ? employer : 0;
      accumulator.pension += Number.isFinite(pension) ? pension : 0;
      accumulator.net += Number.isFinite(net) ? net : 0;
      if (entry.status === "PAID") accumulator.paidCount += 1;
      return accumulator;
    },
    { gross: 0, tax: 0, employerContribution: 0, pension: 0, net: 0, paidCount: 0 }
  );

  const expenseTotals = expenses.reduce(
    (accumulator, entry) => {
      const gross = asNumber(entry.grossAmount);
      if (!Number.isFinite(gross)) return accumulator;
      accumulator.claimed += gross;
      if (entry.status === "APPROVED" || entry.status === "PAID") {
        accumulator.approved += gross;
      }
      if (entry.status === "PAID") {
        accumulator.paid += gross;
      }
      return accumulator;
    },
    { claimed: 0, approved: 0, paid: 0 }
  );

  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    fullName: `${employee.firstName} ${employee.lastName}`.trim(),
    email: employee.email,
    phone: employee.phone,
    personalNumber: employee.personalNumber,
    addressLine1: employee.addressLine1,
    addressLine2: employee.addressLine2,
    postalCode: employee.postalCode,
    city: employee.city,
    country: employee.country,
    taxTable: employee.taxTable,
    preliminaryTaxRate: asNumber(employee.preliminaryTaxRate),
    employerContributionRate: asNumber(employee.employerContributionRate),
    pensionRate: asNumber(employee.pensionRate),
    bankAccountName: employee.bankAccountName,
    bankClearingNumber: employee.bankClearingNumber,
    bankAccountNumber: employee.bankAccountNumber,
    iban: employee.iban,
    bic: employee.bic,
    status: employee.status,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
    salaryTotals: {
      gross: round2(salaryTotals.gross),
      tax: round2(salaryTotals.tax),
      employerContribution: round2(salaryTotals.employerContribution),
      pension: round2(salaryTotals.pension),
      net: round2(salaryTotals.net),
      paidCount: salaryTotals.paidCount
    },
    expenseTotals: {
      claimed: round2(expenseTotals.claimed),
      approved: round2(expenseTotals.approved),
      paid: round2(expenseTotals.paid)
    },
    salaryCount: salaryEntries.length,
    expenseCount: expenses.length
  };
};

export async function GET() {
  if (!isPayrollPrismaReady()) {
    return NextResponse.json({ error: PAYROLL_PRISMA_NOT_READY }, { status: 503 });
  }

  const business = await ensureBusiness();
  const employees = await prisma.employee.findMany({
    where: { businessId: business.id },
    include: {
      salaryEntries: {
        select: {
          grossSalary: true,
          preliminaryTaxAmount: true,
          employerContributionAmount: true,
          pensionAmount: true,
          netSalary: true,
          status: true
        }
      },
      expenses: {
        select: {
          grossAmount: true,
          status: true
        }
      }
    },
    orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }]
  });

  return NextResponse.json({
    employees: employees.map(mapEmployee)
  });
}

export async function POST(request: Request) {
  if (!isPayrollPrismaReady()) {
    return NextResponse.json({ error: PAYROLL_PRISMA_NOT_READY }, { status: 503 });
  }

  const business = await ensureBusiness();
  const payload = employeeSchema.parse(await request.json());

  const created = await prisma.employee.create({
    data: {
      businessId: business.id,
      employeeNumber: payload.employeeNumber?.trim() || null,
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      email: payload.email?.trim() || null,
      phone: payload.phone?.trim() || null,
      personalNumber: payload.personalNumber.trim(),
      addressLine1: payload.addressLine1?.trim() || null,
      addressLine2: payload.addressLine2?.trim() || null,
      postalCode: payload.postalCode?.trim() || null,
      city: payload.city?.trim() || null,
      country: payload.country?.trim() || "SE",
      taxTable: payload.taxTable?.trim() || null,
      preliminaryTaxRate:
        payload.preliminaryTaxRate ??
        asNumber(business.taxConfig?.municipalTaxRate ?? 0.3),
      employerContributionRate:
        payload.employerContributionRate ??
        asNumber(business.taxConfig?.socialContributionRate ?? 0.3142),
      pensionRate: payload.pensionRate ?? 0.045,
      bankAccountName: payload.bankAccountName?.trim() || null,
      bankClearingNumber: payload.bankClearingNumber?.trim() || null,
      bankAccountNumber: payload.bankAccountNumber?.trim() || null,
      iban: payload.iban?.trim() || null,
      bic: payload.bic?.trim() || null
    }
  });

  return NextResponse.json(
    {
      employee: mapEmployee(created)
    },
    { status: 201 }
  );
}
