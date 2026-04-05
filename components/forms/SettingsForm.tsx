"use client";

import { useState } from "react";
import { Jurisdictions, type Jurisdiction } from "@/lib/domain/enums";
import { type Locale } from "@/lib/i18n/locale";

type SettingsFormProps = {
  locale: Locale;
  initial: {
    name: string;
    jurisdiction: Jurisdiction;
    locale: string;
    baseCurrency: string;
    bookkeepingMethod: string;
    vatRegistered: boolean;
    vatFrequency: string;
    fiscalYearStartMonth: number;
    sniCode: string;
    vatNumber: string;
    fSkattRegistered: boolean;
    personnummer: string;
    invoiceNumberPattern: string;
    invoiceSenderName: string;
    invoiceSenderAddress: string;
    invoiceSenderOrgNumber: string;
    invoiceSenderEmail: string;
    invoiceSenderPhone: string;
    invoiceSenderWebsite: string;
    invoiceEmailFrom: string;
    invoiceDefaultLogo: string;
    invoiceDefaultSignature: string;
    taxConfig: {
      municipalTaxRate: number;
      socialContributionRate: number;
      generalDeductionRate: number;
    } | null;
  };
};

const readFileAsDataUrl = async (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read selected file."));
    reader.readAsDataURL(file);
  });

