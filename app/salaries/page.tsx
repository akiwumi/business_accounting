import { SalariesManager } from "@/components/salaries/SalariesManager";
import { SectionExportBar } from "@/components/layout/SectionExportBar";
import { asNumber, round2 } from "@/lib/accounting/math";
import { ensureBusiness } from "@/lib/data/business";
import { PAYROLL_PRISMA_NOT_READY, isPayrollPrismaReady, prisma } from "@/lib/db";
import { getRequestLocale } from "@/lib/i18n/locale";

export default async function SalariesPage() {
  const locale = getRequestLocale();
  const sv = locale === "sv";
  const copy = {
    title: sv ? "Löner och personal" : "Salaries and Employees",
    subtitle: sv
      ? "Hantera anställda, lönekörningar, utlägg och godkännanden. Alla utbetalningar bokförs i huvudboken."
      : "Manage employees, salary runs, expenses and approvals. Approved payments are posted into the ledger.",
    prismaNotReady:
      locale === "sv"
        ? `Lönemodulen kräver att Prisma-klienten uppdateras. ${PAYROLL_PRISMA_NOT_READY}`
        : PAYROLL_PRISMA_NOT_READY
  };

  const business = await ensureBusiness();
  if (!isPayrollPrismaReady()) {
    return (
      <section className="page">
        <h1 className="title">{copy.title}</h1>
        <p className="subtitle">{copy.subtitle}</p>
        <article className="card">
          <p className="error">{copy.prismaNotReady}</p>
        </article>
      </section>
    );
  }

  const employees = await prisma.employee.findMany({
    where: { businessId: business.id },
    include: {
      salaryEntries: {
        select: {
          grossSalary: true,
          preliminaryTaxAmount: true,
          employerContributionAmount: true,
          pensionAmount: true,
          netSalary: true,
          status: true
        }
      },
      expenses: {
        select: {
          grossAmount: true,
          status: true
        }
      }
    },
    orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }]
  });

  const initialEmployees = employees.map((employee) => {
    const salaryTotals = employee.salaryEntries.reduce(
      (accumulator, entry) => {
        accumulator.gross += asNumber(entry.grossSalary);
        accumulator.tax += asNumber(entry.preliminaryTaxAmount);
        accumulator.employerContribution += asNumber(entry.employerContributionAmount);
        accumulator.pension += asNumber(entry.pensionAmount);
        accumulator.net += asNumber(entry.netSalary);
        if (entry.status === "PAID") accumulator.paidCount += 1;
        return accumulator;
      },
      { gross: 0, tax: 0, employerContribution: 0, pension: 0, net: 0, paidCount: 0 }
    );

    const expenseTotals = employee.expenses.reduce(
      (accumulator, entry) => {
        const gross = asNumber(entry.grossAmount);
        accumulator.claimed += gross;
        if (entry.status === "APPROVED" || entry.status === "PAID") {
          accumulator.approved += gross;
        }
        if (entry.status === "PAID") {
          accumulator.paid += gross;
        }
        return accumulator;
      },
      { claimed: 0, approved: 0, paid: 0 }
    );

    return {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      fullName: `${employee.firstName} ${employee.lastName}`.trim(),
      email: employee.email,
      phone: employee.phone,
      personalNumber: employee.personalNumber,
      taxTable: employee.taxTable,
      preliminaryTaxRate: asNumber(employee.preliminaryTaxRate),
      employerContributionRate: asNumber(employee.employerContributionRate),
      pensionRate: asNumber(employee.pensionRate),
      bankAccountName: employee.bankAccountName,
      bankClearingNumber: employee.bankClearingNumber,
      bankAccountNumber: employee.bankAccountNumber,
      iban: employee.iban,
      bic: employee.bic,
      status: employee.status,
      salaryTotals: {
        gross: round2(salaryTotals.gross),
        tax: round2(salaryTotals.tax),
        employerContribution: round2(salaryTotals.employerContribution),
        pension: round2(salaryTotals.pension),
        net: round2(salaryTotals.net),
        paidCount: salaryTotals.paidCount
      },
      expenseTotals: {
        claimed: round2(expenseTotals.claimed),
        approved: round2(expenseTotals.approved),
        paid: round2(expenseTotals.paid)
      },
      salaryCount: employee.salaryEntries.length,
      expenseCount: employee.expenses.length
    };
  });

  return (
    <section className="page">
      <h1 className="title">{copy.title}</h1>
      <p className="subtitle">{copy.subtitle}</p>
      <SectionExportBar locale={locale} section="salaries" />

      <article className="card" id="salary-management">
        <SalariesManager locale={locale} initialEmployees={initialEmployees} />
      </article>
    </section>
  );
}
