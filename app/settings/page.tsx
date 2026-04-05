import { SettingsForm } from "@/components/forms/SettingsForm";
import { SectionExportBar } from "@/components/layout/SectionExportBar";
import { asNumber } from "@/lib/accounting/math";
import { ensureBusiness } from "@/lib/data/business";
import { mergeBusinessWithLocalSettings, readLocalSettings } from "@/lib/data/localSettings";
import { getFiscalYearStartMonth } from "@/lib/data/period";
import { prisma } from "@/lib/db";
import { type Jurisdiction } from "@/lib/domain/enums";
import { getRequestLocale } from "@/lib/i18n/locale";

export default async function SettingsPage() {
  const locale = getRequestLocale();
  const copy =
    locale === "sv"
      ? {
          title: "Inställningar",
          subtitle: "Konfigurera registreringsuppgifter, bokföringsmetod, moms och skatteprognosnivåer."
        }
      : {
          title: "Settings",
          subtitle: "Configure registration details, bookkeeping method, VAT settings and tax projection rates."
        };

  const business = await ensureBusiness();
  const fresh = await prisma.business.findUnique({
    where: { id: business.id },
    include: { taxConfig: true }
  });
  if (!fresh) return null;
  const localSettings = await readLocalSettings();
  const effective = mergeBusinessWithLocalSettings(fresh, localSettings);

  return (
    <section className="page">
      <h1 className="title">{copy.title}</h1>
      <p className="subtitle">{copy.subtitle}</p>
      <SectionExportBar locale={locale} section="settings" />

      <article className="card" id="business-settings">
        <div id="tax-config">
          <SettingsForm
            locale={locale}
            initial={{
              name: effective.name,
              jurisdiction: effective.jurisdiction as Jurisdiction,
              locale: effective.locale,
              baseCurrency: effective.baseCurrency,
              bookkeepingMethod: effective.bookkeepingMethod,
              vatRegistered: effective.vatRegistered,
              vatFrequency: effective.vatFrequency,
              fiscalYearStartMonth: getFiscalYearStartMonth(effective.fiscalYearStart),
              sniCode: (effective as { sniCode?: string | null }).sniCode ?? "",
              vatNumber: (effective as { vatNumber?: string | null }).vatNumber ?? "",
              fSkattRegistered: (effective as { fSkattRegistered?: boolean }).fSkattRegistered ?? true,
              personnummer: (effective as { personnummer?: string | null }).personnummer ?? "",
              invoiceNumberPattern: effective.invoiceNumberPattern,
              invoiceSenderName: effective.invoiceSenderName ?? "",
              invoiceSenderAddress: effective.invoiceSenderAddress ?? "",
              invoiceSenderOrgNumber: effective.invoiceSenderOrgNumber ?? "",
              invoiceSenderEmail: effective.invoiceSenderEmail ?? "",
              invoiceSenderPhone: effective.invoiceSenderPhone ?? "",
              invoiceSenderWebsite: effective.invoiceSenderWebsite ?? "",
              invoiceEmailFrom: effective.invoiceEmailFrom ?? "",
              invoiceDefaultLogo: effective.invoiceDefaultLogo ?? "",
              invoiceDefaultSignature: effective.invoiceDefaultSignature ?? "",
              taxConfig: effective.taxConfig
                ? {
                    municipalTaxRate: asNumber(effective.taxConfig.municipalTaxRate as unknown as number | string),
                    socialContributionRate: asNumber(
                      effective.taxConfig.socialContributionRate as unknown as number | string
                    ),
                    generalDeductionRate: asNumber(
                      effective.taxConfig.generalDeductionRate as unknown as number | string
                    )
                  }
                : null
            }}
          />
        </div>
      </article>
    </section>
  );
}
