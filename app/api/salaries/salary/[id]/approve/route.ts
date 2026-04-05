import { NextResponse } from "next/server";

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

export async function POST(_request: Request, context: RouteContext) {
  if (!isPayrollPrismaReady()) {
    return NextResponse.json({ error: PAYROLL_PRISMA_NOT_READY }, { status: 503 });
  }

  const salaryEntryId = context.params.id;
  if (!salaryEntryId) {
    return NextResponse.json({ error: "Missing salary entry id." }, { status: 400 });
  }

  const business = await ensureBusiness();
  const entry = await prisma.salaryEntry.findFirst({
    where: {
      id: salaryEntryId,
      businessId: business.id
    }
  });
  if (!entry) {
    return NextResponse.json({ error: "Salary entry not found." }, { status: 404 });
  }
  if (entry.status === "PAID") {
    return NextResponse.json({ error: "Salary entry is already paid." }, { status: 409 });
  }
  if (entry.status === "APPROVED") {
    return NextResponse.json({
      salaryEntry: {
        id: entry.id,
        status: entry.status,
        approvedAt: entry.approvedAt?.toISOString() ?? null
      }
    });
  }

  const updated = await prisma.salaryEntry.update({
    where: { id: entry.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date()
    }
  });

  return NextResponse.json({
    salaryEntry: {
      id: updated.id,
      payrollDate: updated.payrollDate.toISOString().slice(0, 10),
      taxableGross: asNumber(updated.taxableGross),
      netSalary: asNumber(updated.netSalary),
      status: updated.status,
      approvedAt: updated.approvedAt?.toISOString() ?? null,
      paidAt: updated.paidAt?.toISOString() ?? null,
      transactionId: updated.transactionId
    }
  });
}
