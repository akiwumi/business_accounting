import { MileageLog } from "@/components/mileage/MileageLog";
import { ensureBusiness } from "@/lib/data/business";
import { prisma } from "@/lib/db";
import { getRequestLocale } from "@/lib/i18n/locale";
import { asNumber } from "@/lib/accounting/math";

export default async function MileagePage() {
  const locale = getRequestLocale();
  const sv = locale === "sv";
  const currentYear = new Date().getFullYear();

  const copy = {
    title: sv ? "Körjournal" : "Mileage Log",
    subtitle: sv
      ? `Dokumentera tjänsteresor och beräkna milersättningsavdraget (${currentYear}). Krävs för att styrka avdrag vid Inkomstdeklaration 1.`
      : `Document business trips and calculate the mileage deduction (${currentYear}). Required to substantiate the deduction on Inkomstdeklaration 1.`
  };

  const business = await ensureBusiness();

  let rawEntries: Awaited<ReturnType<typeof prisma.mileageEntry.findMany>> = [];
  try {
    rawEntries = await prisma.mileageEntry.findMany({
      where: {
        businessId: business.id,
        tripDate: {
          gte: new Date(`${currentYear}-01-01`),
          lte: new Date(`${currentYear}-12-31`)
        }
      },
      orderBy: { tripDate: "desc" }
    });
  } catch {
    // Table may not exist before migration.
  }

  const entries = rawEntries.map((e) => ({
    id: e.id,
    tripDate: e.tripDate.toISOString(),
    destination: e.destination,
    purpose: e.purpose,
    kilometers: asNumber(e.kilometers as unknown as string | number),
    ratePerKm: asNumber(e.ratePerKm as unknown as string | number),
    deductionAmount: asNumber(e.deductionAmount as unknown as string | number),
    notes: e.notes
  }));

  return (
    <section className="page">
      <h1 className="title">{copy.title}</h1>
      <p className="subtitle">{copy.subtitle}</p>

      <article className="card" id="mileage-log">
        <MileageLog locale={locale} initial={entries} currentYear={currentYear} />
      </article>
    </section>
  );
}
