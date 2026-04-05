import { NextResponse } from "next/server";

import { ensureBusiness } from "@/lib/data/business";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const business = await ensureBusiness();
  const existing = await prisma.mileageEntry.findFirst({
    where: { id: params.id, businessId: business.id }
  });
  if (!existing) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
  await prisma.mileageEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
