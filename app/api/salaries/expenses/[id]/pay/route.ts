import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureBusiness } from "@/lib/data/business";
import { PAYROLL_PRISMA_NOT_READY, isPayrollPrismaReady, prisma } from "@/lib/db";
import { asNumber } from "@/lib/accounting/math";
import { postEmployeeExpenseTransaction } from "@/lib/salaries/posting";

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

  const expenseId = context.params.id;
  if (!expenseId) {
    return NextResponse.json({ error: "Missing expense id." }, { status: 400 });
  }

  const business = await ensureBusiness();
  const payload = paySchema.parse(await request.json().catch(() => ({})));
  const parsedPaymentDate = payload.paymentDate
    ? new Date(`${payload.paymentDate}T00:00:00.000Z`)
    : null;
  if (parsedPaymentDate && Number.isNaN(parsedPaymentDate.valueOf())) {
    return NextResponse.json({ error: "Invalid payment date." }, { status: 400 });
  }

  const entry = await prisma.employeeExpense.findFirst({
    where: {
      id: expenseId,
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
    return NextResponse.json({ error: "Expense claim not found." }, { status: 404 });
  }
  if (entry.status === "PENDING") {
    return NextResponse.json({ error: "Approve expense claim before marking paid." }, { status: 409 });
  }

  const paidDate = parsedPaymentDate ?? new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const freshEntry = await tx.employeeExpense.findUnique({
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
      throw new Error("Expense claim no longer exists.");
    }

    let transactionId = freshEntry.transactionId;
    if (!transactionId) {
      const transaction = await postEmployeeExpenseTransaction(tx, {
        businessId: business.id,
        expenseId: freshEntry.id,
        employeeName: `${freshEntry.employee.firstName} ${freshEntry.employee.lastName}`.trim(),
        expenseDate: paidDate,
        category: freshEntry.category,
        description: freshEntry.description,
        grossAmount: asNumber(freshEntry.grossAmount),
        vatAmount: asNumber(freshEntry.vatAmount),
        currency: freshEntry.currency,
        reference: payload.paymentReference ?? freshEntry.paymentReference ?? freshEntry.id
      });
      transactionId = transaction.id;
    }

    return tx.employeeExpense.update({
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
    expense: {
      id: updated.id,
      status: updated.status,
      approvedAt: updated.approvedAt?.toISOString() ?? null,
      paidAt: updated.paidAt?.toISOString() ?? null,
      paymentReference: updated.paymentReference,
      transactionId: updated.transactionId
    }
  });
}
