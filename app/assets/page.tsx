import { FixedAssetsManager } from "@/components/assets/FixedAssetsManager";
import { ensureBusiness } from "@/lib/data/business";
import { prisma } from "@/lib/db";
import { getRequestLocale } from "@/lib/i18n/locale";
import { asNumber } from "@/lib/accounting/math";

export default async function AssetsPage() {
  const locale = getRequestLocale();
  const sv = locale === "sv";

  const copy = {
    title: sv ? "Inventarieregister" : "Fixed Asset Register",
    subtitle: sv
      ? "Registrera inventarier, fordon och byggnader. Avskrivningar beräknas automatiskt och förs in i NE-bilagedraftet."
      : "Record equipment, vehicles and buildings. Depreciation is calculated automatically and fed into the NE-bilaga draft."
  };

  const business = await ensureBusiness();

  let rawAssets: Awaited<ReturnType<typeof prisma.fixedAsset.findMany>> = [];
  try {
    rawAssets = await prisma.fixedAsset.findMany({
      where: { businessId: business.id },
      orderBy: { acquisitionDate: "desc" }
    });
  } catch {
    // Table may not exist before migration runs.
  }

  const assets = rawAssets.map((a) => ({
    id: a.id,
    description: a.description,
    category: a.category,
    acquisitionDate: a.acquisitionDate.toISOString(),
    acquisitionCost: asNumber(a.acquisitionCost as unknown as string | number),
    depreciationMethod: a.depreciationMethod,
    disposalDate: a.disposalDate ? a.disposalDate.toISOString() : null,
    disposalValue: a.disposalValue ? asNumber(a.disposalValue as unknown as string | number) : null,
    notes: a.notes
  }));

  return (
    <section className="page">
      <h1 className="title">{copy.title}</h1>
      <p className="subtitle">{copy.subtitle}</p>

      <article className="card" id="assets-register">
        <FixedAssetsManager locale={locale} initial={assets} />
      </article>
    </section>
  );
}
