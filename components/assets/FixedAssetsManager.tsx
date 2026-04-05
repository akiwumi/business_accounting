"use client";

import { useState } from "react";
import { type Locale } from "@/lib/i18n/locale";

type Asset = {
  id: string;
  description: string;
  category: string;
  acquisitionDate: string;
  acquisitionCost: number;
  depreciationMethod: string;
  disposalDate: string | null;
  disposalValue: number | null;
  notes: string | null;
};

type FixedAssetsManagerProps = {
  locale: Locale;
  initial: Asset[];
};

const METHODS = {
  declining_30: { en: "Declining balance 30% (equipment, standard)", sv: "Räkenskapsenlig avskrivning 30% (inventarier)" },
  straight_20: { en: "Straight-line 20% (equipment, alternative)", sv: "Planenlig avskrivning 20% (inventarier)" },
  straight_25: { en: "Straight-line 25% (computers / IT)", sv: "Planenlig avskrivning 25% (datorer/IT)" },
  building_4: { en: "Straight-line 4% (buildings)", sv: "Planenlig avskrivning 4% (byggnader)" }
} as const;

const CATEGORIES = {
  equipment: { en: "Equipment / Machinery", sv: "Inventarier / Maskiner" },
  vehicle: { en: "Vehicle", sv: "Fordon" },
  building: { en: "Building / Premises", sv: "Byggnad / Lokal" },
  intangible: { en: "Intangible asset", sv: "Immateriell tillgång" },
  other: { en: "Other", sv: "Övrigt" }
} as const;

const toDateString = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

const NBV_DECLINING = (cost: number, rate: number, years: number) => {
  let nbv = cost;
  for (let i = 0; i < years; i++) nbv = nbv * (1 - rate);
  return Math.max(0, Math.round(nbv * 100) / 100);
};

const computeNBV = (asset: Asset): number => {
  const years = new Date().getFullYear() - new Date(asset.acquisitionDate).getFullYear();
  const cost = asset.acquisitionCost;
  switch (asset.depreciationMethod) {
    case "declining_30": return NBV_DECLINING(cost, 0.3, years);
    case "straight_20": return Math.max(0, Math.round((cost - cost * 0.2 * years) * 100) / 100);
    case "straight_25": return Math.max(0, Math.round((cost - cost * 0.25 * years) * 100) / 100);
    case "building_4": return Math.max(0, Math.round((cost - cost * 0.04 * years) * 100) / 100);
    default: return cost;
  }
};

