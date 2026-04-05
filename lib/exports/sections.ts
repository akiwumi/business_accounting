export const exportSections = [
  "dashboard",
  "receipts",
  "invoices",
  "imports",
  "transactions",
  "salaries",
  "ledger",
  "review",
  "reports",
  "settings"
] as const;

export type ExportSection = (typeof exportSections)[number];

export const isExportSection = (value: string): value is ExportSection =>
  (exportSections as readonly string[]).includes(value);
