"use client";

import { useState } from "react";
import { type Locale } from "@/lib/i18n/locale";

type MileageEntry = {
  id: string;
  tripDate: string;
  destination: string;
  purpose: string;
  kilometers: number;
  ratePerKm: number;
  deductionAmount: number;
  notes: string | null;
};

type MileageLogProps = {
  locale: Locale;
  initial: MileageEntry[];
  currentYear: number;
};

const CURRENT_RATE = 1.85;

const formatSEK = (amount: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(amount);

const formatDate = (d: string) => new Date(d).toISOString().slice(0, 10);

const EMPTY_FORM = {
  tripDate: new Date().toISOString().slice(0, 10),
  destination: "",
  purpose: "",
  kilometers: "",
  notes: ""
};

export const MileageLog = ({ locale, initial, currentYear }: MileageLogProps) => {
  const sv = locale === "sv";
  const copy = {
    title: sv ? "Körjournal (milersättning)" : "Mileage Log (Körjournal)",
    addEntry: sv ? "Registrera resa" : "Log Trip",
    tripDate: sv ? "Datum" : "Date",
    destination: sv ? "Destination / Resväg" : "Destination / Route",
    purpose: sv ? "Affärssyfte" : "Business Purpose",
    kilometers: sv ? "Kilometer" : "Kilometers",
    rate: sv ? "Ersättning (kr/km)" : "Rate (SEK/km)",
    deduction: sv ? "Avdrag" : "Deduction",
    notes: sv ? "Noteringar" : "Notes",
    save: sv ? "Spara" : "Save",
    cancel: sv ? "Avbryt" : "Cancel",
    delete: sv ? "Ta bort" : "Delete",
    total: sv ? "Totalt avdrag" : "Total Deduction",
    totalKm: sv ? "Totalt km" : "Total km",
    noEntries: sv
      ? "Inga resor registrerade. Dokumentera tjänsteresor för att beräkna milersättningsavdraget (1,85 kr/km)."
      : "No trips logged. Record business trips to calculate the mileage deduction (SEK 1.85/km).",
    ruleNote: sv
      ? `Skatteverkets schablonersättning ${new Date().getFullYear()}: 1,85 kr/km. Körjournalen styrker avdraget vid deklaration. Ange alltid affärssyfte och destination för varje resa. Totalt avdrag bokförs på konto 5810 (Körjournal – milersättning).`
      : `Skatteverket standard rate ${new Date().getFullYear()}: SEK 1.85/km. The mileage log substantiates the deduction on filing. Always state business purpose and destination per trip. Post the total deduction to account 5810 (Mileage – Körjournal).`,
    saving: sv ? "Sparar..." : "Saving...",
    error: sv ? "Fel" : "Error"
  };

  const [entries, setEntries] = useState<MileageEntry[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalKm = entries.reduce((sum, e) => sum + e.kilometers, 0);
  const totalDeduction = entries.reduce((sum, e) => sum + e.deductionAmount, 0);

  const startAdd = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
    setErrorMsg(null);
  };

  const cancel = () => {
    setShowForm(false);
    setErrorMsg(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      const body = {
        tripDate: form.tripDate,
        destination: form.destination,
        purpose: form.purpose,
        kilometers: parseFloat(form.kilometers),
        ratePerKm: CURRENT_RATE,
        notes: form.notes || undefined
      };
      const res = await fetch("/api/mileage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      setEntries((prev) => [json, ...prev]);
      cancel();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm(sv ? "Ta bort resan?" : "Delete this trip?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/mileage/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <p className="note">{copy.ruleNote}</p>

      <div className="grid">
        <article className="card">
          <p className="label">{copy.totalKm} ({currentYear})</p>
          <p className="kpi">{Math.round(totalKm * 10) / 10} km</p>
        </article>
        <article className="card">
          <p className="label">{copy.total} ({currentYear})</p>
          <p className="kpi">{formatSEK(Math.round(totalDeduction * 100) / 100)}</p>
        </article>
      </div>

      {!showForm && (
        <div className="row">
          <button type="button" onClick={startAdd}>{copy.addEntry}</button>
        </div>
      )}

      {showForm && (
        <form className="stack" onSubmit={submit} style={{ background: "var(--surface-raised, #f9f9f9)", padding: "1rem", borderRadius: 6 }}>
          <div className="row">
            <label className="stack">
              {copy.tripDate}
              <input
                type="date"
                required
                value={form.tripDate}
                onChange={(e) => setForm((s) => ({ ...s, tripDate: e.target.value }))}
              />
            </label>
            <label className="stack" style={{ flex: 2 }}>
              {copy.destination}
              <input
                required
                value={form.destination}
                onChange={(e) => setForm((s) => ({ ...s, destination: e.target.value }))}
                placeholder={sv ? "t.ex. Stockholm → Göteborg (kundmöte)" : "e.g. Stockholm → Gothenburg (client meeting)"}
              />
            </label>
          </div>

          <div className="row">
            <label className="stack" style={{ flex: 2 }}>
              {copy.purpose}
              <input
                required
                value={form.purpose}
                onChange={(e) => setForm((s) => ({ ...s, purpose: e.target.value }))}
                placeholder={sv ? "t.ex. Kundmöte med Acme AB" : "e.g. Client meeting with Acme AB"}
              />
            </label>
            <label className="stack">
              {copy.kilometers}
              <input
                type="number"
                required
                min={0.1}
                step="0.1"
                value={form.kilometers}
                onChange={(e) => setForm((s) => ({ ...s, kilometers: e.target.value }))}
                placeholder="0"
              />
            </label>
            <label className="stack">
              {copy.rate}
              <input type="text" readOnly value={`${CURRENT_RATE} kr/km`} style={{ background: "var(--surface)" }} />
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
          {form.kilometers && (
            <p className="note">
              {sv ? "Beräknat avdrag" : "Estimated deduction"}:{" "}
              {formatSEK(Math.round(parseFloat(form.kilometers || "0") * CURRENT_RATE * 100) / 100)}
            </p>
          )}
          {errorMsg && <p className="error">{copy.error}: {errorMsg}</p>}
        </form>
      )}

      {entries.length === 0 ? (
        <p className="note">{copy.noEntries}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--border)" }}>
              <th style={{ padding: "0.5rem" }}>{copy.tripDate}</th>
              <th style={{ padding: "0.5rem" }}>{copy.destination}</th>
              <th style={{ padding: "0.5rem" }}>{copy.purpose}</th>
              <th style={{ padding: "0.5rem", textAlign: "right" }}>{copy.kilometers}</th>
              <th style={{ padding: "0.5rem", textAlign: "right" }}>{copy.deduction}</th>
              <th style={{ padding: "0.5rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.5rem" }}>{formatDate(entry.tripDate)}</td>
                <td style={{ padding: "0.5rem" }}>{entry.destination}</td>
                <td style={{ padding: "0.5rem" }}>
                  {entry.purpose}
                  {entry.notes && <div style={{ fontSize: "0.75em", color: "#888" }}>{entry.notes}</div>}
                </td>
                <td style={{ padding: "0.5rem", textAlign: "right" }}>{entry.kilometers} km</td>
                <td style={{ padding: "0.5rem", textAlign: "right" }}>{formatSEK(entry.deductionAmount)}</td>
                <td style={{ padding: "0.5rem" }}>
                  <button
                    type="button"
                    className="secondary"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.8em" }}
                    onClick={() => deleteEntry(entry.id)}
                    disabled={busy}
                  >
                    {copy.delete}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 600 }}>
              <td colSpan={3} style={{ padding: "0.5rem" }}>{copy.total}</td>
              <td style={{ padding: "0.5rem", textAlign: "right" }}>{Math.round(totalKm * 10) / 10} km</td>
              <td style={{ padding: "0.5rem", textAlign: "right" }}>{formatSEK(Math.round(totalDeduction * 100) / 100)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
};
