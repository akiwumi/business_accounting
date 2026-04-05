import { NextResponse } from "next/server";

import { buildProfitAndLoss } from "@/lib/accounting/reports";
import { asNumber } from "@/lib/accounting/math";
import { ensureBusiness } from "@/lib/data/business";
import { getFiscalYearStartMonth, resolveReportPeriod } from "@/lib/data/period";
import { type Jurisdiction } from "@/lib/domain/enums";
import { getTaxEngine } from "@/lib/tax/engines";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const business = await ensureBusiness();
  const period = resolveReportPeriod(
    new URL(request.url).searchParams,
    getFiscalYearStartMonth(business.fiscalYearStart)
  );
  const pnl = await buildProfitAndLoss({ businessId: business.id, ...period });
  const engine = getTaxEngine(business.jurisdiction as Jurisdiction);

  const taxConfig = business.taxConfig;
  if (!taxConfig) {
    return NextResponse.json({ error: "Missing tax configuration." }, { status: 500 });
  }

  const report = engine.estimate({
    profitBeforeTax: pnl.operatingProfit,
    municipalTaxRate: asNumber(taxConfig.municipalTaxRate as unknown as number | string),
    socialContributionRate: asNumber(taxConfig.socialContributionRate as unknown as number | string),
    generalDeductionRate: asNumber(taxConfig.generalDeductionRate as unknown as number | string)
  });

  return NextResponse.json({
    engine: engine.label,
    period,
    ...report
  });
}
