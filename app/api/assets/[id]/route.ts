import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureBusiness } from "@/lib/data/business";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  description: z.string().min(1).max(200),
  category: z.enum(["equipment", "vehicle", "building", "intangible", "other"]),
  acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  acquisitionCost: z.number().positive(),
  depreciationMethod: z.enum(["declining_30", "straight_20", "straight_25", "building_4"]),
  disposalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  disposalValue: z.number().min(0).optional().nullable(),
  notes: z.string().max(500).optional()
});

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const business = await ensureBusiness();
  const body = await request.json();
  const payload = updateSchema.parse(body);

  const existing = await prisma.fixedAsset.findFirst({
    where: { id: params.id, businessId: business.id }
  });
  if (!existing) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  const updated = await prisma.fixedAsset.update({
    where: { id: params.id },
    data: {
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

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const business = await ensureBusiness();
  const existing = await prisma.fixedAsset.findFirst({
    where: { id: params.id, businessId: business.id }
  });
  if (!existing) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }
  await prisma.fixedAsset.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
