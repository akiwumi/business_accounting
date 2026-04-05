import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureBusiness } from "@/lib/data/business";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  description: z.string().min(1).max(200),
  category: z.enum(["equipment", "vehicle", "building", "intangible", "other"]).default("equipment"),
  acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  acquisitionCost: z.number().positive(),
  depreciationMethod: z
    .enum(["declining_30", "straight_20", "straight_25", "building_4"])
    .default("declining_30"),
  disposalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  disposalValue: z.number().min(0).optional(),
  notes: z.string().max(500).optional()
});

export async function GET() {
  const business = await ensureBusiness();
  const assets = await prisma.fixedAsset.findMany({
    where: { businessId: business.id },
    orderBy: { acquisitionDate: "desc" }
  });
  return NextResponse.json(assets);
}

export async function POST(request: Request) {
  const business = await ensureBusiness();
  const body = await request.json();
  const payload = createSchema.parse(body);

  const asset = await prisma.fixedAsset.create({
    data: {
      businessId: business.id,
      description: payload.description,
      category: payload.category,
      acquisitionDate: new Date(payload.acquisitionDate),
      acquisitionCost: payload.acquisitionCost,
      depreciationMethod: payload.depreciationMethod,
      disposalDate: payload.disposalDate ? new Date(payload.disposalDate) : null,
      disposalValue: payload.disposalValue ?? null,
      notes: payload.notes ?? null
    }
  });

  return NextResponse.json(asset, { status: 201 });
}
