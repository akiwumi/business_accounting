"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { type Locale } from "@/lib/i18n/locale";

type ReceiptEditFormProps = {
  receiptId: string;
  locale: Locale;
  initial: {
    source: string;
    originalFileName: string;
    mimeType: string;
    createdDate: string;
    confidence: string;
    needsReview: boolean;
    receiptNumber: string;
    vendor: string;
    itemPurchased: string;
    receiptDate: string;
    category: string;
    vatRate: string;
    vatAmount: string;
    grossAmount: string;
    netAmount: string;
    currency: string;
  };
};

export const ReceiptEditForm = ({ receiptId, locale, initial }: ReceiptEditFormProps) => {
  const router = useRouter();
  const copy =
    locale === "sv"
      ? {
          title: "Redigera underlag",
          source: "Källa",
          originalFileName: "Filnamn",
          mimeType: "Mime-typ",
          createdDate: "Skapad datum",
          confidence: "Konfidens (0-1)",
          needsReview: "Kräver granskning",
          receiptNumber: "Kvittonummer",
          vendor: "Leverantör",
          itemPurchased: "Inköpt vara",
          receiptDate: "Utfärdandedatum",
          category: "Kategori",
          grossAmount: "Bruttobelopp",
          netAmount: "Nettobelopp",
          vatAmount: "Momsbelopp",
          currency: "Valuta",
          vatRate: "Momssats (decimal)",
          autoCalculated: "Beräknas automatiskt från bruttobelopp och moms",
          save: "Spara ändringar",
          saving: "Sparar...",
          saved: "Ändringar sparade.",
          invalidCurrency: "Ange en valutakod med tre bokstäver, till exempel SEK eller USD.",
          failed: "Kunde inte spara ändringar.",
          unknown: "Okänt fel"
        }
      : {
          title: "Edit Input",
          source: "Source",
          originalFileName: "File name",
          mimeType: "MIME type",
          createdDate: "Created date",
          confidence: "Confidence (0-1)",
          needsReview: "Needs review",
          receiptNumber: "Receipt Number",
          vendor: "Vendor",
          itemPurchased: "Item Purchased",
          receiptDate: "Issue date",
          category: "Category",
          grossAmount: "Gross amount",
          netAmount: "Net amount",
          vatAmount: "VAT amount",
          currency: "Currency",
          vatRate: "VAT rate (decimal)",
          autoCalculated: "Calculated automatically from gross and VAT",
          save: "Save changes",
          saving: "Saving...",
          saved: "Changes saved.",
          invalidCurrency: "Use a 3-letter currency code such as SEK or USD.",
          failed: "Failed to save changes.",
          unknown: "Unknown error"
        };

  const [receiptNumber, setReceiptNumber] = useState(initial.receiptNumber);
  const [vendor, setVendor] = useState(initial.vendor);
  const [itemPurchased, setItemPurchased] = useState(initial.itemPurchased);
  const [source, setSource] = useState(initial.source);
  const [originalFileName, setOriginalFileName] = useState(initial.originalFileName);
  const [mimeType, setMimeType] = useState(initial.mimeType);
  const [createdDate, setCreatedDate] = useState(initial.createdDate);
  const [confidence, setConfidence] = useState(initial.confidence);
  const [needsReview, setNeedsReview] = useState(initial.needsReview);
  const [receiptDate, setReceiptDate] = useState(initial.receiptDate);
  const [category, setCategory] = useState(initial.category);
  const [grossAmount, setGrossAmount] = useState(initial.grossAmount);
  const [netAmount, setNetAmount] = useState(initial.netAmount);
  const [vatAmount, setVatAmount] = useState(initial.vatAmount);
  const [currency, setCurrency] = useState(initial.currency || "SEK");
  const [vatRate, setVatRate] = useState(initial.vatRate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const gross = Number(grossAmount.replace(",", "."));
    const rate = Number(vatRate.replace(",", "."));
    if (!Number.isFinite(gross) || gross <= 0 || !Number.isFinite(rate) || rate < 0) {
      setNetAmount("");
      setVatAmount("");
      return;
    }
    const net = Math.round((gross / (1 + rate)) * 100) / 100;
    const vat = Math.round((gross - net) * 100) / 100;
    setNetAmount(net.toFixed(2));
    setVatAmount(vat.toFixed(2));
  }, [grossAmount, vatRate]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const vatValue = Number(vatRate.replace(",", "."));
      const grossValue = Number(grossAmount.replace(",", "."));
      const netValue = Number(netAmount.replace(",", "."));
      const vatAmountValue = Number(vatAmount.replace(",", "."));
      const confidenceRaw = confidence.trim();
      const confidenceValue =
        confidenceRaw === "" ? Number.NaN : Number(confidenceRaw.replace(",", "."));
      const normalizedCurrency = currency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
        throw new Error(copy.invalidCurrency);
      }
      const response = await fetch(`/api/receipts/${receiptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptNumber: receiptNumber.trim() || null,
          vendor: vendor.trim() || null,
          itemPurchased: itemPurchased.trim() || null,
          source: source.trim() || null,
          originalFileName: originalFileName.trim() || null,
          mimeType: mimeType.trim() || null,
          createdDate: createdDate || null,
          confidence: Number.isFinite(confidenceValue) ? confidenceValue : null,
          needsReview,
          receiptDate: receiptDate || null,
          category: category.trim() || null,
          vatRate: Number.isFinite(vatValue) ? vatValue : null,
          vatAmount: Number.isFinite(vatAmountValue) && vatAmountValue >= 0 ? vatAmountValue : null,
          grossAmount: Number.isFinite(grossValue) && grossValue > 0 ? grossValue : null,
          netAmount: Number.isFinite(netValue) && netValue >= 0 ? netValue : null,
          currency: normalizedCurrency
        })
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? copy.failed);
      }
      setSuccess(copy.saved);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : copy.unknown);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack" onSubmit={onSubmit}>
      <h3>{copy.title}</h3>
      <div className="row">
        <label className="stack">
          {copy.source}
          <input value={source} onChange={(event) => setSource(event.target.value)} />
        </label>
        <label className="stack">
          {copy.originalFileName}
          <input value={originalFileName} onChange={(event) => setOriginalFileName(event.target.value)} />
        </label>
        <label className="stack">
          {copy.mimeType}
          <input value={mimeType} onChange={(event) => setMimeType(event.target.value)} />
        </label>
      </div>
      <div className="row">
        <label className="stack">
          {copy.createdDate}
          <input type="date" value={createdDate} onChange={(event) => setCreatedDate(event.target.value)} />
        </label>
        <label className="stack">
          {copy.confidence}
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
          />
        </label>
        <label className="row" style={{ alignSelf: "end", gap: 8 }}>
          <input
            type="checkbox"
            checked={needsReview}
            onChange={(event) => setNeedsReview(event.target.checked)}
          />
          <span>{copy.needsReview}</span>
        </label>
      </div>
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
          {copy.itemPurchased}
          <input value={itemPurchased} onChange={(event) => setItemPurchased(event.target.value)} />
        </label>
        <label className="stack">
          {copy.receiptDate}
          <input type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} />
        </label>
      </div>
      <div className="row">
        <label className="stack">
          {copy.category}
          <input value={category} onChange={(event) => setCategory(event.target.value)} />
        </label>
        <label className="stack">
          {copy.grossAmount}
          <input
            type="number"
            min="0"
            step="0.01"
            value={grossAmount}
            onChange={(event) => setGrossAmount(event.target.value)}
          />
        </label>
        <label className="stack">
          {copy.netAmount}
          <input
            type="number"
            min="0"
            step="0.01"
            value={netAmount}
            readOnly
          />
        </label>
        <label className="stack">
          {copy.vatAmount}
          <input
            type="number"
            min="0"
            step="0.01"
            value={vatAmount}
            readOnly
          />
        </label>
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
          {copy.vatRate}
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={vatRate}
            onChange={(event) => setVatRate(event.target.value)}
          />
        </label>
      </div>
      <p className="note">{copy.autoCalculated}</p>
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
