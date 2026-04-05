"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatMoney } from "@/lib/data/format";
import { type Locale } from "@/lib/i18n/locale";

type EmployeeRow = {
  id: string;
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  personalNumber: string;
  taxTable: string | null;
  preliminaryTaxRate: number;
  employerContributionRate: number;
  pensionRate: number;
  bankAccountName: string | null;
  bankClearingNumber: string | null;
  bankAccountNumber: string | null;
  iban: string | null;
  bic: string | null;
  status: string;
  salaryTotals: {
    gross: number;
    tax: number;
    employerContribution: number;
    pension: number;
    net: number;
    paidCount: number;
  };
  expenseTotals: {
    claimed: number;
    approved: number;
    paid: number;
  };
  salaryCount: number;
  expenseCount: number;
};

type SalariesManagerProps = {
  locale: Locale;
  initialEmployees: EmployeeRow[];
};

const EMPTY_FORM = {
  employeeNumber: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  personalNumber: "",
  taxTable: "",
  preliminaryTaxRate: "0.30",
  employerContributionRate: "0.3142",
  pensionRate: "0.045",
  bankAccountName: "",
  bankClearingNumber: "",
  bankAccountNumber: "",
  iban: "",
  bic: ""
};

export const SalariesManager = ({ locale, initialEmployees }: SalariesManagerProps) => {
  const sv = locale === "sv";
  const numberLocale = sv ? "sv-SE" : "en-GB";
  const copy = {
    title: sv ? "Anställda och löneöversikt" : "Employees and Payroll Overview",
    subtitle: sv
      ? "Registrera anställda med personuppgifter, bankkonton och skatteinställningar. Öppna varje anställd för löner och utlägg."
      : "Register employees with personal details, bank details and tax settings. Open each employee for salary and expense workflows.",
    addEmployee: sv ? "Lägg till anställd" : "Add Employee",
    saving: sv ? "Sparar..." : "Saving...",
    noEmployees: sv ? "Inga anställda registrerade än." : "No employees added yet.",
    view: sv ? "Öppna" : "Open",
    employee: sv ? "Anställd" : "Employee",
    personnummer: sv ? "Personnummer" : "Personal Number",
    status: sv ? "Status" : "Status",
    salaryGross: sv ? "Lön brutto (totalt)" : "Salary Gross (Total)",
    salaryNet: sv ? "Nettolön (totalt)" : "Net Salary (Total)",
    taxTotal: sv ? "Prelskatt (totalt)" : "Preliminary Tax (Total)",
    pensionTotal: sv ? "Pension (totalt)" : "Pension (Total)",
    employerTotal: sv ? "Arbetsgivaravgifter (totalt)" : "Employer Contributions (Total)",
    expenseTotal: sv ? "Utlägg (totalt)" : "Expenses (Total)",
    rates: sv ? "Satser" : "Rates",
    paidRuns: sv ? "Utbetalda löner" : "Paid Salaries",
    actions: sv ? "Åtgärder" : "Actions",
    overall: sv ? "Totaler (alla anställda)" : "Totals (All Employees)",
    active: sv ? "Aktiva" : "Active",
    inactive: sv ? "Inaktiva" : "Inactive",
    required: sv ? "Fyll i förnamn, efternamn och personnummer." : "Provide first name, last name and personal number.",
    failed: sv ? "Kunde inte spara anställd." : "Failed to save employee."
  };

  const [employees, setEmployees] = useState<EmployeeRow[]>(initialEmployees);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    return employees.reduce(
      (accumulator, employee) => {
        accumulator.gross += employee.salaryTotals.gross;
        accumulator.net += employee.salaryTotals.net;
        accumulator.tax += employee.salaryTotals.tax;
        accumulator.pension += employee.salaryTotals.pension;
        accumulator.employer += employee.salaryTotals.employerContribution;
        accumulator.expenses += employee.expenseTotals.claimed;
        if (employee.status === "ACTIVE") accumulator.active += 1;
        if (employee.status === "INACTIVE") accumulator.inactive += 1;
        return accumulator;
      },
      { gross: 0, net: 0, tax: 0, pension: 0, employer: 0, expenses: 0, active: 0, inactive: 0 }
    );
  }, [employees]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim() || !form.personalNumber.trim()) {
      setError(copy.required);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/salaries/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeNumber: form.employeeNumber.trim() || undefined,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          personalNumber: form.personalNumber.trim(),
          taxTable: form.taxTable.trim() || undefined,
          preliminaryTaxRate: Number(form.preliminaryTaxRate),
          employerContributionRate: Number(form.employerContributionRate),
          pensionRate: Number(form.pensionRate),
          bankAccountName: form.bankAccountName.trim() || undefined,
          bankClearingNumber: form.bankClearingNumber.trim() || undefined,
          bankAccountNumber: form.bankAccountNumber.trim() || undefined,
          iban: form.iban.trim() || undefined,
          bic: form.bic.trim() || undefined
        })
      });
      const json = (await response.json()) as {
        employee?: EmployeeRow;
        error?: string;
      };
      if (!response.ok || !json.employee) {
        throw new Error(json.error ?? copy.failed);
      }
      const createdEmployee = json.employee;
      setEmployees((previous) =>
        [...previous, createdEmployee].sort((a, b) =>
          `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)
        )
      );
      setForm(EMPTY_FORM);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : copy.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack salariesManager">
      <h2>{copy.title}</h2>
      <p className="note">{copy.subtitle}</p>

      <article className="card" id="salary-employee-create">
        <h3>{copy.addEmployee}</h3>
        <form className="stack" onSubmit={onSubmit}>
          <div className="row">
            <label className="stack">
              {sv ? "Anställningsnummer" : "Employee Number"}
              <input
                value={form.employeeNumber}
                onChange={(event) => setForm((prev) => ({ ...prev, employeeNumber: event.target.value }))}
              />
            </label>
            <label className="stack">
              {sv ? "Förnamn" : "First Name"}
              <input
                required
                value={form.firstName}
                onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
              />
            </label>
            <label className="stack">
              {sv ? "Efternamn" : "Last Name"}
              <input
                required
                value={form.lastName}
                onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
              />
            </label>
            <label className="stack">
              {copy.personnummer}
              <input
                required
                value={form.personalNumber}
                onChange={(event) => setForm((prev) => ({ ...prev, personalNumber: event.target.value }))}
              />
            </label>
          </div>

          <div className="row">
            <label className="stack">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </label>
            <label className="stack">
              {sv ? "Telefon" : "Phone"}
              <input
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </label>
            <label className="stack">
              {sv ? "Skattetabell" : "Tax Table"}
              <input
                value={form.taxTable}
                onChange={(event) => setForm((prev) => ({ ...prev, taxTable: event.target.value }))}
              />
            </label>
          </div>

          <div className="row">
            <label className="stack">
              {sv ? "Prel. skatt (decimal)" : "Preliminary Tax (decimal)"}
              <input
                type="number"
                min={0}
                max={1}
                step={0.0001}
                value={form.preliminaryTaxRate}
                onChange={(event) => setForm((prev) => ({ ...prev, preliminaryTaxRate: event.target.value }))}
              />
            </label>
            <label className="stack">
              {sv ? "Arbetsgivaravgift (decimal)" : "Employer Contribution (decimal)"}
              <input
                type="number"
                min={0}
                max={1}
                step={0.0001}
                value={form.employerContributionRate}
                onChange={(event) => setForm((prev) => ({ ...prev, employerContributionRate: event.target.value }))}
              />
            </label>
            <label className="stack">
              {sv ? "Pension (decimal)" : "Pension (decimal)"}
              <input
                type="number"
                min={0}
                max={1}
                step={0.0001}
                value={form.pensionRate}
                onChange={(event) => setForm((prev) => ({ ...prev, pensionRate: event.target.value }))}
              />
            </label>
          </div>

          <div className="row">
            <label className="stack">
              {sv ? "Kontoinnehavare" : "Bank Account Name"}
              <input
                value={form.bankAccountName}
                onChange={(event) => setForm((prev) => ({ ...prev, bankAccountName: event.target.value }))}
              />
            </label>
            <label className="stack">
              {sv ? "Clearingnummer" : "Clearing Number"}
              <input
                value={form.bankClearingNumber}
                onChange={(event) => setForm((prev) => ({ ...prev, bankClearingNumber: event.target.value }))}
              />
            </label>
            <label className="stack">
              {sv ? "Kontonummer" : "Account Number"}
              <input
                value={form.bankAccountNumber}
                onChange={(event) => setForm((prev) => ({ ...prev, bankAccountNumber: event.target.value }))}
              />
            </label>
            <label className="stack">
              IBAN
              <input
                value={form.iban}
                onChange={(event) => setForm((prev) => ({ ...prev, iban: event.target.value }))}
              />
            </label>
            <label className="stack">
              BIC
              <input
                value={form.bic}
                onChange={(event) => setForm((prev) => ({ ...prev, bic: event.target.value }))}
              />
            </label>
          </div>

          <div className="row">
            <button type="submit" disabled={saving}>
              {saving ? copy.saving : copy.addEmployee}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      </article>

      <article className="card" id="salary-overview">
        <h3>{copy.overall}</h3>
        <div className="grid">
          <div>
            <p className="label">{copy.salaryGross}</p>
            <p className="kpi">{formatMoney(totals.gross, "SEK", numberLocale)}</p>
          </div>
          <div>
            <p className="label">{copy.salaryNet}</p>
            <p className="kpi">{formatMoney(totals.net, "SEK", numberLocale)}</p>
          </div>
          <div>
            <p className="label">{copy.taxTotal}</p>
            <p className="kpi">{formatMoney(totals.tax, "SEK", numberLocale)}</p>
          </div>
          <div>
            <p className="label">{copy.pensionTotal}</p>
            <p className="kpi">{formatMoney(totals.pension, "SEK", numberLocale)}</p>
          </div>
          <div>
            <p className="label">{copy.employerTotal}</p>
            <p className="kpi">{formatMoney(totals.employer, "SEK", numberLocale)}</p>
          </div>
          <div>
            <p className="label">{copy.expenseTotal}</p>
            <p className="kpi">{formatMoney(totals.expenses, "SEK", numberLocale)}</p>
          </div>
          <div>
            <p className="label">{copy.active}</p>
            <p className="kpi">{totals.active}</p>
          </div>
          <div>
            <p className="label">{copy.inactive}</p>
            <p className="kpi">{totals.inactive}</p>
          </div>
        </div>
      </article>

      <article className="card" id="salary-employees-list">
        <div className="tableWrap ledgerTableWrap">
          <table>
            <thead>
              <tr>
                <th>{copy.employee}</th>
                <th>{copy.personnummer}</th>
                <th>{copy.status}</th>
                <th>{copy.salaryGross}</th>
                <th>{copy.salaryNet}</th>
                <th>{copy.taxTotal}</th>
                <th>{copy.pensionTotal}</th>
                <th>{copy.employerTotal}</th>
                <th>{copy.expenseTotal}</th>
                <th>{copy.rates}</th>
                <th>{copy.paidRuns}</th>
                <th>{copy.actions}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <strong>{employee.fullName}</strong>
                    <div className="note">{employee.employeeNumber || "-"}</div>
                    <div className="note">{employee.email || "-"}</div>
                  </td>
                  <td>{employee.personalNumber}</td>
                  <td>{employee.status}</td>
                  <td>{formatMoney(employee.salaryTotals.gross, "SEK", numberLocale)}</td>
                  <td>{formatMoney(employee.salaryTotals.net, "SEK", numberLocale)}</td>
                  <td>{formatMoney(employee.salaryTotals.tax, "SEK", numberLocale)}</td>
                  <td>{formatMoney(employee.salaryTotals.pension, "SEK", numberLocale)}</td>
                  <td>{formatMoney(employee.salaryTotals.employerContribution, "SEK", numberLocale)}</td>
                  <td>{formatMoney(employee.expenseTotals.claimed, "SEK", numberLocale)}</td>
                  <td>
                    <div className="note">Tax {employee.preliminaryTaxRate.toFixed(4)}</div>
                    <div className="note">AG {employee.employerContributionRate.toFixed(4)}</div>
                    <div className="note">Pension {employee.pensionRate.toFixed(4)}</div>
                  </td>
                  <td>{employee.salaryTotals.paidCount}</td>
                  <td>
                    <Link href={`/salaries/${employee.id}`}>{copy.view}</Link>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={12}>{copy.noEmployees}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
};
