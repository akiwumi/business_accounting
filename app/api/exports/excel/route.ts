import { NextResponse } from "next/server";

import { buildAccountingWorkbook } from "@/lib/accounting/excel";
import { buildBalanceSheet, buildNeBilagaDraft, buildProfitAndLoss, buildVatReport } from "@/lib/accounting/reports";
import { asNumber } from "@/lib/accounting/math";
import { ensureBusiness } from "@/lib/data/business";
import { getFiscalYearStartMonth, resolveReportPeriod } from "@/lib/data/period";
import { type Jurisdiction } from "@/lib/domain/enums";
import { getTaxEngine } from "@/lib/tax/engines";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const business = await ensureBusiness();
  const period = resolveReportPeriod(
    new URL(request.url).searchParams,
    getFiscalYearStartMonth(business.fiscalYearStart)
  );
  const [profitAndLoss, balanceSheet, vat, neDraft] = await Promise.all([
    buildProfitAndLoss({ businessId: business.id, ...period }),
    buildBalanceSheet({ businessId: business.id, ...period }),
    buildVatReport({ businessId: business.id, ...period }),
    buildNeBilagaDraft({ businessId: business.id, ...period })
  ]);

  if (!business.taxConfig) {
    return NextResponse.json({ error: "Missing tax configuration." }, { status: 500 });
  }

  const engine = getTaxEngine(business.jurisdiction as Jurisdiction);
  const taxEstimate = engine.estimate({
    profitBeforeTax: profitAndLoss.operatingProfit,
    municipalTaxRate: asNumber(business.taxConfig.municipalTaxRate as unknown as string | number),
    socialContributionRate: asNumber(business.taxConfig.socialContributionRate as unknown as string | number),
    generalDeductionRate: asNumber(business.taxConfig.generalDeductionRate as unknown as string | number)
  });

  const workbookBuffer = buildAccountingWorkbook({
    profitAndLoss,
    balanceSheet,
    vat,
    taxEstimate,
    neDraft
  });

  return new NextResponse(workbookBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=accounting-reports.xlsx"
    }
  });
}
