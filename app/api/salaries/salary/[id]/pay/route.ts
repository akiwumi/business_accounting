import { NextResponse } from "next/server";
import { z } from "zod";

import { asNumber } from "@/lib/accounting/math";
import { ensureBusiness } from "@/lib/data/business";
import { PAYROLL_PRISMA_NOT_READY, isPayrollPrismaReady, prisma } from "@/lib/db";
import { postSalaryPaymentTransaction } from "@/lib/salaries/posting";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

const paySchema = z.object({
  paymentReference: z.string().trim().max(120).optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export async function POST(request: Request, context: RouteContext) {
  if (!isPayrollPrismaReady()) {
    return NextResponse.json({ error: PAYROLL_PRISMA_NOT_READY }, { status: 503 });
  }

  const salaryEntryId = context.params.id;
  if (!salaryEntryId) {
    return NextResponse.json({ error: "Missing salary entry id." }, { status: 400 });
  }

  const business = await ensureBusiness();
  const payload = paySchema.parse(await request.json().catch(() => ({})));
  const parsedPaymentDate = payload.paymentDate
    ? new Date(`${payload.paymentDate}T00:00:00.000Z`)
    : null;
  if (parsedPaymentDate && Number.isNaN(parsedPaymentDate.valueOf())) {
    return NextResponse.json({ error: "Invalid payment date." }, { status: 400 });
  }

  const entry = await prisma.salaryEntry.findFirst({
    where: {
      id: salaryEntryId,
      businessId: business.id
    },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  });
  if (!entry) {
    return NextResponse.json({ error: "Salary entry not found." }, { status: 404 });
  }

  if (entry.status === "DRAFT") {
    return NextResponse.json({ error: "Approve salary entry before marking paid." }, { status: 409 });
  }

  const paidDate = parsedPaymentDate ?? new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const freshEntry = await tx.salaryEntry.findUnique({
      where: { id: entry.id },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });
    if (!freshEntry) {
      throw new Error("Salary entry no longer exists.");
    }

    let transactionId = freshEntry.transactionId;
    if (!transactionId) {
      const transaction = await postSalaryPaymentTransaction(tx, {
        businessId: business.id,
        salaryEntryId: freshEntry.id,
        employeeName: `${freshEntry.employee.firstName} ${freshEntry.employee.lastName}`.trim(),
        payrollDate: paidDate,
        grossSalary: asNumber(freshEntry.grossSalary),
        bonusAmount: asNumber(freshEntry.bonusAmount),
        overtimeAmount: asNumber(freshEntry.overtimeAmount),
        benefitsAmount: asNumber(freshEntry.benefitsAmount),
        preliminaryTaxRate: asNumber(freshEntry.preliminaryTaxRate),
        employerContributionRate: asNumber(freshEntry.employerContributionRate),
        pensionRate: asNumber(freshEntry.pensionRate),
        reference: payload.paymentReference ?? freshEntry.paymentReference ?? freshEntry.id
      });
      transactionId = transaction.id;
    }

    return tx.salaryEntry.update({
      where: { id: freshEntry.id },
      data: {
        status: "PAID",
        approvedAt: freshEntry.approvedAt ?? paidDate,
        paidAt: paidDate,
        paymentReference: payload.paymentReference?.trim() || freshEntry.paymentReference || null,
        transactionId
      }
    });
  });

  return NextResponse.json({
    salaryEntry: {
      id: updated.id,
      status: updated.status,
      approvedAt: updated.approvedAt?.toISOString() ?? null,
      paidAt: updated.paidAt?.toISOString() ?? null,
      paymentReference: updated.paymentReference,
      transactionId: updated.transactionId
    }
  });
}
