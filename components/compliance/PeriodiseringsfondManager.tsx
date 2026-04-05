"use client";

import { useState } from "react";
import { type Locale } from "@/lib/i18n/locale";

type Entry = {
  id: string;
  entryType: string;
  direction: string;
  taxYear: number;
  amount: number;
  notes: string | null;
  createdAt: string;
};

type Props = {
  locale: Locale;
  initial: Entry[];
  pfBalance: number;
  efBalance: number;
  currentYear: number;
};

const formatSEK = (amount: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(amount);

const EMPTY_FORM = {
  entryType: "periodiseringsfond",
  direction: "allocation",
  taxYear: String(new Date().getFullYear()),
  amount: "",
  notes: ""
};

export const PeriodiseringsfondManager = ({ locale, initial, pfBalance, efBalance, currentYear }: Props) => {
  const sv = locale === "sv";

  const copy = {
    pfBalance: sv ? "Periodiseringsfond – ackumulerat saldo" : "Periodiseringsfond – Accumulated Balance",
    efBalance: sv ? "Expansionsfond – ackumulerat saldo" : "Expansionsfond – Accumulated Balance",
    addEntry: sv ? "Registrera avsättning / återföring" : "Record Allocation / Withdrawal",
    entryType: sv ? "Typ" : "Type",
    pf: sv ? "Periodiseringsfond" : "Periodiseringsfond",
    ef: sv ? "Expansionsfond" : "Expansionsfond",
    direction: sv ? "Riktning" : "Direction",
    allocation: sv ? "Avsättning (minskar beskattningsbar inkomst)" : "Allocation (reduces taxable income)",
    withdrawal: sv ? "Återföring (ökar beskattningsbar inkomst)" : "Withdrawal (increases taxable income)",
    taxYear: sv ? "Skatteår" : "Tax Year",
    amount: sv ? "Belopp (SEK)" : "Amount (SEK)",
    notes: sv ? "Noteringar" : "Notes",
    save: sv ? "Spara" : "Save",
    cancel: sv ? "Avbryt" : "Cancel",
    delete: sv ? "Ta bort" : "Delete",
    year: sv ? "År" : "Year",
    noEntries: sv
      ? "Inga avsättningar registrerade. Lägg till om du har avsatt till periodiseringsfond eller expansionsfond detta år."
      : "No entries recorded. Add entries if you have allocated to periodiseringsfond or expansionsfond this year.",
    pfRule: sv
      ? "Periodiseringsfond: Du kan sätta av upp till 30 % av årets överskott. Medlen måste återföras senast 6 år efter avsättning. Under återföringsåret ökar den beskattningsbara inkomsten."
      : "Periodiseringsfond: You may allocate up to 30% of the year's surplus. Funds must be withdrawn within 6 years. In the withdrawal year, taxable income increases.",
    efRule: sv
      ? "Expansionsfond: Du betalar 20,6 % expansionsfondsskatt vid avsättning. Skatten återbetalas vid återföring. Kräver att det egna kapitalet i verksamheten ökar."
      : "Expansionsfond: You pay 20.6% expansion fund tax on allocation. Tax is refunded on withdrawal. Requires an increase in business equity.",
    saving: sv ? "Sparar..." : "Saving...",
    error: sv ? "Fel" : "Error",
    type: sv ? "Fondtyp" : "Fund Type",
    accumulated: sv ? "Ackumulerat" : "Accumulated"
  };

  const [entries, setEntries] = useState<Entry[]>(initial);
  const [currentPfBalance, setCurrentPfBalance] = useState(pfBalance);
  const [currentEfBalance, setCurrentEfBalance] = useState(efBalance);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startAdd = () => {
    setForm({ ...EMPTY_FORM, taxYear: String(currentYear) });
    setShowForm(true);
    setErrorMsg(null);
  };

  const cancel = () => {
    setShowForm(false);
    setErrorMsg(null);
  };

  const recalcBalances = (updatedEntries: Entry[]) => {
    const pf = updatedEntries
      .filter((e) => e.entryType === "periodiseringsfond")
      .reduce((sum, e) => (e.direction === "allocation" ? sum + e.amount : sum - e.amount), 0);
    const ef = updatedEntries
      .filter((e) => e.entryType === "expansionsfond")
      .reduce((sum, e) => (e.direction === "allocation" ? sum + e.amount : sum - e.amount), 0);
    setCurrentPfBalance(Math.round(pf * 100) / 100);
    setCurrentEfBalance(Math.round(ef * 100) / 100);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      const body = {
        entryType: form.entryType,
        direction: form.direction,
        taxYear: parseInt(form.taxYear, 10),
        amount: parseFloat(form.amount),
        notes: form.notes || undefined
      };
      const res = await fetch("/api/periodiseringsfond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      const updated = [{ ...json, amount: parseFloat(form.amount) }, ...entries];
      setEntries(updated);
      recalcBalances(updated);
      cancel();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const deleteEntry = async (id: string, amount: number, entryType: string, direction: string) => {
    if (!confirm(sv ? "Ta bort posten?" : "Delete this entry?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/periodiseringsfond/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      const updated = entries.filter((e) => e.id !== id);
      setEntries(updated);
      recalcBalances(updated);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const pfEntries = entries.filter((e) => e.entryType === "periodiseringsfond");
  const efEntries = entries.filter((e) => e.entryType === "expansionsfond");

  const renderTable = (tableEntries: Entry[], label: string) => (
    <div className="stack">
      <h4 style={{ margin: 0 }}>{label}</h4>
      {tableEntries.length === 0 ? (
        <p className="note">{copy.noEntries}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--border)" }}>
              <th style={{ padding: "0.5rem" }}>{copy.taxYear}</th>
              <th style={{ padding: "0.5rem" }}>{copy.direction}</th>
              <th style={{ padding: "0.5rem", textAlign: "right" }}>{copy.amount}</th>
              <th style={{ padding: "0.5rem" }}>{copy.notes}</th>
              <th style={{ padding: "0.5rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {tableEntries.map((entry) => (
              <tr key={entry.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.5rem" }}>{entry.taxYear}</td>
                <td style={{ padding: "0.5rem" }}>
                  <span style={{
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontSize: "0.8em",
                    background: entry.direction === "allocation" ? "#d4edda" : "#f8d7da",
                    color: entry.direction === "allocation" ? "#155724" : "#721c24"
                  }}>
                    {entry.direction === "allocation" ? copy.allocation.split(" (")[0] : copy.withdrawal.split(" (")[0]}
                  </span>
                </td>
                <td style={{ padding: "0.5rem", textAlign: "right" }}>{formatSEK(entry.amount)}</td>
                <td style={{ padding: "0.5rem", fontSize: "0.8em", color: "#666" }}>{entry.notes ?? "–"}</td>
                <td style={{ padding: "0.5rem" }}>
                  <button
                    type="button"
                    className="secondary"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.8em" }}
                    onClick={() => deleteEntry(entry.id, entry.amount, entry.entryType, entry.direction)}
                    disabled={busy}
                  >
                    {copy.delete}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="stack">
      {/* Balance KPIs */}
      <div className="grid">
        <article className="card">
          <p className="label">{copy.pfBalance}</p>
          <p className="kpi" style={{ color: currentPfBalance >= 0 ? undefined : "#c00" }}>{formatSEK(currentPfBalance)}</p>
        </article>
        <article className="card">
          <p className="label">{copy.efBalance}</p>
          <p className="kpi" style={{ color: currentEfBalance >= 0 ? undefined : "#c00" }}>{formatSEK(currentEfBalance)}</p>
        </article>
      </div>

      {/* Rules */}
      <p className="note">{copy.pfRule}</p>
      <p className="note">{copy.efRule}</p>

      {/* Add button */}
      {!showForm && (
        <div className="row">
          <button type="button" onClick={startAdd}>{copy.addEntry}</button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form className="stack" onSubmit={submit} style={{ background: "var(--surface-raised, #f9f9f9)", padding: "1rem", borderRadius: 6 }}>
          <div className="row">
            <label className="stack">
              {copy.entryType}
              <select value={form.entryType} onChange={(e) => setForm((s) => ({ ...s, entryType: e.target.value }))}>
                <option value="periodiseringsfond">{copy.pf}</option>
                <option value="expansionsfond">{copy.ef}</option>
              </select>
            </label>
            <label className="stack">
              {copy.direction}
              <select value={form.direction} onChange={(e) => setForm((s) => ({ ...s, direction: e.target.value }))}>
                <option value="allocation">{copy.allocation}</option>
                <option value="withdrawal">{copy.withdrawal}</option>
              </select>
            </label>
            <label className="stack">
              {copy.taxYear}
              <input
                type="number"
                required
                min={2000}
                max={2100}
                value={form.taxYear}
                onChange={(e) => setForm((s) => ({ ...s, taxYear: e.target.value }))}
              />
            </label>
            <label className="stack">
              {copy.amount}
              <input
                type="number"
                required
                min={0.01}
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
              />
            </label>
          </div>
          <label className="stack">
            {copy.notes}
            <input
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              placeholder={sv ? "Valfria noteringar" : "Optional notes"}
            />
          </label>
          <div className="row">
            <button type="submit" disabled={busy}>{busy ? copy.saving : copy.save}</button>
            <button type="button" className="secondary" onClick={cancel} disabled={busy}>{copy.cancel}</button>
          </div>
          {errorMsg && <p className="error">{copy.error}: {errorMsg}</p>}
        </form>
      )}

      {/* Tables */}
      {renderTable(pfEntries, copy.pf)}
      {renderTable(efEntries, copy.ef)}
    </div>
  );
};
