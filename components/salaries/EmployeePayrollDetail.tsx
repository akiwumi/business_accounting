"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatMoney } from "@/lib/data/format";
import { type Locale } from "@/lib/i18n/locale";

type SalaryEntry = {
  id: string;
  payrollDate: string;
  periodFrom: string | null;
  periodTo: string | null;
  grossSalary: number;
  bonusAmount: number;
  overtimeAmount: number;
  benefitsAmount: number;
  taxableGross: number;
  preliminaryTaxRate: number;
  preliminaryTaxAmount: number;
  employerContributionRate: number;
  employerContributionAmount: number;
  pensionRate: number;
  pensionAmount: number;
  netSalary: number;
  status: string;
  approvedAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  notes: string | null;
  transactionId: string | null;
  createdAt: string;
};

type ExpenseEntry = {
  id: string;
  expenseDate: string;
  category: string;
  description: string;
  grossAmount: number;
  vatAmount: number;
  netAmount: number;
  currency: string;
  status: string;
  approvedAt: string | null;
  paidAt: string | null;
  receiptReference: string | null;
  paymentReference: string | null;
  notes: string | null;
  transactionId: string | null;
  createdAt: string;
};

type EmployeePayload = {
  id: string;
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  personalNumber: string;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
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
  salaryEntries: SalaryEntry[];
  expenses: ExpenseEntry[];
};

type EmployeePayrollDetailProps = {
  locale: Locale;
  employee: EmployeePayload;
};

const createSalaryDefaults = () => ({
  payrollDate: new Date().toISOString().slice(0, 10),
  periodFrom: "",
  periodTo: "",
  grossSalary: "",
  bonusAmount: "",
  overtimeAmount: "",
  benefitsAmount: "",
  preliminaryTaxRate: "",
  employerContributionRate: "",
  pensionRate: "",
  notes: ""
});

const createExpenseDefaults = () => ({
  expenseDate: new Date().toISOString().slice(0, 10),
  category: "Travel",
  description: "",
  grossAmount: "",
  vatAmount: "",
  currency: "SEK",
  receiptReference: "",
  notes: ""
});

