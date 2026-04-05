import { ensureBusiness } from "@/lib/data/business";
import { prisma } from "@/lib/db";
import { getRequestLocale } from "@/lib/i18n/locale";
import { asNumber } from "@/lib/accounting/math";

type CheckItem = {
  id: string;
  category: string;
  label: string;
  detail: string;
  deadline?: string;
  status: "ok" | "warn" | "info";
};

export default async function CompliancePage() {
  const locale = getRequestLocale();
  const sv = locale === "sv";
  const now = new Date();
  const taxYear = now.getFullYear() - 1; // previous (filing) year
  const filingYear = now.getFullYear();

  const copy = {
    title: sv ? "Skatteöversikt & kravlista" : "Tax Compliance Checklist",
    subtitle: sv
      ? `Kravlista och viktiga datum för enskild firma. Skatteår ${taxYear} – deklaration ${filingYear}.`
      : `Requirements and key deadlines for Swedish sole traders. Tax year ${taxYear} – filing year ${filingYear}.`,
    statusOk: sv ? "Klart" : "Done",
    statusWarn: sv ? "Saknas" : "Missing",
    statusInfo: sv ? "Notera" : "Note",
    categoriesLabel: sv ? "Kategori" : "Category",
    deadlineLabel: sv ? "Senast" : "Deadline",
    infoNote: sv
      ? "Detta är en informativ kravlista. Kontrollera alltid med Skatteverket inför deklaration."
      : "This is an informational checklist. Always verify with Skatteverket before filing."
  };

  const business = await ensureBusiness();
  const fresh = await prisma.business.findUnique({
    where: { id: business.id },
    include: { taxConfig: true }
  });

  // Count key data
  const transactionCount = await prisma.transaction.count({
    where: {
      businessId: business.id,
      txnDate: {
        gte: new Date(`${taxYear}-01-01`),
        lte: new Date(`${taxYear}-12-31`)
      }
    }
  });

  const receiptCount = await prisma.receipt.count({ where: { businessId: business.id } });
  const invoiceCount = await prisma.invoice.count({ where: { businessId: business.id } });

  let assetCount = 0;
  let mileageCount = 0;
  let periodisationCount = 0;
  try {
    assetCount = await prisma.fixedAsset.count({ where: { businessId: business.id } });
    mileageCount = await prisma.mileageEntry.count({
      where: {
        businessId: business.id,
        tripDate: { gte: new Date(`${taxYear}-01-01`), lte: new Date(`${taxYear}-12-31`) }
      }
    });
    periodisationCount = await prisma.periodisationEntry.count({
      where: { businessId: business.id, taxYear }
    });
  } catch {
    // New tables may not exist yet.
  }

  const b = fresh as typeof fresh & {
    sniCode?: string | null;
    vatNumber?: string | null;
    fSkattRegistered?: boolean;
    personnummer?: string | null;
  };

  const hasTaxConfig = Boolean(fresh?.taxConfig);
  const hasSni = Boolean(b?.sniCode);
  const hasVatNumber = Boolean(b?.vatNumber);
  const hasFSkatt = Boolean(b?.fSkattRegistered);
  const hasPersonnummer = Boolean(b?.personnummer);
  const vatRegistered = fresh?.vatRegistered ?? false;
  const vatFrequency = fresh?.vatFrequency ?? "yearly";

  // VAT deadline string
  const vatDeadline =
    vatFrequency === "yearly"
      ? sv ? `12 maj ${filingYear}` : `12 May ${filingYear}`
      : vatFrequency === "quarterly"
      ? sv ? "12:e i andra månaden efter kvartal" : "12th of 2nd month after quarter"
      : sv ? "26:e i månaden efter perioden" : "26th of month following period";

  const checks: CheckItem[] = [
    // ── Registration ──────────────────────────────────────────────────────
    {
      id: "fskatt",
      category: sv ? "Registrering" : "Registration",
      label: sv ? "Godkänd för F-skatt" : "F-tax approval (F-skatt)",
      detail: sv
        ? "Alla enskilda firmor behöver F-skatt för att fakturera utan källskatteavdrag. Anges på alla fakturor."
        : "All sole traders need F-tax approval to invoice without tax deduction at source. Must appear on all invoices.",
      status: hasFSkatt ? "ok" : "warn"
    },
    {
      id: "sni",
      category: sv ? "Registrering" : "Registration",
      label: sv ? "SNI-kod registrerad" : "SNI industry code registered",
      detail: sv
        ? `SNI-kod: ${b?.sniCode ?? "–"}. Registrera på verksamt.se. Uppdatera till SNI 2025-systemet.`
        : `SNI code: ${b?.sniCode ?? "–"}. Register at verksamt.se. Update to the SNI 2025 classification.`,
      status: hasSni ? "ok" : "warn"
    },
    {
      id: "vatnum",
      category: sv ? "Registrering" : "Registration",
      label: sv ? "Momsregistreringsnummer" : "VAT registration number",
      detail: sv
        ? `Momsregistreringsnummer: ${b?.vatNumber ?? "–"}. Format SE + personnummer + 01. Ska anges på alla momspliktiga fakturor.`
        : `VAT number: ${b?.vatNumber ?? "–"}. Format SE + personal number + 01. Must appear on all VAT invoices.`,
      status: vatRegistered ? (hasVatNumber ? "ok" : "warn") : "info"
    },
    {
      id: "personnummer",
      category: sv ? "Registrering" : "Registration",
      label: sv ? "Personnummer registrerat i appen" : "Personal identity number in app",
      detail: sv
        ? "Personnumret behövs för Inkomstdeklaration 1. Lagras lokalt och delas aldrig."
        : "Required for Inkomstdeklaration 1. Stored locally only.",
      status: hasPersonnummer ? "ok" : "warn"
    },

    // ── Bookkeeping ───────────────────────────────────────────────────────
    {
      id: "bookkeeping",
      category: sv ? "Bokföring" : "Bookkeeping",
      label: sv ? "Löpande bokföring" : "Current bookkeeping",
      detail: sv
        ? `${transactionCount} transaktioner bokförda för ${taxYear}. Kontrollera att alla intäkter och kostnader är bokförda.`
        : `${transactionCount} transactions posted for ${taxYear}. Ensure all income and expenses are recorded.`,
      status: transactionCount > 0 ? "ok" : "warn"
    },
    {
      id: "receipts",
      category: sv ? "Bokföring" : "Bookkeeping",
      label: sv ? "Kvitton lagrade (7 år)" : "Receipts stored (7-year retention)",
      detail: sv
        ? `${receiptCount} kvitton lagrade. Alla underlag ska bevaras i minst 7 år.`
        : `${receiptCount} receipts stored. All documentation must be retained for at least 7 years.`,
      status: receiptCount > 0 ? "ok" : "warn"
    },
    {
      id: "invoices",
      category: sv ? "Bokföring" : "Bookkeeping",
      label: sv ? "Fakturor utfärdade" : "Invoices issued",
      detail: sv
        ? `${invoiceCount} fakturor. Kontrollera att alla fakturor innehåller momsnummer, F-skattstatus och org.nr.`
        : `${invoiceCount} invoices. Verify that all invoices include VAT number, F-tax status and org number.`,
      status: invoiceCount > 0 ? "ok" : "info"
    },
    {
      id: "assets",
      category: sv ? "Bokföring" : "Bookkeeping",
      label: sv ? "Inventarieregister" : "Fixed asset register",
      detail: sv
        ? `${assetCount} tillgångar registrerade. Inventarier (>25 000 kr) ska aktiveras och skrivas av. Avskrivningar förs automatiskt till NE-bilagan.`
        : `${assetCount} assets recorded. Equipment (> SEK 25,000) must be capitalised and depreciated. Depreciation feeds automatically into the NE-bilaga.`,
      status: assetCount > 0 ? "ok" : "info"
    },
    {
      id: "mileage",
      category: sv ? "Avdrag" : "Deductions",
      label: sv ? "Körjournal (milersättning)" : "Mileage log (Körjournal)",
      detail: sv
        ? `${mileageCount} resor loggade för ${taxYear}. Skatteverkets schablonersättning: 1,85 kr/km. Körjournalen krävs som underlag.`
        : `${mileageCount} trips logged for ${taxYear}. Skatteverket standard rate: SEK 1.85/km. The mileage log is required as documentation.`,
      status: mileageCount > 0 ? "ok" : "info"
    },
    {
      id: "periodisering",
      category: sv ? "Skatteplanering" : "Tax Planning",
      label: sv ? "Periodiseringsfond / Expansionsfond" : "Tax allocation reserve (Periodiseringsfond)",
      detail: sv
        ? `${periodisationCount} poster registrerade för ${taxYear}. Du kan sätta av upp till 30 % av årets överskott för att sänka skatten.`
        : `${periodisationCount} entries for ${taxYear}. You can allocate up to 30% of the year's surplus to reduce tax.`,
      status: periodisationCount > 0 ? "ok" : "info"
    },
    {
      id: "taxconfig",
      category: sv ? "Skatteprognos" : "Tax Estimate",
      label: sv ? "Skattekonfiguration" : "Tax configuration",
      detail: sv
        ? "Kommunal skattesats, egenavgifter och allmänt avdrag konfigurerade. Kontrollera under Inställningar."
        : "Municipal tax rate, social contributions and general deduction configured. Review under Settings.",
      status: hasTaxConfig ? "ok" : "warn"
    },

    // ── VAT ───────────────────────────────────────────────────────────────
    {
      id: "vat_threshold",
      category: sv ? "Moms" : "VAT",
      label: sv ? "Momsregistreringsgräns" : "VAT registration threshold",
      detail: sv
        ? "Momsregistrering är obligatorisk om omsättningen överstiger 120 000 kr/år. Frivillig registrering tillåts under gränsen."
        : "VAT registration is mandatory when annual turnover exceeds SEK 120,000. Voluntary registration is allowed below the threshold.",
      status: "info"
    },
    {
      id: "vat_return",
      category: sv ? "Moms" : "VAT",
      label: sv ? "Momsdeklaration" : "VAT return",
      detail: sv
        ? `Momsredovisningsperiod: ${vatFrequency === "yearly" ? "årsvis" : vatFrequency === "quarterly" ? "kvartalsvis" : "månadsvis"}. Senast: ${vatDeadline}.`
        : `VAT frequency: ${vatFrequency}. Deadline: ${vatDeadline}.`,
      deadline: vatDeadline,
      status: vatRegistered ? "info" : "info"
    },

    // ── Filing deadlines ──────────────────────────────────────────────────
    {
      id: "inkomstdekl",
      category: sv ? "Deklarationsfrister" : "Filing Deadlines",
      label: sv ? "Inkomstdeklaration 1 + NE-bilaga" : "Inkomstdeklaration 1 + NE-bilaga",
      detail: sv
        ? `Lämna in Inkomstdeklaration 1 med NE-bilagan till Skatteverket. Senast: 4 maj ${filingYear} (pappers) / 2 maj ${filingYear} (e-tjänst). Använd NE-bilagedraftet under Rapporter.`
        : `File Inkomstdeklaration 1 with the NE-bilaga to Skatteverket. Deadline: 4 May ${filingYear} (paper) / 2 May ${filingYear} (e-service). Use the NE-bilaga draft under Reports.`,
      deadline: sv ? `4 maj ${filingYear}` : `4 May ${filingYear}`,
      status: "info"
    },
    {
      id: "vat_annual",
      category: sv ? "Deklarationsfrister" : "Filing Deadlines",
      label: sv ? "Momsdeklaration (årsvis)" : "Annual VAT return",
      detail: sv
        ? `Om du redovisar moms årsvis: senast 12 maj ${filingYear} för skatteår ${taxYear}.`
        : `If reporting VAT annually: deadline 12 May ${filingYear} for tax year ${taxYear}.`,
      deadline: sv ? `12 maj ${filingYear}` : `12 May ${filingYear}`,
      status: "info"
    },
    {
      id: "bookkeeping_retention",
      category: sv ? "Deklarationsfrister" : "Filing Deadlines",
      label: sv ? "Räkenskapsunderlag – bevarandetid" : "Accounting records – retention period",
      detail: sv
        ? "Alla räkenskapshandlingar ska bevaras i minst 7 år från räkenskapsårets utgång."
        : "All accounting records must be retained for at least 7 years from the end of the financial year.",
      status: "info"
    },
    {
      id: "simplified_accounts",
      category: sv ? "Bokslut" : "Annual Accounts",
      label: sv ? "Förenklat bokslut (≤ 3 Mkr omsättning)" : "Simplified annual accounts (≤ SEK 3M turnover)",
      detail: sv
        ? "Enskild firma med omsättning upp till 3 000 000 kr/år får använda förenklat årsbokslut (K1-reglerna). Exportera bokföringsunderlaget via Rapporter."
        : "Sole traders with turnover up to SEK 3,000,000/year may use simplified annual accounts (K1 rules). Export accounting data via Reports.",
      status: "info"
    },
    {
      id: "preliminary_tax",
      category: sv ? "Skattebetalning" : "Tax Payments",
      label: sv ? "Preliminärskatt (F-skatt)" : "Preliminary tax (F-skatt payments)",
      detail: sv
        ? "F-skatten betalas månadsvis eller kvartalsvis baserat på din debiterade preliminärskatt. Justera via en preliminär inkomstdeklaration om inkomsten ändras väsentligt."
        : "F-tax is paid monthly or quarterly based on your assessed preliminary tax. Adjust via a preliminary income tax return if income changes significantly.",
      status: "info"
    },
    {
      id: "egenavgifter",
      category: sv ? "Skattebetalning" : "Tax Payments",
      label: sv ? "Egenavgifter (~28,97 %)" : "Self-employment contributions (Egenavgifter ~28.97%)",
      detail: sv
        ? "Egenavgifter beräknas på nettoinkomsten. Avdrag medges med 25 % av avgifterna. Konfigureras under Inställningar → Skatteprognosnivåer."
        : "Self-employment contributions are calculated on net income. A deduction of 25% of contributions is allowed. Configure under Settings → Tax Projection Rates.",
      status: hasTaxConfig ? "ok" : "warn"
    },
    {
      id: "rot_rut",
      category: sv ? "Avdrag" : "Deductions",
      label: sv ? "ROT- och RUT-avdrag (tjänsteleverantörer)" : "ROT/RUT deductions (service providers)",
      detail: sv
        ? "Om du utför ROT-arbete (30 % avdrag) eller RUT-tjänster (50 % avdrag) på uppdrag av kund, begär utbetalning från Skatteverket via e-tjänst. Max 75 000 kr/kund/år (ROT max 50 000 kr). Kräver kundens personnummer."
        : "If you perform ROT work (30% deduction) or RUT services (50% deduction) for clients, apply for payment from Skatteverket via e-service. Max SEK 75,000/client/year (ROT max SEK 50,000). Client personal number required.",
      status: "info"
    }
  ];

  const statusColor = (s: "ok" | "warn" | "info") =>
    s === "ok" ? "#155724" : s === "warn" ? "#721c24" : "#0c5460";
  const statusBg = (s: "ok" | "warn" | "info") =>
    s === "ok" ? "#d4edda" : s === "warn" ? "#f8d7da" : "#d1ecf1";
  const statusLabel = (s: "ok" | "warn" | "info") =>
    s === "ok" ? copy.statusOk : s === "warn" ? copy.statusWarn : copy.statusInfo;

  const categories = [...new Set(checks.map((c) => c.category))];

  return (
    <section className="page">
      <h1 className="title">{copy.title}</h1>
      <p className="subtitle">{copy.subtitle}</p>
      <p className="note">{copy.infoNote}</p>

      {/* Summary KPIs */}
      <div className="grid">
        <article className="card">
          <p className="label">{sv ? "Klara krav" : "Complete"}</p>
          <p className="kpi" style={{ color: "#155724" }}>
            {checks.filter((c) => c.status === "ok").length} / {checks.length}
          </p>
        </article>
        <article className="card">
          <p className="label">{sv ? "Saknas / åtgärdas" : "Missing / Action needed"}</p>
          <p className="kpi" style={{ color: "#721c24" }}>
            {checks.filter((c) => c.status === "warn").length}
          </p>
        </article>
        <article className="card">
          <p className="label">{sv ? "Notera" : "For information"}</p>
          <p className="kpi" style={{ color: "#0c5460" }}>
            {checks.filter((c) => c.status === "info").length}
          </p>
        </article>
      </div>

      {/* Checklist by category */}
      {categories.map((category) => (
        <article className="card" key={category}>
          <h2>{category}</h2>
          <div className="stack">
            {checks
              .filter((c) => c.category === category)
              .map((check) => (
                <div
                  key={check.id}
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                    padding: "0.75rem",
                    borderRadius: 6,
                    background: statusBg(check.status),
                    border: `1px solid ${statusColor(check.status)}22`
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: "0.75em",
                      fontWeight: 700,
                      background: statusBg(check.status),
                      color: statusColor(check.status),
                      border: `1px solid ${statusColor(check.status)}`
                    }}
                  >
                    {statusLabel(check.status)}
                  </span>
                  <div className="stack" style={{ gap: "0.25rem" }}>
                    <strong style={{ fontSize: "0.9em" }}>{check.label}</strong>
                    <p className="note" style={{ margin: 0 }}>{check.detail}</p>
                    {check.deadline && (
                      <p className="note" style={{ margin: 0, fontWeight: 600 }}>
                        {copy.deadlineLabel}: {check.deadline}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </article>
      ))}
    </section>
  );
}
