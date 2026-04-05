import { NextResponse } from "next/server";
import { z } from "zod";

import { asNumber } from "@/lib/accounting/math";
import { ensureBusiness } from "@/lib/data/business";
import { PAYROLL_PRISMA_NOT_READY, isPayrollPrismaReady, prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

const updateSchema = z
  .object({
    employeeNumber: z.string().trim().max(40).nullable().optional(),
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    email: z.string().trim().email().max(120).nullable().optional(),
    phone: z.string().trim().max(60).nullable().optional(),
    personalNumber: z.string().trim().min(6).max(40).optional(),
    addressLine1: z.string().trim().max(180).nullable().optional(),
    addressLine2: z.string().trim().max(180).nullable().optional(),
    postalCode: z.string().trim().max(40).nullable().optional(),
    city: z.string().trim().max(80).nullable().optional(),
    country: z.string().trim().max(80).optional(),
    taxTable: z.string().trim().max(20).nullable().optional(),
    preliminaryTaxRate: z.number().min(0).max(1).optional(),
    employerContributionRate: z.number().min(0).max(1).optional(),
    pensionRate: z.number().min(0).max(1).optional(),
    bankAccountName: z.string().trim().max(120).nullable().optional(),
    bankClearingNumber: z.string().trim().max(40).nullable().optional(),
    bankAccountNumber: z.string().trim().max(60).nullable().optional(),
    iban: z.string().trim().max(60).nullable().optional(),
    bic: z.string().trim().max(20).nullable().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional()
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "At least one field must be provided."
  });

const mapSalary = (entry: {
  id: string;
  payrollDate: Date;
  periodFrom: Date | null;
  periodTo: Date | null;
  grossSalary: unknown;
  bonusAmount: unknown;
  overtimeAmount: unknown;
  benefitsAmount: unknown;
  taxableGross: unknown;
  preliminaryTaxRate: unknown;
  preliminaryTaxAmount: unknown;
  employerContributionRate: unknown;
  employerContributionAmount: unknown;
  pensionRate: unknown;
  pensionAmount: unknown;
  netSalary: unknown;
  status: string;
  approvedAt: Date | null;
  paidAt: Date | null;
  paymentReference: string | null;
  notes: string | null;
  transactionId: string | null;
  createdAt: Date;
}) => ({
  id: entry.id,
  payrollDate: entry.payrollDate.toISOString().slice(0, 10),
  periodFrom: entry.periodFrom?.toISOString().slice(0, 10) ?? null,
  periodTo: entry.periodTo?.toISOString().slice(0, 10) ?? null,
  grossSalary: asNumber(entry.grossSalary),
  bonusAmount: asNumber(entry.bonusAmount),
  overtimeAmount: asNumber(entry.overtimeAmount),
  benefitsAmount: asNumber(entry.benefitsAmount),
  taxableGross: asNumber(entry.taxableGross),
  preliminaryTaxRate: asNumber(entry.preliminaryTaxRate),
  preliminaryTaxAmount: asNumber(entry.preliminaryTaxAmount),
  employerContributionRate: asNumber(entry.employerContributionRate),
  employerContributionAmount: asNumber(entry.employerContributionAmount),
  pensionRate: asNumber(entry.pensionRate),
  pensionAmount: asNumber(entry.pensionAmount),
  netSalary: asNumber(entry.netSalary),
  status: entry.status,
  approvedAt: entry.approvedAt?.toISOString() ?? null,
  paidAt: entry.paidAt?.toISOString() ?? null,
  paymentReference: entry.paymentReference,
  notes: entry.notes,
  transactionId: entry.transactionId,
  createdAt: entry.createdAt.toISOString()
});

const mapExpense = (entry: {
  id: string;
  expenseDate: Date;
  category: string;
  description: string;
  grossAmount: unknown;
  vatAmount: unknown;
  netAmount: unknown;
  currency: string;
  status: string;
  approvedAt: Date | null;
  paidAt: Date | null;
  receiptReference: string | null;
  paymentReference: string | null;
  notes: string | null;
  transactionId: string | null;
  createdAt: Date;
}) => ({
  id: entry.id,
  expenseDate: entry.expenseDate.toISOString().slice(0, 10),
  category: entry.category,
  description: entry.description,
  grossAmount: asNumber(entry.grossAmount),
  vatAmount: asNumber(entry.vatAmount),
  netAmount: asNumber(entry.netAmount),
  currency: entry.currency,
  status: entry.status,
  approvedAt: entry.approvedAt?.toISOString() ?? null,
  paidAt: entry.paidAt?.toISOString() ?? null,
  receiptReference: entry.receiptReference,
  paymentReference: entry.paymentReference,
  notes: entry.notes,
  transactionId: entry.transactionId,
  createdAt: entry.createdAt.toISOString()
});

export async function GET(_request: Request, context: RouteContext) {
  if (!isPayrollPrismaReady()) {
    return NextResponse.json({ error: PAYROLL_PRISMA_NOT_READY }, { status: 503 });
  }

  const employeeId = context.params.id;
  if (!employeeId) {
    return NextResponse.json({ error: "Missing employee id." }, { status: 400 });
  }

  const business = await ensureBusiness();
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      businessId: business.id
    },
    include: {
      salaryEntries: {
        orderBy: [{ payrollDate: "desc" }, { createdAt: "desc" }]
      },
      expenses: {
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }]
      }
    }
  });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  return NextResponse.json({
    employee: {
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
      salaryEntries: employee.salaryEntries.map(mapSalary),
      expenses: employee.expenses.map(mapExpense)
    }
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isPayrollPrismaReady()) {
    return NextResponse.json({ error: PAYROLL_PRISMA_NOT_READY }, { status: 503 });
  }

  const employeeId = context.params.id;
  if (!employeeId) {
    return NextResponse.json({ error: "Missing employee id." }, { status: 400 });
  }

  const business = await ensureBusiness();
  const payload = updateSchema.parse(await request.json());

  const existing = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      businessId: business.id
    },
    select: { id: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  const updated = await prisma.employee.update({
    where: { id: employeeId },
    data: {
      ...(payload.employeeNumber !== undefined ? { employeeNumber: payload.employeeNumber?.trim() || null } : {}),
      ...(payload.firstName !== undefined ? { firstName: payload.firstName.trim() } : {}),
      ...(payload.lastName !== undefined ? { lastName: payload.lastName.trim() } : {}),
      ...(payload.email !== undefined ? { email: payload.email?.trim() || null } : {}),
      ...(payload.phone !== undefined ? { phone: payload.phone?.trim() || null } : {}),
      ...(payload.personalNumber !== undefined ? { personalNumber: payload.personalNumber.trim() } : {}),
      ...(payload.addressLine1 !== undefined ? { addressLine1: payload.addressLine1?.trim() || null } : {}),
      ...(payload.addressLine2 !== undefined ? { addressLine2: payload.addressLine2?.trim() || null } : {}),
      ...(payload.postalCode !== undefined ? { postalCode: payload.postalCode?.trim() || null } : {}),
      ...(payload.city !== undefined ? { city: payload.city?.trim() || null } : {}),
      ...(payload.country !== undefined ? { country: payload.country.trim() || "SE" } : {}),
      ...(payload.taxTable !== undefined ? { taxTable: payload.taxTable?.trim() || null } : {}),
      ...(payload.preliminaryTaxRate !== undefined ? { preliminaryTaxRate: payload.preliminaryTaxRate } : {}),
      ...(payload.employerContributionRate !== undefined
        ? { employerContributionRate: payload.employerContributionRate }
        : {}),
      ...(payload.pensionRate !== undefined ? { pensionRate: payload.pensionRate } : {}),
      ...(payload.bankAccountName !== undefined ? { bankAccountName: payload.bankAccountName?.trim() || null } : {}),
      ...(payload.bankClearingNumber !== undefined
        ? { bankClearingNumber: payload.bankClearingNumber?.trim() || null }
        : {}),
      ...(payload.bankAccountNumber !== undefined
        ? { bankAccountNumber: payload.bankAccountNumber?.trim() || null }
        : {}),
      ...(payload.iban !== undefined ? { iban: payload.iban?.trim() || null } : {}),
      ...(payload.bic !== undefined ? { bic: payload.bic?.trim() || null } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {})
    }
  });

  return NextResponse.json({
    employee: {
      id: updated.id,
      employeeNumber: updated.employeeNumber,
      firstName: updated.firstName,
      lastName: updated.lastName,
      fullName: `${updated.firstName} ${updated.lastName}`.trim(),
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString()
    }
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!isPayrollPrismaReady()) {
    return NextResponse.json({ error: PAYROLL_PRISMA_NOT_READY }, { status: 503 });
  }

  const employeeId = context.params.id;
  if (!employeeId) {
    return NextResponse.json({ error: "Missing employee id." }, { status: 400 });
  }

  const business = await ensureBusiness();
  const existing = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      businessId: business.id
    },
    include: {
      salaryEntries: { select: { id: true } },
      expenses: { select: { id: true } }
    }
  });
  if (!existing) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  if (existing.salaryEntries.length > 0 || existing.expenses.length > 0) {
    return NextResponse.json(
      {
        error: "Employee has salary/expense records. Set employee status to INACTIVE instead of deleting."
      },
      { status: 409 }
    );
  }

  await prisma.employee.delete({
    where: { id: employeeId }
  });

  return NextResponse.json({ deletedEmployeeId: employeeId });
}
