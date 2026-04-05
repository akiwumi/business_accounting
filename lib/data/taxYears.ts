import { prisma } from "@/lib/db";
import {
  getFiscalYearForDate,
  getLatestClosedTaxYear as getLatestClosedFiscalTaxYear,
  normalizeFiscalYearStartMonth
} from "@/lib/data/period";

export const getLatestClosedTaxYear = (fiscalYearStartMonth = 1) =>
  getLatestClosedFiscalTaxYear(normalizeFiscalYearStartMonth(fiscalYearStartMonth));

const minDate = (dates: Array<Date | null>) =>
  dates.reduce<Date | null>((earliest, date) => {
    if (!date) return earliest;
    if (!earliest) return date;
    return date < earliest ? date : earliest;
  }, null);

export const getClosedTaxYearsForBusiness = async (
  businessId: string,
  fiscalYearStartMonth = 1
): Promise<number[]> => {
  const normalizedStartMonth = normalizeFiscalYearStartMonth(fiscalYearStartMonth);
  const latestClosed = getLatestClosedTaxYear(normalizedStartMonth);
  if (latestClosed < 1970) return [];

  const [txnAgg, receiptAgg, invoiceAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { businessId },
      _min: { txnDate: true }
    }),
    prisma.receipt.aggregate({
      where: { businessId },
      _min: { receiptDate: true, createdAt: true }
    }),
    prisma.invoice.aggregate({
      where: { businessId },
      _min: { issueDate: true }
    })
  ]);

  const earliest = minDate([
    txnAgg._min.txnDate,
    receiptAgg._min.receiptDate,
    receiptAgg._min.createdAt,
    invoiceAgg._min.issueDate
  ]);

  const earliestYear = earliest ? getFiscalYearForDate(earliest, normalizedStartMonth) : latestClosed;
  const startYear = Math.min(earliestYear, latestClosed);
  const years: number[] = [];

  for (let year = latestClosed; year >= startYear; year -= 1) {
    years.push(year);
  }

  return years.length > 0 ? years : [latestClosed];
};
