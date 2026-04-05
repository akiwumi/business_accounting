"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { type Locale } from "@/lib/i18n/locale";

type UploadResponse = {
  receipt?: {
    id: string;
    receiptNumber?: string;
    vendor?: string;
    grossAmount?: number;
    currency?: string;
    receiptDate?: string;
    needsReview?: boolean;
  };
  transaction?: {
    id: string;
  } | null;
  extracted?: Record<string, unknown>;
  error?: string;
};

export const ReceiptUploadForm = ({
  locale,
  activeYear,
  activeMonth
}: {
  locale: Locale;
  activeYear?: number;
  activeMonth?: number | null;
}) => {
  const router = useRouter();
  const copy = {
    en: {
      processing: "Processing...",
      upload: "Upload Receipt",
      note: "Use receipts for outgoing payments. Supported inputs: photo upload, PDF upload, and email-forwarded attachments via webhook.",
      unknown: "Unknown",
      na: "N/A",
      unknownNumber: "Not found",
      unknownDate: "Not found",
      notCreated: "Not created (needs manual review)",
      needsReview: "Needs Review",
      autoPosted: "Auto Posted",
      receiptId: "Receipt ID",
      receiptNumber: "Receipt Number",
      vendor: "Vendor",
      issueDate: "Issue Date",
      amount: "Amount",
      transaction: "Transaction",
      missingFile: "Please choose a receipt file first.",
      openReview: "Open Review",
      savedOutsideFilterYear: "Receipt saved, but the issue year does not match the current filter.",
      savedOutsideFilterMonth: "Receipt saved, but the issue month does not match the current filter."
    },
    sv: {
      processing: "Bearbetar...",
      upload: "Ladda upp kvitto",
      note: "Använd kvitton för utgående betalningar. Stöder fotouppladdning, PDF-uppladdning och e-postvidarebefordrade bilagor via webhook.",
      unknown: "Okänd",
      na: "Saknas",
      unknownNumber: "Hittades inte",
      unknownDate: "Hittades inte",
      notCreated: "Inte skapad (kräver manuell granskning)",
      needsReview: "Kräver granskning",
      autoPosted: "Automatbokförd",
      receiptId: "Kvitto-ID",
      receiptNumber: "Kvittonummer",
      vendor: "Leverantör",
      issueDate: "Utfärdandedatum",
      amount: "Belopp",
      transaction: "Transaktion",
      missingFile: "Välj en kvittofil först.",
      openReview: "Öppna granskning",
      savedOutsideFilterYear: "Kvitto sparat, men utfärdandeåret matchar inte nuvarande filter.",
      savedOutsideFilterMonth: "Kvitto sparat, men utfärdandemånaden matchar inte nuvarande filter."
    }
  } as const;
  const t = copy[locale];

  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError(t.missingFile);
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/receipts/upload", {
        method: "POST",
        body
      });
      const raw = await response.text();
      let json: UploadResponse = {};
      if (raw) {
        try {
          json = JSON.parse(raw) as UploadResponse;
        } catch {
          json = {};
        }
      }
      if (!response.ok) {
        throw new Error(json.error ?? (raw && !raw.startsWith("<") ? raw : "Upload failed"));
      }
      setResult(json);
      setFile(null);
      const input = document.getElementById("receipt-file") as HTMLInputElement | null;
      if (input) input.value = "";
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unknown upload error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="row">
        <input
          id="receipt-file"
          type="file"
          accept="image/*,application/pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={!file || submitting}>
          {submitting ? t.processing : t.upload}
        </button>
      </div>
      <p className="note">{t.note}</p>

      {error && <p className="error">{error}</p>}

      {result?.receipt && (
        <div className="card">
          <p className="note">
            {t.receiptId}: {result.receipt.id}
          </p>
          <p className="note">
            {t.vendor}: {result.receipt.vendor ?? t.unknown}
          </p>
          <p className="note">
            {t.receiptNumber}: {result.receipt.receiptNumber ?? t.unknownNumber}
          </p>
          <p className="note">
            {t.issueDate}: {result.receipt.receiptDate ?? t.unknownDate}
          </p>
          <p className="note">
            {t.amount}: {result.receipt.grossAmount ?? t.na} {result.receipt.currency ?? "SEK"}
          </p>
          <p className="note">
            {t.transaction}: {result.transaction?.id ?? t.notCreated}
          </p>
          <p className={result.receipt.needsReview ? "badge warn" : "badge good"}>
            {result.receipt.needsReview ? t.needsReview : t.autoPosted}
          </p>
          {(() => {
            const issue = result.receipt?.receiptDate;
            if (!issue) return null;
            const [issueYearRaw, issueMonthRaw] = issue.split("-");
            const issueYear = Number(issueYearRaw);
            const issueMonth = Number(issueMonthRaw);
            if (!Number.isFinite(issueYear) || !Number.isFinite(issueMonth)) return null;

            if (activeYear && issueYear !== activeYear) {
              return <p className="badge warn">{t.savedOutsideFilterYear}</p>;
            }
            if (activeMonth && issueMonth !== activeMonth) {
              return <p className="badge warn">{t.savedOutsideFilterMonth}</p>;
            }
            return null;
          })()}
          <Link className="button secondary" href={`/review/receipts/${result.receipt.id}`}>
            {t.openReview}
          </Link>
        </div>
      )}
    </form>
  );
};
