import Link from "next/link";
import { notFound } from "next/navigation";

import { ReceiptEditForm } from "@/components/review/ReceiptEditForm";
import { ReceiptReviewActions } from "@/components/review/ReceiptReviewActions";
import { asNumber } from "@/lib/accounting/math";
import { formatMoney } from "@/lib/data/format";
import { prisma } from "@/lib/db";
import { getRequestLocale } from "@/lib/i18n/locale";

type ReceiptReviewPageProps = {
  params: {
    id: string;
  };
};

export default async function ReceiptReviewPage({ params }: ReceiptReviewPageProps) {
  const locale = getRequestLocale();
  const copy =
    locale === "sv"
      ? {
          title: "Kvitto granskning",
          back: "Till granskning",
          details: "Kvittoinformation",
          linkedTransactions: "Kopplade transaktioner",
          edit: "Redigera",
          date: "Datum",
          description: "Beskrivning",
          direction: "Riktning",
          gross: "Brutto",
          vat: "Moms",
          sourceCol: "Källa",
          openTxnReview: "Öppna post",
          noLinkedTransactions: "Inga kopplade transaktioner."
        }
      : {
          title: "Receipt Review",
          back: "Back to review",
          details: "Receipt Details",
          linkedTransactions: "Linked Transactions",
          edit: "Edit",
          date: "Date",
          description: "Description",
          direction: "Direction",
          gross: "Gross",
          vat: "VAT",
          sourceCol: "Source",
          openTxnReview: "Open entry",
          noLinkedTransactions: "No linked transactions."
        };
  const numberLocale = locale === "sv" ? "sv-SE" : "en-GB";

  const receipt = await prisma.receipt.findUnique({
    where: { id: params.id },
    include: {
      transactions: {
        include: {
          lines: {
            include: {
              account: true
            }
          }
        },
        orderBy: [{ txnDate: "desc" }, { createdAt: "desc" }]
      }
    }
  });

  if (!receipt) notFound();

  return (
    <section className="page">
      <div className="row">
        <Link className="button secondary" href="/review">
          {copy.back}
        </Link>
      </div>

      <h1 className="title">{copy.title}</h1>

      <article className="card stack">
        <h2>{copy.details}</h2>
        <ReceiptEditForm
          receiptId={receipt.id}
          locale={locale}
          initial={{
            source: receipt.source ?? "upload",
            originalFileName: receipt.originalFileName,
            mimeType: receipt.mimeType,
            createdDate: receipt.createdAt.toISOString().slice(0, 10),
            confidence: receipt.confidence ? String(asNumber(receipt.confidence)) : "",
            needsReview: receipt.needsReview,
            receiptNumber: receipt.receiptNumber ?? "",
            vendor: receipt.vendor ?? "",
            itemPurchased: receipt.itemPurchased ?? "",
            receiptDate: receipt.receiptDate ? receipt.receiptDate.toISOString().slice(0, 10) : "",
            category: receipt.category ?? "",
            vatRate: receipt.vatRate ? String(asNumber(receipt.vatRate)) : "0.25",
            vatAmount: receipt.vatAmount ? String(asNumber(receipt.vatAmount)) : "",
            grossAmount: receipt.grossAmount ? String(asNumber(receipt.grossAmount)) : "",
            netAmount: receipt.netAmount ? String(asNumber(receipt.netAmount)) : "",
            currency: receipt.currency ?? "SEK"
          }}
        />
        <ReceiptReviewActions receiptId={receipt.id} needsReview={receipt.needsReview} locale={locale} />
      </article>

      <article className="card">
        <h2>{copy.linkedTransactions}</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>{copy.date}</th>
                <th>{copy.description}</th>
                <th>{copy.direction}</th>
                <th>{copy.gross}</th>
                <th>{copy.vat}</th>
                <th>{copy.sourceCol}</th>
                <th>{copy.openTxnReview}</th>
              </tr>
            </thead>
            <tbody>
              {receipt.transactions.map((txn) => (
                <tr key={txn.id}>
                  <td>{txn.txnDate.toISOString().slice(0, 10)}</td>
                  <td>{txn.description}</td>
                  <td>{txn.direction}</td>
                  <td>{formatMoney(asNumber(txn.grossAmount), txn.currency, numberLocale)}</td>
                  <td>{formatMoney(asNumber(txn.vatAmount), txn.currency, numberLocale)}</td>
                  <td>{txn.source}</td>
                  <td>
                    <Link href={`/review/transactions/${txn.id}`}>{copy.openTxnReview}</Link>
                  </td>
                </tr>
              ))}
              {receipt.transactions.length === 0 && (
                <tr>
                  <td colSpan={7}>{copy.noLinkedTransactions}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
