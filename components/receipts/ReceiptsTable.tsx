"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { type Locale } from "@/lib/i18n/locale";

type ReceiptRow = {
  id: string;
  createdAt: string;
  receiptDate: string | null;
  receiptNumber: string | null;
  vendor: string | null;
  originalFileName: string;
  grossAmount: number | null;
  currency: string | null;
  needsReview: boolean;
  transactionsCount: number;
};

type ReceiptsTableProps = {
  locale: Locale;
  rows: ReceiptRow[];
  copy: {
    issueDate: string;
    createdDate: string;
    receiptNumber: string;
    vendor: string;
    file: string;
    gross: string;
    status: string;
    posted: string;
    actions: string;
    yes: string;
    no: string;
    none: string;
    needsReview: string;
    ready: string;
    delete: string;
    deleting: string;
    deleteSelected: string;
    deletingSelected: string;
    selectedCount: string;
    selectAll: string;
    selectRow: string;
    deleteSelectedConfirm: string;
    review: string;
    deleteConfirm: string;
    deleteFailed: string;
    unknownDeleteError: string;
  };
};

const formatMoney = (value: number, currency: string | null, locale: Locale) => {
  const normalized = (currency ?? "SEK").trim().toUpperCase();
  const code = /^[A-Z]{3}$/.test(normalized) ? normalized : "SEK";

  try {
    return new Intl.NumberFormat(locale === "sv" ? "sv-SE" : "en-GB", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return new Intl.NumberFormat(locale === "sv" ? "sv-SE" : "en-GB", {
      style: "currency",
      currency: "SEK",
      maximumFractionDigits: 2
    }).format(value);
  }
};

export const ReceiptsTable = ({ locale, rows, copy }: ReceiptsTableProps) => {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSelectedIds((previous) => {
      const next = new Set<string>();
      for (const receipt of rows) {
        if (previous.has(receipt.id)) next.add(receipt.id);
      }
      return next;
    });
  }, [rows]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    const partiallySelected = selectedIds.size > 0 && selectedIds.size < rows.length;
    selectAllRef.current.indeterminate = partiallySelected;
  }, [selectedIds, rows.length]);

  const toggleRow = (receiptId: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(receiptId);
      } else {
        next.delete(receiptId);
      }
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(rows.map((receipt) => receipt.id)));
  };

  const onDelete = async (receiptId: string) => {
    if (!window.confirm(copy.deleteConfirm)) return;

    setDeletingId(receiptId);
    setError(null);
    try {
      const response = await fetch(`/api/receipts/${receiptId}`, {
        method: "DELETE"
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? copy.deleteFailed);
      }
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : copy.unknownDeleteError);
    } finally {
      setDeletingId(null);
    }
  };

  const onDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(copy.deleteSelectedConfirm)) return;

    setDeletingSelected(true);
    setError(null);
    try {
      for (const receiptId of selectedIds) {
        const response = await fetch(`/api/receipts/${receiptId}`, {
          method: "DELETE"
        });
        const json = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(json.error ?? copy.deleteFailed);
        }
      }
      setSelectedIds(new Set());
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : copy.unknownDeleteError);
    } finally {
      setDeletingSelected(false);
    }
  };

  return (
    <div className="stack">
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button
          type="button"
          className="secondary"
          disabled={selectedIds.size === 0 || deletingSelected}
          onClick={onDeleteSelected}
        >
          {deletingSelected ? copy.deletingSelected : copy.deleteSelected}
        </button>
        <p className="note">
          {copy.selectedCount}: {selectedIds.size}
        </p>
      </div>
      <div className="tableWrap receiptsTableWrap">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label={copy.selectAll}
                  checked={rows.length > 0 && selectedIds.size === rows.length}
                  onChange={(event) => toggleSelectAll(event.target.checked)}
                />
              </th>
              <th>{copy.issueDate}</th>
              <th>{copy.createdDate}</th>
              <th>{copy.receiptNumber}</th>
              <th>{copy.vendor}</th>
              <th>{copy.file}</th>
              <th>{copy.gross}</th>
              <th>{copy.status}</th>
              <th>{copy.posted}</th>
              <th>{copy.actions}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((receipt) => (
              <tr key={receipt.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${copy.selectRow} ${receipt.receiptNumber ?? receipt.originalFileName}`}
                    checked={selectedIds.has(receipt.id)}
                    onChange={(event) => toggleRow(receipt.id, event.target.checked)}
                  />
                </td>
                <td>{receipt.receiptDate ? receipt.receiptDate.slice(0, 10) : "-"}</td>
                <td>{receipt.createdAt.slice(0, 10)}</td>
                <td>{receipt.receiptNumber ?? "-"}</td>
                <td>{receipt.vendor ?? "-"}</td>
                <td>{receipt.originalFileName}</td>
                <td>{receipt.grossAmount !== null ? formatMoney(receipt.grossAmount, receipt.currency, locale) : "-"}</td>
                <td>
                  <span className={receipt.needsReview ? "badge warn" : "badge good"}>
                    {receipt.needsReview ? copy.needsReview : copy.ready}
                  </span>
                </td>
                <td>{receipt.transactionsCount > 0 ? copy.yes : copy.no}</td>
                <td>
                  <div className="row">
                    <Link className="button secondary" href={`/review/receipts/${receipt.id}`}>
                      {copy.review}
                    </Link>
                    <button
                      type="button"
                      className="secondary"
                      disabled={deletingId === receipt.id}
                      onClick={() => onDelete(receipt.id)}
                    >
                      {deletingId === receipt.id ? copy.deleting : copy.delete}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10}>{copy.none}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
