import { NextResponse } from "next/server";
import { z } from "zod";

import { asNumber } from "@/lib/accounting/math";
import { ensureBusiness } from "@/lib/data/business";
import { PAYROLL_PRISMA_NOT_READY, isPayrollPrismaReady, prisma } from "@/lib/db";
import { calculateSalaryBreakdown } from "@/lib/salaries/calculations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

const createSalarySchema = z.object({
  payrollDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  grossSalary: z.number().nonnegative(),
  bonusAmount: z.number().nonnegative().optional(),
  overtimeAmount: z.number().nonnegative().optional(),
  benefitsAmount: z.number().nonnegative().optional(),
  preliminaryTaxRate: z.number().min(0).max(1).optional(),
  employerContributionRate: z.number().min(0).max(1).optional(),
  pensionRate: z.number().min(0).max(1).optional(),
  notes: z.string().trim().max(2000).optional()
});

export async function POST(request: Request, context: RouteContext) {
  if (!isPayrollPrismaReady()) {
    return NextResponse.json({ error: PAYROLL_PRISMA_NOT_READY }, { status: 503 });
  }

  const employeeId = context.params.id;
  if (!employeeId) {
    return NextResponse.json({ error: "Missing employee id." }, { status: 400 });
  }

  const business = await ensureBusiness();
  const payload = createSalarySchema.parse(await request.json());
  const payrollDate = new Date(`${payload.payrollDate}T00:00:00.000Z`);
  const periodFrom = payload.periodFrom ? new Date(`${payload.periodFrom}T00:00:00.000Z`) : null;
  const periodTo = payload.periodTo ? new Date(`${payload.periodTo}T00:00:00.000Z`) : null;

  if (Number.isNaN(payrollDate.valueOf())) {
    return NextResponse.json({ error: "Invalid payroll date." }, { status: 400 });
  }
  if (periodFrom && Number.isNaN(periodFrom.valueOf())) {
    return NextResponse.json({ error: "Invalid period start date." }, { status: 400 });
  }
  if (periodTo && Number.isNaN(periodTo.valueOf())) {
    return NextResponse.json({ error: "Invalid period end date." }, { status: 400 });
  }
  if (periodFrom && periodTo && periodFrom > periodTo) {
    return NextResponse.json({ error: "Salary period start must be before period end." }, { status: 400 });
  }

  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      businessId: business.id
    },
    select: {
      id: true,
      status: true,
      preliminaryTaxRate: true,
      employerContributionRate: true,
      pensionRate: true
    }
  });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }
  if (employee.status !== "ACTIVE") {
    return NextResponse.json({ error: "Employee is inactive." }, { status: 409 });
  }

  const amounts = calculateSalaryBreakdown({
    grossSalary: payload.grossSalary,
    bonusAmount: payload.bonusAmount ?? 0,
    overtimeAmount: payload.overtimeAmount ?? 0,
    benefitsAmount: payload.benefitsAmount ?? 0,
    preliminaryTaxRate: payload.preliminaryTaxRate ?? asNumber(employee.preliminaryTaxRate),
    employerContributionRate:
      payload.employerContributionRate ?? asNumber(employee.employerContributionRate),
    pensionRate: payload.pensionRate ?? asNumber(employee.pensionRate)
  });

  const salaryEntry = await prisma.salaryEntry.create({
    data: {
      businessId: business.id,
      employeeId: employee.id,
      payrollDate,
      periodFrom,
      periodTo,
      grossSalary: amounts.grossSalary,
      bonusAmount: amounts.bonusAmount,
      overtimeAmount: amounts.overtimeAmount,
      benefitsAmount: amounts.benefitsAmount,
      taxableGross: amounts.taxableGross,
      preliminaryTaxRate: amounts.preliminaryTaxRate,
      preliminaryTaxAmount: amounts.preliminaryTaxAmount,
      employerContributionRate: amounts.employerContributionRate,
      employerContributionAmount: amounts.employerContributionAmount,
      pensionRate: amounts.pensionRate,
      pensionAmount: amounts.pensionAmount,
      netSalary: amounts.netSalary,
      notes: payload.notes?.trim() || null,
      status: "DRAFT"
    }
  });

  return NextResponse.json(
    {
      salaryEntry: {
        id: salaryEntry.id,
        payrollDate: salaryEntry.payrollDate.toISOString().slice(0, 10),
        periodFrom: salaryEntry.periodFrom?.toISOString().slice(0, 10) ?? null,
        periodTo: salaryEntry.periodTo?.toISOString().slice(0, 10) ?? null,
        grossSalary: asNumber(salaryEntry.grossSalary),
        bonusAmount: asNumber(salaryEntry.bonusAmount),
        overtimeAmount: asNumber(salaryEntry.overtimeAmount),
        benefitsAmount: asNumber(salaryEntry.benefitsAmount),
        taxableGross: asNumber(salaryEntry.taxableGross),
        preliminaryTaxRate: asNumber(salaryEntry.preliminaryTaxRate),
        preliminaryTaxAmount: asNumber(salaryEntry.preliminaryTaxAmount),
        employerContributionRate: asNumber(salaryEntry.employerContributionRate),
        employerContributionAmount: asNumber(salaryEntry.employerContributionAmount),
        pensionRate: asNumber(salaryEntry.pensionRate),
        pensionAmount: asNumber(salaryEntry.pensionAmount),
        netSalary: asNumber(salaryEntry.netSalary),
        status: salaryEntry.status,
        transactionId: salaryEntry.transactionId,
        approvedAt: salaryEntry.approvedAt?.toISOString() ?? null,
        paidAt: salaryEntry.paidAt?.toISOString() ?? null,
        notes: salaryEntry.notes
      }
    },
    { status: 201 }
  );
}
