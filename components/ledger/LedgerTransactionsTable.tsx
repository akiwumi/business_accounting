"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatMoney } from "@/lib/data/format";
import { type Locale } from "@/lib/i18n/locale";

type LedgerTransactionRow = {
  id: string;
  txnDate: string;
  itemPurchased: string;
  description: string;
  vendor: string | null;
  direction: string;
  grossAmount: number;
  netAmount: number;
  vatAmount: number;
  currency: string;
  source: string;
  reference: string | null;
  journal: string;
  receiptId: string | null;
};

type LedgerTransactionsTableProps = {
  locale: Locale;
  rows: LedgerTransactionRow[];
  copy: {
    date: string;
    itemPurchased: string;
    description: string;
    vendor: string;
    direction: string;
    gross: string;
    net: string;
    vat: string;
    totalGross: string;
    totalNet: string;
    totalVat: string;
    sourceCol: string;
    reference: string;
    journal: string;
    input: string;
    erase: string;
    erasing: string;
    eraseSelected: string;
    erasingSelected: string;
    selectedCount: string;
    selectAll: string;
    selectRow: string;
    deleteSelectedConfirm: string;
    none: string;
    reviewReceipt: string;
    reviewTransaction: string;
    deleteConfirm: string;
    deleteFailed: string;
    unknownDeleteError: string;
  };
};

export const LedgerTransactionsTable = ({ locale, rows, copy }: LedgerTransactionsTableProps) => {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const numberLocale = locale === "sv" ? "sv-SE" : "en-GB";
  const totalsCurrency = useMemo(() => {
    const currencies = Array.from(
      new Set(
        rows
          .map((row) => row.currency?.trim().toUpperCase())
          .filter((currency): currency is string => Boolean(currency && currency.length === 3))
      )
    );
    return currencies.length === 1 ? currencies[0] : "SEK";
  }, [rows]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (accumulator, row) => {
          accumulator.gross += Number.isFinite(row.grossAmount) ? row.grossAmount : 0;
          accumulator.net += Number.isFinite(row.netAmount) ? row.netAmount : 0;
          accumulator.vat += Number.isFinite(row.vatAmount) ? row.vatAmount : 0;
          return accumulator;
        },
        { gross: 0, net: 0, vat: 0 }
      ),
    [rows]
  );

  useEffect(() => {
    setSelectedIds((previous) => {
      const next = new Set<string>();
      for (const row of rows) {
        if (previous.has(row.id)) next.add(row.id);
      }
      return next;
    });
  }, [rows]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    const partiallySelected = selectedIds.size > 0 && selectedIds.size < rows.length;
    selectAllRef.current.indeterminate = partiallySelected;
  }, [selectedIds, rows.length]);

  const toggleRow = (transactionId: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(transactionId);
      } else {
        next.delete(transactionId);
      }
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(rows.map((row) => row.id)));
  };

  const onDelete = async (transactionId: string) => {
    if (!window.confirm(copy.deleteConfirm)) return;

    setDeletingId(transactionId);
    setError(null);
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
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
      for (const transactionId of selectedIds) {
        const response = await fetch(`/api/transactions/${transactionId}`, {
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
          {deletingSelected ? copy.erasingSelected : copy.eraseSelected}
        </button>
        <p className="note">
          {copy.selectedCount}: {selectedIds.size}
        </p>
      </div>
      <div className="tableWrap ledgerTableWrap">
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
              <th>{copy.date}</th>
              <th>{copy.itemPurchased}</th>
              <th>{copy.description}</th>
              <th>{copy.vendor}</th>
              <th>{copy.direction}</th>
              <th>{copy.gross}</th>
              <th>{copy.net}</th>
              <th>{copy.vat}</th>
              <th>{copy.sourceCol}</th>
              <th>{copy.reference}</th>
              <th>{copy.journal}</th>
              <th>{copy.input}</th>
              <th>{copy.erase}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((txn) => (
              <tr key={txn.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${copy.selectRow} ${txn.description}`}
                    checked={selectedIds.has(txn.id)}
                    onChange={(event) => toggleRow(txn.id, event.target.checked)}
                  />
                </td>
                <td>{txn.txnDate.slice(0, 10)}</td>
                <td>{txn.itemPurchased}</td>
                <td>{txn.description}</td>
                <td>{txn.vendor ?? "-"}</td>
                <td>{txn.direction}</td>
                <td>{formatMoney(txn.grossAmount, txn.currency, numberLocale)}</td>
                <td>{formatMoney(txn.netAmount, txn.currency, numberLocale)}</td>
                <td>{formatMoney(txn.vatAmount, txn.currency, numberLocale)}</td>
                <td>{txn.source}</td>
                <td>{txn.reference ?? "-"}</td>
                <td>{txn.journal}</td>
                <td>
                  {txn.receiptId ? (
                    <Link href={`/review/receipts/${txn.receiptId}`}>{copy.reviewReceipt}</Link>
                  ) : (
                    <Link href={`/review/transactions/${txn.id}`}>{copy.reviewTransaction}</Link>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="secondary"
                    disabled={deletingId === txn.id}
                    onClick={() => onDelete(txn.id)}
                  >
                    {deletingId === txn.id ? copy.erasing : copy.erase}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={14}>{copy.none}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="ledgerTotals" aria-live="polite">
        <p>
          <span>{copy.totalGross}</span>
          <strong>{formatMoney(totals.gross, totalsCurrency, numberLocale)}</strong>
        </p>
        <p>
          <span>{copy.totalNet}</span>
          <strong>{formatMoney(totals.net, totalsCurrency, numberLocale)}</strong>
        </p>
        <p>
          <span>{copy.totalVat}</span>
          <strong>{formatMoney(totals.vat, totalsCurrency, numberLocale)}</strong>
        </p>
      </div>
    </div>
  );
};