const formatSEK = (amount: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(amount);

const EMPTY_FORM = {
  description: "",
  category: "equipment",
  acquisitionDate: new Date().toISOString().slice(0, 10),
  acquisitionCost: "",
  depreciationMethod: "declining_30",
  disposalDate: "",
  disposalValue: "",
  notes: ""
};

export const FixedAssetsManager = ({ locale, initial }: FixedAssetsManagerProps) => {
  const sv = locale === "sv";
  const copy = {
    title: sv ? "Inventarieregister (anläggningstillgångar)" : "Fixed Asset Register (Inventarieregister)",
    addAsset: sv ? "Lägg till tillgång" : "Add Asset",
    description: sv ? "Beskrivning" : "Description",
    category: sv ? "Kategori" : "Category",
    acquisitionDate: sv ? "Anskaffningsdatum" : "Acquisition Date",
    acquisitionCost: sv ? "Anskaffningsvärde (SEK inkl. moms)" : "Acquisition Cost (SEK incl. VAT)",
    depreciationMethod: sv ? "Avskrivningsmetod" : "Depreciation Method",
    disposalDate: sv ? "Avyttringsdatum (om avyttrad)" : "Disposal Date (if disposed)",
    disposalValue: sv ? "Avyttringsvärde (SEK)" : "Disposal Proceeds (SEK)",
    notes: sv ? "Noteringar" : "Notes",
    save: sv ? "Spara" : "Save",
    cancel: sv ? "Avbryt" : "Cancel",
    edit: sv ? "Redigera" : "Edit",
    delete: sv ? "Ta bort" : "Delete",
    nbv: sv ? "Bokfört restvärde (ca)" : "Net Book Value (approx.)",
    method: sv ? "Metod" : "Method",
    cost: sv ? "Anskaffningsvärde" : "Cost",
    acquired: sv ? "Anskaffat" : "Acquired",
    disposed: sv ? "Avyttrad" : "Disposed",
    noAssets: sv
      ? "Inga tillgångar registrerade. Lägg till inventarier, fordon och byggnader här."
      : "No assets recorded. Add equipment, vehicles and buildings here.",
    ruleNote: sv
      ? "Avskrivningsregler: Inventarier – 30% räkenskapsenlig (standard) eller 20% planenlig. IT/datorer – 25%. Byggnader – 4%. Avskrivningar visas automatiskt på NE-bilagedraftet."
      : "Depreciation rules: Equipment – 30% declining balance (standard) or 20% straight-line. IT/computers – 25%. Buildings – 4%. Depreciation flows automatically into the NE-bilaga draft.",
    saving: sv ? "Sparar..." : "Saving...",
    deleting: sv ? "Tar bort..." : "Deleting...",
    error: sv ? "Fel" : "Error"
  };

  const [assets, setAssets] = useState<Asset[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setErrorMsg(null);
  };

  const startEdit = (asset: Asset) => {
    setForm({
      description: asset.description,
      category: asset.category,
      acquisitionDate: toDateString(asset.acquisitionDate),
      acquisitionCost: String(asset.acquisitionCost),
      depreciationMethod: asset.depreciationMethod,
      disposalDate: asset.disposalDate ? toDateString(asset.disposalDate) : "",
      disposalValue: asset.disposalValue != null ? String(asset.disposalValue) : "",
      notes: asset.notes ?? ""
    });
    setEditingId(asset.id);
    setShowForm(true);
    setErrorMsg(null);
  };

  const cancel = () => {
    setShowForm(false);
    setEditingId(null);
    setErrorMsg(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      const body = {
        description: form.description,
        category: form.category,
        acquisitionDate: form.acquisitionDate,
        acquisitionCost: parseFloat(form.acquisitionCost),
        depreciationMethod: form.depreciationMethod,
        disposalDate: form.disposalDate || undefined,
        disposalValue: form.disposalValue ? parseFloat(form.disposalValue) : undefined,
        notes: form.notes || undefined
      };
      const url = editingId ? `/api/assets/${editingId}` : "/api/assets";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");

      if (editingId) {
        setAssets((prev) => prev.map((a) => (a.id === editingId ? json : a)));
      } else {
        setAssets((prev) => [json, ...prev]);
      }
      cancel();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const deleteAsset = async (id: string) => {
    if (!confirm(sv ? "Ta bort tillgången?" : "Delete this asset?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <p className="note">{copy.ruleNote}</p>

      {!showForm && (
        <div className="row">
          <button type="button" onClick={startAdd}>{copy.addAsset}</button>
        </div>
      )}

      {showForm && (
        <form className="stack" onSubmit={submit} style={{ background: "var(--surface-raised, #f9f9f9)", padding: "1rem", borderRadius: 6 }}>
          <div className="row">
            <label className="stack" style={{ flex: 2 }}>
              {copy.description}
              <input
                required
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                placeholder={sv ? "t.ex. Bärbar dator MacBook Pro 14" : "e.g. MacBook Pro 14 laptop"}
              />
            </label>
            <label className="stack">
              {copy.category}
              <select value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}>
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v[locale]}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="row">
            <label className="stack">
              {copy.acquisitionDate}
              <input
                type="date"
                required
                value={form.acquisitionDate}
                onChange={(e) => setForm((s) => ({ ...s, acquisitionDate: e.target.value }))}
              />
            </label>
            <label className="stack">
              {copy.acquisitionCost}
              <input
                type="number"
                required
                min={0}
                step="0.01"
                value={form.acquisitionCost}
                onChange={(e) => setForm((s) => ({ ...s, acquisitionCost: e.target.value }))}
              />
            </label>
            <label className="stack">
              {copy.depreciationMethod}
              <select
                value={form.depreciationMethod}
                onChange={(e) => setForm((s) => ({ ...s, depreciationMethod: e.target.value }))}
              >
                {Object.entries(METHODS).map(([k, v]) => (
                  <option key={k} value={k}>{v[locale]}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="row">
            <label className="stack">
              {copy.disposalDate}
              <input
                type="date"
                value={form.disposalDate}
                onChange={(e) => setForm((s) => ({ ...s, disposalDate: e.target.value }))}
              />
            </label>
            <label className="stack">
              {copy.disposalValue}
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.disposalValue}
                onChange={(e) => setForm((s) => ({ ...s, disposalValue: e.target.value }))}
              />
            </label>
            <label className="stack">
              {copy.notes}
              <input
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                placeholder={sv ? "Valfria noteringar" : "Optional notes"}
              />
            </label>
          </div>

          <div className="row">
            <button type="submit" disabled={busy}>{busy ? copy.saving : copy.save}</button>
            <button type="button" className="secondary" onClick={cancel} disabled={busy}>{copy.cancel}</button>
          </div>
          {errorMsg && <p className="error">{copy.error}: {errorMsg}</p>}
        </form>
      )}

      {assets.length === 0 ? (
        <p className="note">{copy.noAssets}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--border)" }}>
              <th style={{ padding: "0.5rem" }}>{copy.description}</th>
              <th style={{ padding: "0.5rem" }}>{copy.acquired}</th>
              <th style={{ padding: "0.5rem" }}>{copy.cost}</th>
              <th style={{ padding: "0.5rem" }}>{copy.method}</th>
              <th style={{ padding: "0.5rem" }}>{copy.nbv}</th>
              <th style={{ padding: "0.5rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const nbv = computeNBV(asset);
              const isDisposed = Boolean(asset.disposalDate);
              return (
                <tr key={asset.id} style={{ borderBottom: "1px solid var(--border)", opacity: isDisposed ? 0.6 : 1 }}>
                  <td style={{ padding: "0.5rem" }}>
                    {asset.description}
                    {isDisposed && (
                      <span style={{ marginLeft: 6, fontSize: "0.75em", color: "#888" }}>
                        ({copy.disposed})
                      </span>
                    )}
                    {asset.notes && <div style={{ fontSize: "0.75em", color: "#888" }}>{asset.notes}</div>}
                  </td>
                  <td style={{ padding: "0.5rem" }}>{toDateString(asset.acquisitionDate)}</td>
                  <td style={{ padding: "0.5rem" }}>{formatSEK(asset.acquisitionCost)}</td>
                  <td style={{ padding: "0.5rem", fontSize: "0.8em" }}>
                    {METHODS[asset.depreciationMethod as keyof typeof METHODS]?.[locale] ?? asset.depreciationMethod}
                  </td>
                  <td style={{ padding: "0.5rem" }}>{isDisposed ? "–" : formatSEK(nbv)}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <div className="row">
                      <button type="button" className="secondary" style={{ padding: "0.25rem 0.5rem", fontSize: "0.8em" }} onClick={() => startEdit(asset)} disabled={busy}>
                        {copy.edit}
                      </button>
                      <button type="button" className="secondary" style={{ padding: "0.25rem 0.5rem", fontSize: "0.8em" }} onClick={() => deleteAsset(asset.id)} disabled={busy}>
                        {copy.delete}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};
