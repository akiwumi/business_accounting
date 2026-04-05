import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureBusiness } from "@/lib/data/business";
import { prisma } from "@/lib/db";
import { round2 } from "@/lib/accounting/math";

export const dynamic = "force-dynamic";

const CURRENT_RATE_PER_KM = 1.85; // SEK per km (2026 Skatteverket rate)

const createSchema = z.object({
  tripDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  destination: z.string().min(1).max(200),
  purpose: z.string().min(1).max(300),
  kilometers: z.number().positive().max(10000),
  ratePerKm: z.number().positive().max(10).optional(),
  notes: z.string().max(500).optional()
});

export async function GET(request: Request) {
  const business = await ensureBusiness();
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");

  const where: Record<string, unknown> = { businessId: business.id };
  if (year) {
    where.tripDate = {
      gte: new Date(`${year}-01-01`),
      lte: new Date(`${year}-12-31`)
    };
  }

  const entries = await prisma.mileageEntry.findMany({
    where,
    orderBy: { tripDate: "desc" }
  });
  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  const business = await ensureBusiness();
  const body = await request.json();
  const payload = createSchema.parse(body);

  const rate = payload.ratePerKm ?? CURRENT_RATE_PER_KM;
  const deductionAmount = round2(payload.kilometers * rate);

  const entry = await prisma.mileageEntry.create({
    data: {
      businessId: business.id,
      tripDate: new Date(payload.tripDate),
      destination: payload.destination,
      purpose: payload.purpose,
      kilometers: payload.kilometers,
      ratePerKm: rate,
      deductionAmount,
      notes: payload.notes ?? null
    }
  });

  return NextResponse.json(entry, { status: 201 });
}
