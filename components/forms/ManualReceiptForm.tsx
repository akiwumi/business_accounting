"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { type Locale } from "@/lib/i18n/locale";

type ManualReceiptResponse = {
  receipt?: {
    id: string;
    receiptNumber?: string;
    vendor?: string;
    grossAmount?: number;
    currency?: string;
    needsReview?: boolean;
  };
  transaction?: {
    id: string;
  } | null;
  error?: string;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export const ManualReceiptForm = ({
  locale,
  activeYear,
  activeMonth
}: {
  locale: Locale;
  activeYear?: number;
  activeMonth?: number | null;
}) => {
  const router = useRouter();
  const copy =
    locale === "sv"
      ? {
          title: "Manuell kvittoinmatning",
          subtitle: "Lägg till en utgående betalning från kvitto utan filuppladdning.",
          receiptNumber: "Kvittonummer",
          vendor: "Leverantör",
          description: "Beskrivning",
          date: "Kvitto-datum",
          amount: "Bruttobelopp",
          vatRate: "Momssats (decimal)",
          currency: "Valuta",
          category: "Kategori",
          office: "Kontor",
          consumables: "Förbrukningsmaterial",
          accounting: "Redovisning",
          bankFee: "Bankavgift",
          other: "Övrigt",
          submit: "Spara manuellt kvitto",
          saving: "Sparar...",
          missingAmount: "Belopp måste vara större än 0.",
          invalidCurrency: "Ange en valutakod med tre bokstäver, till exempel SEK eller USD.",
          success: "Manuellt kvitto sparat.",
          failed: "Kunde inte spara manuellt kvitto.",
          unknown: "Okänt fel",
          receiptId: "Kvitto-ID",
          receiptNumberLabel: "Kvittonummer",
          transactionId: "Transaktions-ID",
          openReview: "Öppna granskning",
          savedOutsideFilterYear: "Kvitto sparat, men utfärdandeåret matchar inte nuvarande filter.",
          savedOutsideFilterMonth: "Kvitto sparat, men utfärdandemånaden matchar inte nuvarande filter."
        }
      : {
          title: "Manual Receipt Entry",
          subtitle: "Add an outgoing payment from a receipt without uploading a file.",
          receiptNumber: "Receipt Number",
          vendor: "Vendor",
          description: "Description",
          date: "Receipt date",
          amount: "Gross amount",
          vatRate: "VAT rate (decimal)",
          currency: "Currency",
          category: "Category",
          office: "Office",
          consumables: "Consumables",
          accounting: "Accounting",
          bankFee: "Bank fee",
          other: "Other",
          submit: "Save manual receipt",
          saving: "Saving...",
          missingAmount: "Amount must be greater than 0.",
          invalidCurrency: "Use a 3-letter currency code such as SEK or USD.",
          success: "Manual receipt saved.",
          failed: "Failed to save manual receipt.",
          unknown: "Unknown error",
          receiptId: "Receipt ID",
          receiptNumberLabel: "Receipt Number",
          transactionId: "Transaction ID",
          openReview: "Open Review",
          savedOutsideFilterYear: "Receipt saved, but the issue year does not match the current filter.",
          savedOutsideFilterMonth: "Receipt saved, but the issue month does not match the current filter."
        };

  const categories = [
    { value: "office", label: copy.office },
    { value: "consumables", label: copy.consumables },
    { value: "accounting", label: copy.accounting },
    { value: "bank_fee", label: copy.bankFee },
    { value: "other", label: copy.other }
  ];

  const [vendor, setVendor] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [description, setDescription] = useState("");
  const [receiptDate, setReceiptDate] = useState(todayIso());
  const [grossAmount, setGrossAmount] = useState("");
  const [vatRate, setVatRate] = useState("0.25");
  const [currency, setCurrency] = useState("SEK");
  const [category, setCategory] = useState("office");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ManualReceiptResponse | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = Number(grossAmount.replace(",", "."));
    const parsedVatRate = Number(vatRate.replace(",", "."));
    const normalizedCurrency = currency.trim().toUpperCase();

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(copy.missingAmount);
      return;
    }

    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      setError(copy.invalidCurrency);
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/receipts/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor: vendor.trim() || undefined,
          receiptNumber: receiptNumber.trim() || undefined,
          description: description.trim() || undefined,
          receiptDate,
          grossAmount: parsedAmount,
          vatRate: Number.isFinite(parsedVatRate) ? parsedVatRate : 0.25,
          currency: normalizedCurrency,
          category
        })
      });
      const json = (await response.json()) as ManualReceiptResponse;
      if (!response.ok) {
        throw new Error(json.error ?? copy.failed);
      }

      setResult(json);
      setGrossAmount("");
      setDescription("");
      setVendor("");
      setReceiptNumber("");
      setCategory("office");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : copy.unknown);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="stack" onSubmit={onSubmit}>
      <h3>{copy.title}</h3>
      <p className="note">{copy.subtitle}</p>

      <div className="row">
        <label className="stack">
          {copy.receiptNumber}
          <input value={receiptNumber} onChange={(event) => setReceiptNumber(event.target.value)} />
        </label>
        <label className="stack">
          {copy.vendor}
          <input value={vendor} onChange={(event) => setVendor(event.target.value)} />
        </label>
        <label className="stack">
          {copy.description}
          <input value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
      </div>

      <div className="row">
        <label className="stack">
          {copy.date}
          <input type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} />
        </label>
        <label className="stack">
          {copy.amount}
          <input
            type="number"
            step="0.01"
            min="0"
            value={grossAmount}
            onChange={(event) => setGrossAmount(event.target.value)}
          />
        </label>
        <label className="stack">
          {copy.vatRate}
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={vatRate}
            onChange={(event) => setVatRate(event.target.value)}
          />
        </label>
      </div>

      <div className="row">
        <label className="stack">
          {copy.currency}
          <input
            value={currency}
            maxLength={3}
            placeholder="SEK / EUR / USD"
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          />
        </label>

        <label className="stack">
          {copy.category}
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="row">
        <button type="submit" disabled={submitting}>
          {submitting ? copy.saving : copy.submit}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {result?.receipt && (
        <div className="card">
          <p className="success">{copy.success}</p>
          <p className="note">
            {copy.receiptId}: {result.receipt.id}
          </p>
          <p className="note">
            {copy.receiptNumberLabel}: {result.receipt.receiptNumber ?? "-"}
          </p>
          <p className="note">
            {copy.transactionId}: {result.transaction?.id ?? "-"}
          </p>
          {(() => {
            const issue = receiptDate;
            if (!issue) return null;
            const [issueYearRaw, issueMonthRaw] = issue.split("-");
            const issueYear = Number(issueYearRaw);
            const issueMonth = Number(issueMonthRaw);
            if (!Number.isFinite(issueYear) || !Number.isFinite(issueMonth)) return null;

            if (activeYear && issueYear !== activeYear) {
              return <p className="badge warn">{copy.savedOutsideFilterYear}</p>;
            }
            if (activeMonth && issueMonth !== activeMonth) {
              return <p className="badge warn">{copy.savedOutsideFilterMonth}</p>;
            }
            return null;
          })()}
          <Link className="button secondary" href={`/review/receipts/${result.receipt.id}`}>
            {copy.openReview}
          </Link>
        </div>
      )}
    </form>
  );
};