export const EmployeePayrollDetail = ({ locale, employee }: EmployeePayrollDetailProps) => {
  const sv = locale === "sv";
  const numberLocale = sv ? "sv-SE" : "en-GB";
  const copy = {
    back: sv ? "Tillbaka till löner" : "Back to salaries",
    employee: sv ? "Anställd" : "Employee",
    personalNumber: sv ? "Personnummer" : "Personal Number",
    taxSettings: sv ? "Skatteinställningar" : "Tax Settings",
    bankDetails: sv ? "Bankuppgifter" : "Bank Details",
    salaryTitle: sv ? "Lönekörningar" : "Salary Runs",
    expenseTitle: sv ? "Utlägg" : "Expense Claims",
    addSalary: sv ? "Lägg till lönekörning" : "Add Salary Run",
    addExpense: sv ? "Registrera utlägg" : "Add Expense Claim",
    save: sv ? "Spara" : "Save",
    saving: sv ? "Sparar..." : "Saving...",
    date: sv ? "Datum" : "Date",
    periodFrom: sv ? "Period från" : "Period From",
    periodTo: sv ? "Period till" : "Period To",
    grossSalary: sv ? "Bruttolön" : "Gross Salary",
    bonus: sv ? "Bonus" : "Bonus",
    overtime: sv ? "Övertid" : "Overtime",
    benefits: sv ? "Förmåner" : "Benefits",
    taxRate: sv ? "Prel. skatt (decimal)" : "Preliminary Tax (decimal)",
    employerRate: sv ? "Arbetsgivaravgift (decimal)" : "Employer Contribution (decimal)",
    pensionRate: sv ? "Pension (decimal)" : "Pension (decimal)",
    notes: sv ? "Noteringar" : "Notes",
    status: sv ? "Status" : "Status",
    approve: sv ? "Godkänn" : "Approve",
    pay: sv ? "Markera betald" : "Mark Paid",
    paid: sv ? "Betald" : "Paid",
    approved: sv ? "Godkänd" : "Approved",
    draft: sv ? "Utkast" : "Draft",
    category: sv ? "Kategori" : "Category",
    description: sv ? "Beskrivning" : "Description",
    grossAmount: sv ? "Brutto" : "Gross",
    vatAmount: sv ? "Moms" : "VAT",
    netAmount: sv ? "Netto" : "Net",
    currency: sv ? "Valuta" : "Currency",
    receiptRef: sv ? "Kvitto-/referensnr" : "Receipt/Reference",
    noneSalary: sv ? "Inga lönekörningar registrerade." : "No salary runs recorded.",
    noneExpense: sv ? "Inga utlägg registrerade." : "No expenses recorded.",
    totals: sv ? "Summering" : "Totals",
    salaryGrossTotal: sv ? "Bruttolön totalt" : "Gross Salary Total",
    salaryNetTotal: sv ? "Nettolön totalt" : "Net Salary Total",
    salaryTaxTotal: sv ? "Prel. skatt totalt" : "Preliminary Tax Total",
    salaryPensionTotal: sv ? "Pension totalt" : "Pension Total",
    salaryEmployerTotal: sv ? "Arbetsgivaravgift totalt" : "Employer Contribution Total",
    expenseTotal: sv ? "Utlägg totalt" : "Expense Total",
    pendingExpense: sv ? "Ej godkända utlägg" : "Pending Expenses",
    actions: sv ? "Åtgärder" : "Actions",
    failed: sv ? "Åtgärden misslyckades." : "Action failed."
  };

  const [salaryEntries, setSalaryEntries] = useState<SalaryEntry[]>(employee.salaryEntries);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>(employee.expenses);
  const [salaryForm, setSalaryForm] = useState(() => ({
    ...createSalaryDefaults(),
    preliminaryTaxRate: employee.preliminaryTaxRate.toFixed(4),
    employerContributionRate: employee.employerContributionRate.toFixed(4),
    pensionRate: employee.pensionRate.toFixed(4)
  }));
  const [expenseForm, setExpenseForm] = useState(createExpenseDefaults);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const salaryTotals = useMemo(() => {
    return salaryEntries.reduce(
      (accumulator, entry) => {
        accumulator.gross += entry.taxableGross;
        accumulator.net += entry.netSalary;
        accumulator.tax += entry.preliminaryTaxAmount;
        accumulator.pension += entry.pensionAmount;
        accumulator.employer += entry.employerContributionAmount;
        return accumulator;
      },
      { gross: 0, net: 0, tax: 0, pension: 0, employer: 0 }
    );
  }, [salaryEntries]);

  const expenseTotals = useMemo(() => {
    return expenses.reduce(
      (accumulator, entry) => {
        accumulator.total += entry.grossAmount;
        if (entry.status === "PENDING") accumulator.pending += entry.grossAmount;
        return accumulator;
      },
      { total: 0, pending: 0 }
    );
  }, [expenses]);

  const submitSalary = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusyKey("create-salary");
    try {
      const response = await fetch(`/api/salaries/employees/${employee.id}/salary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payrollDate: salaryForm.payrollDate,
          periodFrom: salaryForm.periodFrom || undefined,
          periodTo: salaryForm.periodTo || undefined,
          grossSalary: Number(salaryForm.grossSalary),
          bonusAmount: Number(salaryForm.bonusAmount || "0"),
          overtimeAmount: Number(salaryForm.overtimeAmount || "0"),
          benefitsAmount: Number(salaryForm.benefitsAmount || "0"),
          preliminaryTaxRate: Number(salaryForm.preliminaryTaxRate),
          employerContributionRate: Number(salaryForm.employerContributionRate),
          pensionRate: Number(salaryForm.pensionRate),
          notes: salaryForm.notes || undefined
        })
      });
      const json = (await response.json()) as { salaryEntry?: SalaryEntry; error?: string };
      if (!response.ok || !json.salaryEntry) {
        throw new Error(json.error ?? copy.failed);
      }
      const salaryEntry = json.salaryEntry;
      setSalaryEntries((previous) => [salaryEntry, ...previous]);
      setSalaryForm({
        ...createSalaryDefaults(),
        preliminaryTaxRate: employee.preliminaryTaxRate.toFixed(4),
        employerContributionRate: employee.employerContributionRate.toFixed(4),
        pensionRate: employee.pensionRate.toFixed(4)
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : copy.failed);
    } finally {
      setBusyKey(null);
    }
  };

  const submitExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusyKey("create-expense");
    try {
      const response = await fetch(`/api/salaries/employees/${employee.id}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseDate: expenseForm.expenseDate,
          category: expenseForm.category,
          description: expenseForm.description,
          grossAmount: Number(expenseForm.grossAmount),
          vatAmount: Number(expenseForm.vatAmount || "0"),
          currency: expenseForm.currency,
          receiptReference: expenseForm.receiptReference || undefined,
          notes: expenseForm.notes || undefined
        })
      });
      const json = (await response.json()) as { expense?: ExpenseEntry; error?: string };
      if (!response.ok || !json.expense) {
        throw new Error(json.error ?? copy.failed);
      }
      const expense = json.expense;
      setExpenses((previous) => [expense, ...previous]);
      setExpenseForm(createExpenseDefaults());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : copy.failed);
    } finally {
      setBusyKey(null);
    }
  };

  const approveSalary = async (id: string) => {
    setError(null);
    setBusyKey(`approve-salary-${id}`);
    try {
      const response = await fetch(`/api/salaries/salary/${id}/approve`, { method: "POST" });
      const json = (await response.json()) as { salaryEntry?: Partial<SalaryEntry>; error?: string };
      if (!response.ok || !json.salaryEntry) throw new Error(json.error ?? copy.failed);
      setSalaryEntries((previous) =>
        previous.map((entry) => (entry.id === id ? { ...entry, ...json.salaryEntry } as SalaryEntry : entry))
      );
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : copy.failed);
    } finally {
      setBusyKey(null);
    }
  };

  const paySalary = async (id: string) => {
    setError(null);
    setBusyKey(`pay-salary-${id}`);
    try {
      const response = await fetch(`/api/salaries/salary/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const json = (await response.json()) as { salaryEntry?: Partial<SalaryEntry>; error?: string };
      if (!response.ok || !json.salaryEntry) throw new Error(json.error ?? copy.failed);
      setSalaryEntries((previous) =>
        previous.map((entry) => (entry.id === id ? { ...entry, ...json.salaryEntry } as SalaryEntry : entry))
      );
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : copy.failed);
    } finally {
      setBusyKey(null);
    }
  };

  const approveExpense = async (id: string) => {
    setError(null);
    setBusyKey(`approve-expense-${id}`);
    try {
      const response = await fetch(`/api/salaries/expenses/${id}/approve`, { method: "POST" });
      const json = (await response.json()) as { expense?: Partial<ExpenseEntry>; error?: string };
      if (!response.ok || !json.expense) throw new Error(json.error ?? copy.failed);
      setExpenses((previous) =>
        previous.map((entry) => (entry.id === id ? { ...entry, ...json.expense } as ExpenseEntry : entry))
      );
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : copy.failed);
    } finally {
      setBusyKey(null);
    }
  };

  const payExpense = async (id: string) => {
    setError(null);
    setBusyKey(`pay-expense-${id}`);
    try {
      const response = await fetch(`/api/salaries/expenses/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const json = (await response.json()) as { expense?: Partial<ExpenseEntry>; error?: string };
      if (!response.ok || !json.expense) throw new Error(json.error ?? copy.failed);
      setExpenses((previous) =>
        previous.map((entry) => (entry.id === id ? { ...entry, ...json.expense } as ExpenseEntry : entry))
      );
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : copy.failed);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="page">
      <div className="row">
        <Link href="/salaries">{copy.back}</Link>
      </div>

      <article className="card" id="salary-employee-profile">
        <h2>{copy.employee}</h2>
        <p className="kpi">{employee.fullName}</p>
        <div className="grid">
          <p className="note">{copy.personalNumber}: {employee.personalNumber}</p>
          <p className="note">Email: {employee.email || "-"}</p>
          <p className="note">{sv ? "Telefon" : "Phone"}: {employee.phone || "-"}</p>
          <p className="note">{copy.status}: {employee.status}</p>
        </div>
        <h3>{copy.taxSettings}</h3>
        <div className="grid">
          <p className="note">Tax table: {employee.taxTable || "-"}</p>
          <p className="note">{copy.taxRate}: {employee.preliminaryTaxRate.toFixed(4)}</p>
          <p className="note">{copy.employerRate}: {employee.employerContributionRate.toFixed(4)}</p>
          <p className="note">{copy.pensionRate}: {employee.pensionRate.toFixed(4)}</p>
        </div>
        <h3>{copy.bankDetails}</h3>
        <div className="grid">
          <p className="note">{sv ? "Kontoinnehavare" : "Account Name"}: {employee.bankAccountName || "-"}</p>
          <p className="note">{sv ? "Clearingnummer" : "Clearing Number"}: {employee.bankClearingNumber || "-"}</p>
          <p className="note">{sv ? "Kontonummer" : "Account Number"}: {employee.bankAccountNumber || "-"}</p>
          <p className="note">IBAN: {employee.iban || "-"}</p>
          <p className="note">BIC: {employee.bic || "-"}</p>
        </div>
      </article>

      <article className="card" id="salary-employee-totals">
        <h2>{copy.totals}</h2>
        <div className="grid">
          <div>
            <p className="label">{copy.salaryGrossTotal}</p>
            <p className="kpi">{formatMoney(salaryTotals.gross, "SEK", numberLocale)}</p>
          </div>
          <div>
            <p className="label">{copy.salaryNetTotal}</p>
            <p className="kpi">{formatMoney(salaryTotals.net, "SEK", numberLocale)}</p>
          </div>
          <div>
            <p className="label">{copy.salaryTaxTotal}</p>
            <p className="kpi">{formatMoney(salaryTotals.tax, "SEK", numberLocale)}</p>
          </div>
          <div>
            <p className="label">{copy.salaryPensionTotal}</p>
            <p className="kpi">{formatMoney(salaryTotals.pension, "SEK", numberLocale)}</p>
          </div>
          <div>
            <p className="label">{copy.salaryEmployerTotal}</p>
            <p className="kpi">{formatMoney(salaryTotals.employer, "SEK", numberLocale)}</p>
          </div>
          <div>
            <p className="label">{copy.expenseTotal}</p>
            <p className="kpi">{formatMoney(expenseTotals.total, "SEK", numberLocale)}</p>
          </div>
          <div>
            <p className="label">{copy.pendingExpense}</p>
            <p className="kpi">{formatMoney(expenseTotals.pending, "SEK", numberLocale)}</p>
          </div>
        </div>
      </article>

      <article className="card" id="salary-runs">
        <h2>{copy.salaryTitle}</h2>
        <form className="stack" onSubmit={submitSalary}>
          <div className="row">
            <label className="stack">
              {copy.date}
              <input
                type="date"
                required
                value={salaryForm.payrollDate}
                onChange={(event) => setSalaryForm((prev) => ({ ...prev, payrollDate: event.target.value }))}
              />
            </label>
            <label className="stack">
              {copy.periodFrom}
              <input
                type="date"
                value={salaryForm.periodFrom}
                onChange={(event) => setSalaryForm((prev) => ({ ...prev, periodFrom: event.target.value }))}
              />
            </label>
            <label className="stack">
              {copy.periodTo}
              <input
                type="date"
                value={salaryForm.periodTo}
                onChange={(event) => setSalaryForm((prev) => ({ ...prev, periodTo: event.target.value }))}
              />
            </label>
          </div>
          <div className="row">
            <label className="stack">
              {copy.grossSalary}
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={salaryForm.grossSalary}
                onChange={(event) => setSalaryForm((prev) => ({ ...prev, grossSalary: event.target.value }))}
              />
            </label>
            <label className="stack">
              {copy.bonus}
              <input
                type="number"
                min={0}
                step="0.01"
                value={salaryForm.bonusAmount}
                onChange={(event) => setSalaryForm((prev) => ({ ...prev, bonusAmount: event.target.value }))}
              />
            </label>
            <label className="stack">
              {copy.overtime}
              <input
                type="number"
                min={0}
                step="0.01"
                value={salaryForm.overtimeAmount}
                onChange={(event) => setSalaryForm((prev) => ({ ...prev, overtimeAmount: event.target.value }))}
              />
            </label>
            <label className="stack">
              {copy.benefits}
              <input
                type="number"
                min={0}
                step="0.01"
                value={salaryForm.benefitsAmount}
                onChange={(event) => setSalaryForm((prev) => ({ ...prev, benefitsAmount: event.target.value }))}
              />
            </label>
          </div>
          <div className="row">
            <label className="stack">
              {copy.taxRate}
              <input
                type="number"
                min={0}
                max={1}
                step="0.0001"
                value={salaryForm.preliminaryTaxRate}
                onChange={(event) =>
                  setSalaryForm((prev) => ({ ...prev, preliminaryTaxRate: event.target.value }))
                }
              />
            </label>
            <label className="stack">
              {copy.employerRate}
              <input
                type="number"
                min={0}
                max={1}
                step="0.0001"
                value={salaryForm.employerContributionRate}
                onChange={(event) =>
                  setSalaryForm((prev) => ({ ...prev, employerContributionRate: event.target.value }))
                }
              />
            </label>
            <label className="stack">
              {copy.pensionRate}
              <input
                type="number"
                min={0}
                max={1}
                step="0.0001"
                value={salaryForm.pensionRate}
                onChange={(event) => setSalaryForm((prev) => ({ ...prev, pensionRate: event.target.value }))}
              />
            </label>
          </div>
          <label className="stack">
            {copy.notes}
            <textarea
              value={salaryForm.notes}
              onChange={(event) => setSalaryForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </label>
          <div className="row">
            <button type="submit" disabled={busyKey === "create-salary"}>
              {busyKey === "create-salary" ? copy.saving : copy.addSalary}
            </button>
          </div>
        </form>

        <div className="tableWrap ledgerTableWrap">
          <table>
            <thead>
              <tr>
                <th>{copy.date}</th>
                <th>{copy.periodFrom}</th>
                <th>{copy.periodTo}</th>
                <th>{copy.grossSalary}</th>
                <th>{copy.salaryTaxTotal}</th>
                <th>{copy.salaryEmployerTotal}</th>
                <th>{copy.salaryPensionTotal}</th>
                <th>{copy.salaryNetTotal}</th>
                <th>{copy.status}</th>
                <th>{copy.actions}</th>
              </tr>
            </thead>
            <tbody>
              {salaryEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.payrollDate}</td>
                  <td>{entry.periodFrom || "-"}</td>
                  <td>{entry.periodTo || "-"}</td>
                  <td>{formatMoney(entry.taxableGross, "SEK", numberLocale)}</td>
                  <td>{formatMoney(entry.preliminaryTaxAmount, "SEK", numberLocale)}</td>
                  <td>{formatMoney(entry.employerContributionAmount, "SEK", numberLocale)}</td>
                  <td>{formatMoney(entry.pensionAmount, "SEK", numberLocale)}</td>
                  <td>{formatMoney(entry.netSalary, "SEK", numberLocale)}</td>
                  <td>{entry.status}</td>
                  <td>
                    <div className="row">
                      {entry.status === "DRAFT" && (
                        <button
                          type="button"
                          className="secondary"
                          disabled={busyKey === `approve-salary-${entry.id}`}
                          onClick={() => approveSalary(entry.id)}
                        >
                          {busyKey === `approve-salary-${entry.id}` ? copy.saving : copy.approve}
                        </button>
                      )}
                      {entry.status === "APPROVED" && (
                        <button
                          type="button"
                          className="secondary"
                          disabled={busyKey === `pay-salary-${entry.id}`}
                          onClick={() => paySalary(entry.id)}
                        >
                          {busyKey === `pay-salary-${entry.id}` ? copy.saving : copy.pay}
                        </button>
                      )}
                      {entry.status === "PAID" && <span className="badge good">{copy.paid}</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {salaryEntries.length === 0 && (
                <tr>
                  <td colSpan={10}>{copy.noneSalary}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card" id="salary-expenses">
        <h2>{copy.expenseTitle}</h2>
        <form className="stack" onSubmit={submitExpense}>
          <div className="row">
            <label className="stack">
              {copy.date}
              <input
                type="date"
                required
                value={expenseForm.expenseDate}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, expenseDate: event.target.value }))}
              />
            </label>
            <label className="stack">
              {copy.category}
              <input
                required
                value={expenseForm.category}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, category: event.target.value }))}
              />
            </label>
            <label className="stack">
              {copy.currency}
              <input
                required
                value={expenseForm.currency}
                maxLength={3}
                onChange={(event) =>
                  setExpenseForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
                }
              />
            </label>
          </div>
          <div className="row">
            <label className="stack">
              {copy.description}
              <input
                required
                value={expenseForm.description}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>
            <label className="stack">
              {copy.grossAmount}
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={expenseForm.grossAmount}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, grossAmount: event.target.value }))}
              />
            </label>
            <label className="stack">
              {copy.vatAmount}
              <input
                type="number"
                min={0}
                step="0.01"
                value={expenseForm.vatAmount}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, vatAmount: event.target.value }))}
              />
            </label>
            <label className="stack">
              {copy.receiptRef}
              <input
                value={expenseForm.receiptReference}
                onChange={(event) =>
                  setExpenseForm((prev) => ({ ...prev, receiptReference: event.target.value }))
                }
              />
            </label>
          </div>
          <label className="stack">
            {copy.notes}
            <textarea
              value={expenseForm.notes}
              onChange={(event) => setExpenseForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </label>
          <div className="row">
            <button type="submit" disabled={busyKey === "create-expense"}>
              {busyKey === "create-expense" ? copy.saving : copy.addExpense}
            </button>
          </div>
        </form>

        <div className="tableWrap ledgerTableWrap">
          <table>
            <thead>
              <tr>
                <th>{copy.date}</th>
                <th>{copy.category}</th>
                <th>{copy.description}</th>
                <th>{copy.grossAmount}</th>
                <th>{copy.vatAmount}</th>
                <th>{copy.netAmount}</th>
                <th>{copy.status}</th>
                <th>{copy.actions}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.expenseDate}</td>
                  <td>{entry.category}</td>
                  <td>{entry.description}</td>
                  <td>{formatMoney(entry.grossAmount, entry.currency, numberLocale)}</td>
                  <td>{formatMoney(entry.vatAmount, entry.currency, numberLocale)}</td>
                  <td>{formatMoney(entry.netAmount, entry.currency, numberLocale)}</td>
                  <td>{entry.status}</td>
                  <td>
                    <div className="row">
                      {entry.status === "PENDING" && (
                        <button
                          type="button"
                          className="secondary"
                          disabled={busyKey === `approve-expense-${entry.id}`}
                          onClick={() => approveExpense(entry.id)}
                        >
                          {busyKey === `approve-expense-${entry.id}` ? copy.saving : copy.approve}
                        </button>
                      )}
                      {entry.status === "APPROVED" && (
                        <button
                          type="button"
                          className="secondary"
                          disabled={busyKey === `pay-expense-${entry.id}`}
                          onClick={() => payExpense(entry.id)}
                        >
                          {busyKey === `pay-expense-${entry.id}` ? copy.saving : copy.pay}
                        </button>
                      )}
                      {entry.status === "PAID" && <span className="badge good">{copy.paid}</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={8}>{copy.noneExpense}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {error && <p className="error">{error}</p>}
    </section>
  );
};
