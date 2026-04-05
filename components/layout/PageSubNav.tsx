"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { type Locale } from "@/lib/i18n/locale";

type LocalizedText = { en: string; sv: string };

type SubNavTab = {
  href: string;
  label: LocalizedText;
};

type SubNavConfig = {
  isMatch: (pathname: string) => boolean;
  title: LocalizedText;
  tabs: readonly SubNavTab[];
};

const tabs = {
  dashboard: [
    { href: "/#summary-kpis", label: { en: "Summary", sv: "Sammanfattning" } },
    { href: "/#activity-summary", label: { en: "Activity", sv: "Aktivitet" } },
    { href: "/#workflow", label: { en: "Workflow", sv: "Arbetsflöde" } }
  ],
  receipts: [
    { href: "/receipts#upload", label: { en: "Upload", sv: "Uppladdning" } },
    { href: "/receipts#manual-entry", label: { en: "Manual Entry", sv: "Manuell inmatning" } },
    { href: "/receipts#receipt-filters", label: { en: "Filters", sv: "Filter" } },
    { href: "/receipts#recent-receipts", label: { en: "Recent Receipts", sv: "Senaste kvitton" } }
  ],
  invoices: [
    { href: "/invoices#new-invoice", label: { en: "Builder", sv: "Byggare" } },
    { href: "/invoices#invoice-filters", label: { en: "Filters", sv: "Filter" } },
    { href: "/invoices#invoice-list", label: { en: "Invoice List", sv: "Fakturalista" } }
  ],
  imports: [
    { href: "/imports#import-upload", label: { en: "Import CSV", sv: "Importera CSV" } },
    { href: "/imports#import-history", label: { en: "Import History", sv: "Importhistorik" } }
  ],
  transactions: [
    { href: "/transactions#add-payment", label: { en: "Add Payment", sv: "Lägg till betalning" } },
    { href: "/transactions#transaction-list", label: { en: "Transactions", sv: "Transaktioner" } }
  ],
  salaries: [
    { href: "/salaries#salary-management", label: { en: "Management", sv: "Hantering" } },
    { href: "/salaries#salary-overview", label: { en: "Totals", sv: "Totaler" } },
    { href: "/salaries#salary-employees-list", label: { en: "Employees", sv: "Anställda" } }
  ],
  salaryEmployee: [
    { href: "/salaries#salary-management", label: { en: "All Employees", sv: "Alla anställda" } },
    { href: "#salary-runs", label: { en: "Salary Runs", sv: "Lönekörningar" } },
    { href: "#salary-expenses", label: { en: "Expenses", sv: "Utlägg" } }
  ],
  ledger: [
    { href: "/ledger#ledger-filters", label: { en: "Filters", sv: "Filter" } },
    { href: "/ledger#ledger-entries", label: { en: "Entries", sv: "Poster" } }
  ],
  review: [
    { href: "/review#needs-review", label: { en: "Needs Review", sv: "Kräver granskning" } },
    { href: "/review#recent-receipts", label: { en: "Receipts", sv: "Kvitton" } },
    { href: "/review#other-inputs", label: { en: "Other Inputs", sv: "Övriga underlag" } }
  ],
  reports: [
    { href: "/reports#report-runner", label: { en: "Run Reports", sv: "Kör rapporter" } },
    { href: "/reports#report-export", label: { en: "Export", sv: "Export" } }
  ],
  settings: [
    { href: "/settings#business-settings", label: { en: "Business", sv: "Företag" } },
    { href: "/settings#tax-config", label: { en: "Tax Config", sv: "Skatteinställningar" } }
  ]
} as const;

const sections: SubNavConfig[] = [
  {
    isMatch: (pathname) => pathname.startsWith("/review/receipts/"),
    title: { en: "Receipt Review", sv: "Kvitto-granskning" },
    tabs: [
      { href: "/review#needs-review", label: { en: "Review Queue", sv: "Granskningskö" } },
      { href: "/review#recent-receipts", label: { en: "Recent Receipts", sv: "Senaste kvitton" } }
    ]
  },
  {
    isMatch: (pathname) => pathname.startsWith("/review/transactions/"),
    title: { en: "Entry Review", sv: "Post-granskning" },
    tabs: [
      { href: "/review#other-inputs", label: { en: "Review Queue", sv: "Granskningskö" } },
      { href: "/ledger#ledger-entries", label: { en: "Ledger", sv: "Huvudbok" } }
    ]
  },
  { isMatch: (pathname) => pathname === "/", title: { en: "Dashboard", sv: "Översikt" }, tabs: tabs.dashboard },
  { isMatch: (pathname) => pathname.startsWith("/receipts"), title: { en: "Receipts", sv: "Kvitton" }, tabs: tabs.receipts },
  { isMatch: (pathname) => pathname.startsWith("/invoices"), title: { en: "Invoices", sv: "Fakturor" }, tabs: tabs.invoices },
  { isMatch: (pathname) => pathname.startsWith("/imports"), title: { en: "Bank CSV", sv: "Bank-CSV" }, tabs: tabs.imports },
  {
    isMatch: (pathname) => pathname.startsWith("/transactions"),
    title: { en: "Transactions", sv: "Transaktioner" },
    tabs: tabs.transactions
  },
  {
    isMatch: (pathname) => pathname.startsWith("/salaries/"),
    title: { en: "Employee Payroll", sv: "Löneprofil" },
    tabs: tabs.salaryEmployee
  },
  { isMatch: (pathname) => pathname.startsWith("/salaries"), title: { en: "Salaries", sv: "Löner" }, tabs: tabs.salaries },
  { isMatch: (pathname) => pathname.startsWith("/ledger"), title: { en: "Ledger", sv: "Huvudbok" }, tabs: tabs.ledger },
  { isMatch: (pathname) => pathname.startsWith("/review"), title: { en: "Review", sv: "Granskning" }, tabs: tabs.review },
  { isMatch: (pathname) => pathname.startsWith("/reports"), title: { en: "Reports", sv: "Rapporter" }, tabs: tabs.reports },
  { isMatch: (pathname) => pathname.startsWith("/settings"), title: { en: "Settings", sv: "Inställningar" }, tabs: tabs.settings }
];

const getHrefParts = (href: string) => {
  const [path, hash] = href.split("#");
  return { path, hash: hash ? `#${hash}` : "" };
};

export const PageSubNav = ({ locale }: { locale: Locale }) => {
  const pathname = usePathname() || "/";
  const [hash, setHash] = useState("");

  useEffect(() => {
    const readHash = () => setHash(window.location.hash || "");
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, [pathname]);

  const currentSection = useMemo(() => {
    return sections.find((section) => section.isMatch(pathname)) ?? sections[0];
  }, [pathname]);

  const isTabActive = (href: string, index: number) => {
    const { path, hash: targetHash } = getHrefParts(href);
    const pathMatch =
      path === "/" ? pathname === "/" : pathname === path || (path !== "/" && pathname.startsWith(`${path}/`));
    if (!pathMatch) return false;
    if (targetHash) return hash === targetHash || (hash === "" && index === 0);
    return true;
  };

  return (
    <header className="subNav">
      <div className="subNavMeta">
        <p className="subNavTitle">{currentSection.title[locale]}</p>
      </div>
      <nav className="subNavTabs" aria-label="Page section navigation">
        {currentSection.tabs.map((tab, index) => (
          <Link key={tab.href} href={tab.href} className={`subNavTab${isTabActive(tab.href, index) ? " active" : ""}`}>
            {tab.label[locale]}
          </Link>
        ))}
      </nav>
    </header>
  );
};
