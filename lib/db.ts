import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export const PAYROLL_PRISMA_NOT_READY =
  "Payroll models are not available in the current Prisma client. Run `npm run prisma:generate && npm run db:push`, then restart the dev server.";

export const isPayrollPrismaReady = () => {
  const client = prisma as PrismaClient & {
    employee?: unknown;
    salaryEntry?: unknown;
    employeeExpense?: unknown;
  };
  return Boolean(client.employee && client.salaryEntry && client.employeeExpense);
};
