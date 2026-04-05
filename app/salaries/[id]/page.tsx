import Link from "next/link";

import { EmployeePayrollDetail } from "@/components/salaries/EmployeePayrollDetail";
import { asNumber } from "@/lib/accounting/math";
import { ensureBusiness } from "@/lib/data/business";
import { PAYROLL_PRISMA_NOT_READY, isPayrollPrismaReady, prisma } from "@/lib/db";
import { getRequestLocale } from "@/lib/i18n/locale";

type SalaryEmployeePageProps = {
  params: {
    id: string;
  };
};

export default async function SalaryEmployeePage({ params }: SalaryEmployeePageProps) {
  const employeeId = params.id;
  const locale = getRequestLocale();
  const sv = locale === "sv";

  if (!employeeId) {
    return (
      <section className="page">
        <p className="error">{sv ? "Saknar anställd-ID." : "Missing employee id."}</p>
        <Link href="/salaries">{sv ? "Tillbaka till löner" : "Back to salaries"}</Link>
      </section>
    );
  }

  if (!isPayrollPrismaReady()) {
    return (
      <section className="page">
        <p className="error">{sv ? `Lönemodulen är inte redo. ${PAYROLL_PRISMA_NOT_READY}` : PAYROLL_PRISMA_NOT_READY}</p>
        <Link href="/salaries">{sv ? "Tillbaka till löner" : "Back to salaries"}</Link>
      </section>
    );
  }

  const business = await ensureBusiness();
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      businessId: business.id
    },
    include: {
      salaryEntries: {
        orderBy: [{ payrollDate: "desc" }, { createdAt: "desc" }]
      },
      expenses: {
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }]
      }
    }
  });

  if (!employee) {
    return (
      <section className="page">
        <p className="error">{sv ? "Anställd hittades inte." : "Employee not found."}</p>
        <Link href="/salaries">{sv ? "Tillbaka till löner" : "Back to salaries"}</Link>
      </section>
    );
  }

  return (
    <EmployeePayrollDetail
      locale={locale}
      employee={{
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        fullName: `${employee.firstName} ${employee.lastName}`.trim(),
        email: employee.email,
        phone: employee.phone,
        personalNumber: employee.personalNumber,
        addressLine1: employee.addressLine1,
        addressLine2: employee.addressLine2,
        postalCode: employee.postalCode,
        city: employee.city,
        country: employee.country,
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
        salaryEntries: employee.salaryEntries.map((entry) => ({
          id: entry.id,
          payrollDate: entry.payrollDate.toISOString().slice(0, 10),
          periodFrom: entry.periodFrom?.toISOString().slice(0, 10) ?? null,
          periodTo: entry.periodTo?.toISOString().slice(0, 10) ?? null,
          grossSalary: asNumber(entry.grossSalary),
          bonusAmount: asNumber(entry.bonusAmount),
          overtimeAmount: asNumber(entry.overtimeAmount),
          benefitsAmount: asNumber(entry.benefitsAmount),
          taxableGross: asNumber(entry.taxableGross),
          preliminaryTaxRate: asNumber(entry.preliminaryTaxRate),
          preliminaryTaxAmount: asNumber(entry.preliminaryTaxAmount),
          employerContributionRate: asNumber(entry.employerContributionRate),
          employerContributionAmount: asNumber(entry.employerContributionAmount),
          pensionRate: asNumber(entry.pensionRate),
          pensionAmount: asNumber(entry.pensionAmount),
          netSalary: asNumber(entry.netSalary),
          status: entry.status,
          approvedAt: entry.approvedAt?.toISOString() ?? null,
          paidAt: entry.paidAt?.toISOString() ?? null,
          paymentReference: entry.paymentReference,
          notes: entry.notes,
          transactionId: entry.transactionId,
          createdAt: entry.createdAt.toISOString()
        })),
        expenses: employee.expenses.map((entry) => ({
          id: entry.id,
          expenseDate: entry.expenseDate.toISOString().slice(0, 10),
          category: entry.category,
          description: entry.description,
          grossAmount: asNumber(entry.grossAmount),
          vatAmount: asNumber(entry.vatAmount),
          netAmount: asNumber(entry.netAmount),
          currency: entry.currency,
          status: entry.status,
          approvedAt: entry.approvedAt?.toISOString() ?? null,
          paidAt: entry.paidAt?.toISOString() ?? null,
          receiptReference: entry.receiptReference,
          paymentReference: entry.paymentReference,
          notes: entry.notes,
          transactionId: entry.transactionId,
          createdAt: entry.createdAt.toISOString()
        }))
      }}
    />
  );
}
