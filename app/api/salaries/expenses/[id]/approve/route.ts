import { NextResponse } from "next/server";

import { ensureBusiness } from "@/lib/data/business";
import { PAYROLL_PRISMA_NOT_READY, isPayrollPrismaReady, prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, context: RouteContext) {
  if (!isPayrollPrismaReady()) {
    return NextResponse.json({ error: PAYROLL_PRISMA_NOT_READY }, { status: 503 });
  }

  const expenseId = context.params.id;
  if (!expenseId) {
    return NextResponse.json({ error: "Missing expense id." }, { status: 400 });
  }

  const business = await ensureBusiness();
  const entry = await prisma.employeeExpense.findFirst({
    where: {
      id: expenseId,
      businessId: business.id
    }
  });
  if (!entry) {
    return NextResponse.json({ error: "Expense claim not found." }, { status: 404 });
  }
  if (entry.status === "PAID") {
    return NextResponse.json({ error: "Expense claim is already paid." }, { status: 409 });
  }
  if (entry.status === "APPROVED") {
    return NextResponse.json({
      expense: {
        id: entry.id,
        status: entry.status,
        approvedAt: entry.approvedAt?.toISOString() ?? null
      }
    });
  }

  const updated = await prisma.employeeExpense.update({
    where: { id: entry.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date()
    }
  });

  return NextResponse.json({
    expense: {
      id: updated.id,
      status: updated.status,
      approvedAt: updated.approvedAt?.toISOString() ?? null,
      paidAt: updated.paidAt?.toISOString() ?? null,
      transactionId: updated.transactionId
    }
  });
}
