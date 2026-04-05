import { PeriodiseringsfondManager } from "@/components/compliance/PeriodiseringsfondManager";
import { ensureBusiness } from "@/lib/data/business";
import { prisma } from "@/lib/db";
import { getRequestLocale } from "@/lib/i18n/locale";
import { asNumber, round2 } from "@/lib/accounting/math";

export default async function PeriodiseringsfondPage() {
  const locale = getRequestLocale();
  const sv = locale === "sv";

  const copy = {
    title: sv ? "Periodiseringsfond & Expansionsfond" : "Tax Allocation Reserves",
    subtitle: sv
      ? "Registrera avsättningar och återföringar av periodiseringsfond (upp till 30 % av överskottet) och expansionsfond. Beloppen tillämpas automatiskt på NE-bilagedraftet."
      : "Record allocations and withdrawals for periodiseringsfond (up to 30% of surplus) and expansionsfond. These are applied automatically to the NE-bilaga draft."
  };

  const business = await ensureBusiness();

  let rawEntries: Awaited<ReturnType<typeof prisma.periodisationEntry.findMany>> = [];
  try {
    rawEntries = await prisma.periodisationEntry.findMany({
      where: { businessId: business.id },
      orderBy: [{ taxYear: "desc" }, { createdAt: "desc" }]
    });
  } catch {
    // Table may not exist before migration.
  }

  const entries = rawEntries.map((e) => ({
    id: e.id,
    entryType: e.entryType,
    direction: e.direction,
    taxYear: e.taxYear,
    amount: asNumber(e.amount as unknown as string | number),
    notes: e.notes,
    createdAt: e.createdAt.toISOString()
  }));

  const pfBalance = round2(
    entries
      .filter((e) => e.entryType === "periodiseringsfond")
      .reduce((sum, e) => (e.direction === "allocation" ? sum + e.amount : sum - e.amount), 0)
  );

  const efBalance = round2(
    entries
      .filter((e) => e.entryType === "expansionsfond")
      .reduce((sum, e) => (e.direction === "allocation" ? sum + e.amount : sum - e.amount), 0)
  );

  return (
    <section className="page">
      <h1 className="title">{copy.title}</h1>
      <p className="subtitle">{copy.subtitle}</p>

      <article className="card" id="periodiseringsfond-manager">
        <PeriodiseringsfondManager
          locale={locale}
          initial={entries}
          pfBalance={pfBalance}
          efBalance={efBalance}
          currentYear={new Date().getFullYear()}
        />
      </article>
    </section>
  );
}
