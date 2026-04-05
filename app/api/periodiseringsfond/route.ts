import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureBusiness } from "@/lib/data/business";
import { prisma } from "@/lib/db";
import { asNumber, round2 } from "@/lib/accounting/math";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  entryType: z.enum(["periodiseringsfond", "expansionsfond"]),
  direction: z.enum(["allocation", "withdrawal"]),
  taxYear: z.number().int().min(2000).max(2100),
  amount: z.number().positive(),
  notes: z.string().max(500).optional()
});

export async function GET() {
  const business = await ensureBusiness();
  const entries = await prisma.periodisationEntry.findMany({
    where: { businessId: business.id },
    orderBy: [{ taxYear: "desc" }, { createdAt: "desc" }]
  });

  // Build running balance per type
  const pfEntries = entries.filter((e) => e.entryType === "periodiseringsfond");
  const efEntries = entries.filter((e) => e.entryType === "expansionsfond");

  const pfBalance = round2(
    pfEntries.reduce((sum, e) => {
      const amt = asNumber(e.amount as unknown as string | number);
      return e.direction === "allocation" ? sum + amt : sum - amt;
    }, 0)
  );

  const efBalance = round2(
    efEntries.reduce((sum, e) => {
      const amt = asNumber(e.amount as unknown as string | number);
      return e.direction === "allocation" ? sum + amt : sum - amt;
    }, 0)
  );

  return NextResponse.json({
    entries,
    periodiseringsfondBalance: pfBalance,
    expansionsfondBalance: efBalance
  });
}

export async function POST(request: Request) {
  const business = await ensureBusiness();
  const body = await request.json();
  const payload = createSchema.parse(body);

  const entry = await prisma.periodisationEntry.create({
    data: {
      businessId: business.id,
      entryType: payload.entryType,
      direction: payload.direction,
      taxYear: payload.taxYear,
      amount: payload.amount,
      notes: payload.notes ?? null
    }
  });

  return NextResponse.json(entry, { status: 201 });
}
