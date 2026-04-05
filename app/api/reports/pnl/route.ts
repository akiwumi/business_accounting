import { NextResponse } from "next/server";

import { buildProfitAndLoss } from "@/lib/accounting/reports";
import { ensureBusiness } from "@/lib/data/business";
import { getFiscalYearStartMonth, resolveReportPeriod } from "@/lib/data/period";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const business = await ensureBusiness();
  const period = resolveReportPeriod(
    new URL(request.url).searchParams,
    getFiscalYearStartMonth(business.fiscalYearStart)
  );
  const report = await buildProfitAndLoss({ businessId: business.id, ...period });
  return NextResponse.json(report);
}