export const SettingsForm = ({ initial, locale: uiLocale }: SettingsFormProps) => {
  const copy =
    uiLocale === "sv"
      ? {
          businessName: "Företagsnamn",
          jurisdiction: "Jurisdiktion",
          sweden: "Sverige",
          euGeneric: "EU generell (mall)",
          uk: "Storbritannien (mall)",
          language: "Språk",
          english: "Engelska",
          swedish: "Svenska",
          currency: "Valuta",
          bookkeepingMethod: "Bokföringsmetod",
          kontantmetoden: "Kontantmetoden (kontantbas)",
          fakturametoden: "Fakturametoden (periodiserad)",
          vatRegistered: "Momsregistrerad",
          vatFrequency: "Momsredovisningsperiod",
          vatMonthly: "Månadsvis",
          vatQuarterly: "Kvartalsvis",
          vatYearly: "Årsvis",
          fiscalYearRange: "Skatteår (12 månader)",
          taxYearFrom: "Från månad",
          taxYearTo: "Till månad",
          taxYearHint: "Välj startmånad. Slutmånad beräknas automatiskt.",
          swedishRegSection: "Svenska registreringsuppgifter",
          sniCode: "SNI-kod (branschkod)",
          sniCodeHint: "5-siffrig SNI 2007-kod som beskriver din verksamhet. Hämta på verksamt.se.",
          vatNumber: "Momsregistreringsnummer",
          vatNumberHint: "Format: SE + personnummer/orgnr + 01, t.ex. SE123456789001.",
          fSkattRegistered: "Godkänd för F-skatt",
          fSkattHint: "Anger att du är godkänd för F-skatt av Skatteverket. Ska anges på alla fakturor.",
          personnummer: "Personnummer (för deklaration)",
          personnummerHint: "Ditt personnummer används vid inkomstdeklaration. Lagras lokalt.",
          invoicing: "Fakturainställningar",
          numberingPattern: "Fakturanummermönster",
          numberingHint: "Använd {YYYY}, {YY}, {MM}, {DD} och {SEQ} eller {SEQ:4}.",
          senderName: "Avsändarnamn",
          senderAddress: "Avsändaradress",
          senderOrgNumber: "Org.nr / Personnummer",
          senderEmail: "Avsändar-e-post",
          senderPhone: "Avsändartelefon",
          senderWebsite: "Avsändarwebbplats",
          emailFrom: "Från-adress för faktura-e-post",
          logo: "Standardlogotyp",
          signature: "Standardsignatur",
          chooseImage: "Välj bild",
          clearImage: "Rensa",
          taxRates: "Skatteprognosnivåer",
          taxRatesNote: "Ange decimalvärden. Exempel: 0.32 = 32 %.",
          municipalTax: "Kommunal skattesats",
          socialContribution: "Egenavgifter",
          deduction: "Allmänt avdrag (ca 25 % av egenavgifter)",
          save: "Spara inställningar",
          saving: "Sparar...",
          saved: "Inställningarna sparades.",
          savedLocalOnly: "Inställningarna sparades lokalt på den här datorn.",
          failed: "Kunde inte spara inställningar",
          unknownError: "Okänt fel",
          yes: "Ja",
          no: "Nej"
        }
      : {
          businessName: "Business name",
          jurisdiction: "Jurisdiction",
          sweden: "Sweden",
          euGeneric: "EU Generic (Template)",
          uk: "United Kingdom (Template)",
          language: "Language",
          english: "English",
          swedish: "Swedish",
          currency: "Currency",
          bookkeepingMethod: "Bookkeeping method",
          kontantmetoden: "Cash basis (Kontantmetoden)",
          fakturametoden: "Accrual basis (Fakturametoden)",
          vatRegistered: "VAT registered",
          vatFrequency: "VAT reporting period",
          vatMonthly: "Monthly",
          vatQuarterly: "Quarterly",
          vatYearly: "Annual",
          fiscalYearRange: "Tax Year (12 months)",
          taxYearFrom: "From month",
          taxYearTo: "To month",
          taxYearHint: "Choose the start month. The end month is calculated automatically.",
          swedishRegSection: "Swedish Registration Details",
          sniCode: "SNI code (Industry code)",
          sniCodeHint: "5-digit SNI 2007 code describing your business. Look up at verksamt.se.",
          vatNumber: "VAT registration number (Momsregistreringsnummer)",
          vatNumberHint: "Format: SE + personal/org number + 01, e.g. SE123456789001.",
          fSkattRegistered: "Approved for F-tax (F-skatt)",
          fSkattHint: "Indicates you are approved for F-tax by Skatteverket. Must be stated on all invoices.",
          personnummer: "Personal identity number (for tax return)",
          personnummerHint: "Your personnummer is used when filing Inkomstdeklaration 1. Stored locally only.",
          invoicing: "Invoice Settings",
          numberingPattern: "Invoice number pattern",
          numberingHint: "Use {YYYY}, {YY}, {MM}, {DD} and {SEQ} or {SEQ:4}.",
          senderName: "Sender name",
          senderAddress: "Sender address",
          senderOrgNumber: "Org. / Personal number",
          senderEmail: "Sender email",
          senderPhone: "Sender phone",
          senderWebsite: "Sender website",
          emailFrom: "Invoice email from address",
          logo: "Default logo",
          signature: "Default signature",
          chooseImage: "Choose image",
          clearImage: "Clear",
          taxRates: "Tax Projection Rates",
          taxRatesNote: "Set decimal rates. Example: 0.32 = 32%.",
          municipalTax: "Municipal tax rate",
          socialContribution: "Social contribution rate (Egenavgifter)",
          deduction: "General deduction (~25% of social contributions)",
          save: "Save Settings",
          saving: "Saving...",
          saved: "Settings saved.",
          savedLocalOnly: "Settings saved locally on this machine.",
          failed: "Failed to save settings",
          unknownError: "Unknown error",
          yes: "Yes",
          no: "No"
        };

  const [name, setName] = useState(initial.name);
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>(initial.jurisdiction);
  const [locale, setLocale] = useState(initial.locale || "en");
  const [baseCurrency, setBaseCurrency] = useState(initial.baseCurrency || "SEK");
  const [bookkeepingMethod, setBookkeepingMethod] = useState(initial.bookkeepingMethod || "kontantmetoden");
  const [vatRegistered, setVatRegistered] = useState(initial.vatRegistered ?? true);
  const [vatFrequency, setVatFrequency] = useState(initial.vatFrequency || "yearly");
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(
    Number.isInteger(initial.fiscalYearStartMonth) ? initial.fiscalYearStartMonth : 1
  );
  // Swedish registration
  const [sniCode, setSniCode] = useState(initial.sniCode || "");
  const [vatNumber, setVatNumber] = useState(initial.vatNumber || "");
  const [fSkattRegistered, setFSkattRegistered] = useState(initial.fSkattRegistered ?? true);
  const [personnummer, setPersonnummer] = useState(initial.personnummer || "");
  // Invoice
  const [invoiceNumberPattern, setInvoiceNumberPattern] = useState(
    initial.invoiceNumberPattern || "INV-{YYYY}-{SEQ:4}"
  );
  const [invoiceSenderName, setInvoiceSenderName] = useState(initial.invoiceSenderName || "");
  const [invoiceSenderAddress, setInvoiceSenderAddress] = useState(initial.invoiceSenderAddress || "");
  const [invoiceSenderOrgNumber, setInvoiceSenderOrgNumber] = useState(initial.invoiceSenderOrgNumber || "");
  const [invoiceSenderEmail, setInvoiceSenderEmail] = useState(initial.invoiceSenderEmail || "");
  const [invoiceSenderPhone, setInvoiceSenderPhone] = useState(initial.invoiceSenderPhone || "");
  const [invoiceSenderWebsite, setInvoiceSenderWebsite] = useState(initial.invoiceSenderWebsite || "");
  const [invoiceEmailFrom, setInvoiceEmailFrom] = useState(initial.invoiceEmailFrom || "");
  const [invoiceDefaultLogo, setInvoiceDefaultLogo] = useState(initial.invoiceDefaultLogo || "");
  const [invoiceDefaultSignature, setInvoiceDefaultSignature] = useState(initial.invoiceDefaultSignature || "");
  // Tax rates
  const [municipalTaxRate, setMunicipalTaxRate] = useState(initial.taxConfig?.municipalTaxRate ?? 0.32);
  const [socialContributionRate, setSocialContributionRate] = useState(
    initial.taxConfig?.socialContributionRate ?? 0.2897
  );
  const [generalDeductionRate, setGeneralDeductionRate] = useState(
    initial.taxConfig?.generalDeductionRate ?? 0.25
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onImageSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
    setter: (value: string) => void
  ) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setter(dataUrl);
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : copy.unknownError);
    } finally {
      event.currentTarget.value = "";
    }
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          jurisdiction,
          locale,
          baseCurrency,
          bookkeepingMethod,
          vatRegistered,
          vatFrequency,
          fiscalYearStartMonth,
          sniCode,
          vatNumber,
          fSkattRegistered,
          personnummer,
          invoiceNumberPattern,
          invoiceSenderName,
          invoiceSenderAddress,
          invoiceSenderOrgNumber,
          invoiceSenderEmail,
          invoiceSenderPhone,
          invoiceSenderWebsite,
          invoiceEmailFrom,
          invoiceDefaultLogo,
          invoiceDefaultSignature,
          municipalTaxRate: Number(municipalTaxRate),
          socialContributionRate: Number(socialContributionRate),
          generalDeductionRate: Number(generalDeductionRate)
        })
      });

      const raw = await response.text();
      let json: { error?: string; savedLocally?: boolean; warning?: string } | null = null;
      if (raw) {
        try {
          json = JSON.parse(raw) as { error?: string };
        } catch {
          json = null;
        }
      }

      if (!response.ok) {
        const fallback = raw && !raw.startsWith("<") ? raw : copy.failed;
        throw new Error(json?.error ?? fallback);
      }

      try {
        await fetch("/api/locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale })
        });
      } catch {
        // Locale cookie update is non-critical for settings persistence.
      }

      setSuccess(json?.savedLocally ? copy.savedLocalOnly : copy.saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.unknownError);
    } finally {
      setSaving(false);
    }
  };

  const monthFormatter = new Intl.DateTimeFormat(uiLocale === "sv" ? "sv-SE" : "en-GB", { month: "long" });
  const monthOptions = Array.from({ length: 12 }, (_value, index) => ({
    value: index + 1,
    label: monthFormatter.format(new Date(Date.UTC(2026, index, 1)))
  }));
  const fiscalYearEndMonth = fiscalYearStartMonth === 1 ? 12 : fiscalYearStartMonth - 1;

  return (
    <form className="stack" onSubmit={save}>
      {/* ── Business Basics ─────────────────────────────────────────── */}
      <label className="stack">
        {copy.businessName}
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>

      <div className="row">
        <label className="stack">
          {copy.jurisdiction}
          <select
            value={jurisdiction}
            onChange={(event) => setJurisdiction(event.target.value as Jurisdiction)}
          >
            <option value={Jurisdictions.SWEDEN}>{copy.sweden}</option>
            <option value={Jurisdictions.EU_GENERIC}>{copy.euGeneric}</option>
            <option value={Jurisdictions.UK}>{copy.uk}</option>
          </select>
        </label>

        <label className="stack">
          {copy.language}
          <select value={locale} onChange={(event) => setLocale(event.target.value)}>
            <option value="en">{copy.english}</option>
            <option value="sv">{copy.swedish}</option>
          </select>
        </label>

        <label className="stack">
          {copy.currency}
          <select value={baseCurrency} onChange={(event) => setBaseCurrency(event.target.value)}>
            <option value="SEK">SEK</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </label>
      </div>

      <div className="row">
        <label className="stack">
          {copy.bookkeepingMethod}
          <select value={bookkeepingMethod} onChange={(event) => setBookkeepingMethod(event.target.value)}>
            <option value="kontantmetoden">{copy.kontantmetoden}</option>
            <option value="fakturametoden">{copy.fakturametoden}</option>
          </select>
        </label>

        <label className="stack">
          {copy.vatFrequency}
          <select value={vatFrequency} onChange={(event) => setVatFrequency(event.target.value)}>
            <option value="monthly">{copy.vatMonthly}</option>
            <option value="quarterly">{copy.vatQuarterly}</option>
            <option value="yearly">{copy.vatYearly}</option>
          </select>
        </label>

        <label className="stack">
          {copy.vatRegistered}
          <select
            value={vatRegistered ? "yes" : "no"}
            onChange={(event) => setVatRegistered(event.target.value === "yes")}
          >
            <option value="yes">{copy.yes}</option>
            <option value="no">{copy.no}</option>
          </select>
        </label>
      </div>

      <h3>{copy.fiscalYearRange}</h3>
      <div className="row">
        <label className="stack">
          {copy.taxYearFrom}
          <select
            value={String(fiscalYearStartMonth)}
            onChange={(event) => setFiscalYearStartMonth(Number(event.target.value))}
          >
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
          <span className="note">{copy.taxYearHint}</span>
        </label>

        <label className="stack">
          {copy.taxYearTo}
          <input value={monthOptions[fiscalYearEndMonth - 1]?.label ?? ""} readOnly />
        </label>
      </div>

      {/* ── Swedish Registration Details ─────────────────────────────── */}
      <h3>{copy.swedishRegSection}</h3>

      <div className="row">
        <label className="stack">
          {copy.sniCode}
          <input
            value={sniCode}
            onChange={(event) => setSniCode(event.target.value)}
            placeholder="62010"
            maxLength={10}
          />
          <span className="note">{copy.sniCodeHint}</span>
        </label>

        <label className="stack">
          {copy.vatNumber}
          <input
            value={vatNumber}
            onChange={(event) => setVatNumber(event.target.value)}
            placeholder="SE123456789001"
            maxLength={30}
          />
          <span className="note">{copy.vatNumberHint}</span>
        </label>
      </div>

      <div className="row">
        <label className="stack">
          {copy.fSkattRegistered}
          <select
            value={fSkattRegistered ? "yes" : "no"}
            onChange={(event) => setFSkattRegistered(event.target.value === "yes")}
          >
            <option value="yes">{copy.yes}</option>
            <option value="no">{copy.no}</option>
          </select>
          <span className="note">{copy.fSkattHint}</span>
        </label>

        <label className="stack">
          {copy.personnummer}
          <input
            value={personnummer}
            onChange={(event) => setPersonnummer(event.target.value)}
            placeholder="YYYYMMDD-XXXX"
            maxLength={20}
            autoComplete="off"
          />
          <span className="note">{copy.personnummerHint}</span>
        </label>
      </div>

      {/* ── Invoice Settings ─────────────────────────────────────────── */}
      <h3>{copy.invoicing}</h3>

      <label className="stack">
        {copy.numberingPattern}
        <input
          value={invoiceNumberPattern}
          onChange={(event) => setInvoiceNumberPattern(event.target.value)}
          placeholder="INV-{YYYY}-{SEQ:4}"
        />
        <span className="note">{copy.numberingHint}</span>
      </label>

      <div className="row">
        <label className="stack">
          {copy.senderName}
          <input value={invoiceSenderName} onChange={(event) => setInvoiceSenderName(event.target.value)} />
        </label>
        <label className="stack">
          {copy.senderOrgNumber}
          <input value={invoiceSenderOrgNumber} onChange={(event) => setInvoiceSenderOrgNumber(event.target.value)} />
        </label>
        <label className="stack">
          {copy.senderEmail}
          <input
            type="email"
            value={invoiceSenderEmail}
            onChange={(event) => setInvoiceSenderEmail(event.target.value)}
          />
        </label>
      </div>

      <div className="row">
        <label className="stack">
          {copy.senderPhone}
          <input value={invoiceSenderPhone} onChange={(event) => setInvoiceSenderPhone(event.target.value)} />
        </label>
        <label className="stack">
          {copy.senderWebsite}
          <input value={invoiceSenderWebsite} onChange={(event) => setInvoiceSenderWebsite(event.target.value)} />
        </label>
        <label className="stack">
          {copy.emailFrom}
          <input type="email" value={invoiceEmailFrom} onChange={(event) => setInvoiceEmailFrom(event.target.value)} />
        </label>
      </div>

      <label className="stack">
        {copy.senderAddress}
        <textarea
          rows={3}
          value={invoiceSenderAddress}
          onChange={(event) => setInvoiceSenderAddress(event.target.value)}
        />
      </label>

      <div className="row">
        <label className="stack">
          {copy.logo}
          <input type="file" accept="image/*" onChange={(event) => onImageSelect(event, setInvoiceDefaultLogo)} />
          {invoiceDefaultLogo ? (
            <div className="row">
              <img src={invoiceDefaultLogo} alt="Invoice logo preview" style={{ maxHeight: 42 }} />
              <button type="button" className="secondary" onClick={() => setInvoiceDefaultLogo("")}>
                {copy.clearImage}
              </button>
            </div>
          ) : (
            <span className="note">{copy.chooseImage}</span>
          )}
        </label>

        <label className="stack">
          {copy.signature}
          <input
            type="file"
            accept="image/*"
            onChange={(event) => onImageSelect(event, setInvoiceDefaultSignature)}
          />
          {invoiceDefaultSignature ? (
            <div className="row">
              <img src={invoiceDefaultSignature} alt="Invoice signature preview" style={{ maxHeight: 42 }} />
              <button type="button" className="secondary" onClick={() => setInvoiceDefaultSignature("")}>
                {copy.clearImage}
              </button>
            </div>
          ) : (
            <span className="note">{copy.chooseImage}</span>
          )}
        </label>
      </div>

      {/* ── Tax Projection Rates ─────────────────────────────────────── */}
      <h3>{copy.taxRates}</h3>
      <p className="note">{copy.taxRatesNote}</p>

      <div className="row">
        <label className="stack">
          {copy.municipalTax}
          <input
            type="number"
            step="0.0001"
            min={0}
            max={1}
            value={municipalTaxRate}
            onChange={(event) => setMunicipalTaxRate(Number(event.target.value))}
          />
        </label>

        <label className="stack">
          {copy.socialContribution}
          <input
            type="number"
            step="0.0001"
            min={0}
            max={1}
            value={socialContributionRate}
            onChange={(event) => setSocialContributionRate(Number(event.target.value))}
          />
        </label>

        <label className="stack">
          {copy.deduction}
          <input
            type="number"
            step="0.0001"
            min={0}
            max={1}
            value={generalDeductionRate}
            onChange={(event) => setGeneralDeductionRate(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="row">
        <button type="submit" disabled={saving}>
          {saving ? copy.saving : copy.save}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
    </form>
  );
};
