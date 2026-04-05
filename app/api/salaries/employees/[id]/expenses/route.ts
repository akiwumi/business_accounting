import { NextResponse } from "next/server";
import { z } from "zod";

import { asNumber } from "@/lib/accounting/math";
import { ensureBusiness } from "@/lib/data/business";
import { PAYROLL_PRISMA_NOT_READY, isPayrollPrismaReady, prisma } from "@/lib/db";
import { calculateExpenseBreakdown } from "@/lib/salaries/calculations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

const createExpenseSchema = z.object({
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(240),
  grossAmount: z.number().positive(),
  vatAmount: z.number().min(0).optional(),
  currency: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/).optional(),
  receiptReference: z.string().trim().max(120).optional(),
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
  const payload = createExpenseSchema.parse(await request.json());
  const expenseDate = new Date(`${payload.expenseDate}T00:00:00.000Z`);
  if (Number.isNaN(expenseDate.valueOf())) {
    return NextResponse.json({ error: "Invalid expense date." }, { status: 400 });
  }

  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      businessId: business.id
    },
    select: {
      id: true,
      status: true
    }
  });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }
  if (employee.status !== "ACTIVE") {
    return NextResponse.json({ error: "Employee is inactive." }, { status: 409 });
  }

  const amounts = calculateExpenseBreakdown(payload.grossAmount, payload.vatAmount ?? 0);
  const entry = await prisma.employeeExpense.create({
    data: {
      businessId: business.id,
      employeeId: employee.id,
      expenseDate,
      category: payload.category.trim(),
      description: payload.description.trim(),
      grossAmount: amounts.grossAmount,
      vatAmount: amounts.vatAmount,
      netAmount: amounts.netAmount,
      currency: payload.currency?.trim().toUpperCase() || "SEK",
      status: "PENDING",
      receiptReference: payload.receiptReference?.trim() || null,
      notes: payload.notes?.trim() || null
    }
  });

  return NextResponse.json(
    {
      expense: {
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
        transactionId: entry.transactionId
      }
    },
    { status: 201 }
  );
}
