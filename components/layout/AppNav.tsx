"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { type Locale } from "@/lib/i18n/locale";

const links = [
  // ── Main bookkeeping ──────────────────────────────────────────────────
  { href: "/", icon: "DB", group: "main", labels: { en: "Dashboard", sv: "Översikt" } },
  { href: "/receipts", icon: "RC", group: "main", labels: { en: "Receipts", sv: "Kvitton" } },
  { href: "/invoices", icon: "IV", group: "main", labels: { en: "Invoices", sv: "Fakturor" } },
  { href: "/imports", icon: "BC", group: "main", labels: { en: "Bank CSV", sv: "Bank-CSV" } },
  { href: "/transactions", icon: "TX", group: "main", labels: { en: "Transactions", sv: "Transaktioner" } },
  { href: "/salaries", icon: "SL", group: "main", labels: { en: "Salaries", sv: "Löner" } },
  { href: "/ledger", icon: "LG", group: "main", labels: { en: "Ledger", sv: "Huvudbok" } },
  { href: "/review", icon: "RV", group: "main", labels: { en: "Review", sv: "Granskning" } },
  // ── Swedish tax requirements ──────────────────────────────────────────
  { href: "/assets", icon: "FA", group: "tax", labels: { en: "Fixed Assets", sv: "Inventarier" } },
  { href: "/mileage", icon: "KJ", group: "tax", labels: { en: "Mileage Log", sv: "Körjournal" } },
  { href: "/periodiseringsfond", icon: "PF", group: "tax", labels: { en: "Tax Reserves", sv: "Periodiseringsfond" } },
  { href: "/compliance", icon: "CK", group: "tax", labels: { en: "Compliance", sv: "Kravlista" } },
  // ── Reports & settings ────────────────────────────────────────────────
  { href: "/reports", icon: "RP", group: "other", labels: { en: "Reports", sv: "Rapporter" } },
  { href: "/settings", icon: "ST", group: "other", labels: { en: "Settings", sv: "Inställningar" } }
] as const;

const copy = {
  en: {
    main: "Bookkeeping",
    tax: "Swedish Tax",
    other: "Other",
    language: "Language",
    english: "English",
    swedish: "Swedish"
  },
  sv: {
    main: "Bokföring",
    tax: "Skatteunderlag",
    other: "Övrigt",
    language: "Språk",
    english: "Engelska",
    swedish: "Svenska"
  }
} as const;

export const AppNav = ({ locale }: { locale: Locale }) => {
  const pathname = usePathname() || "/";
  const labels = copy[locale];

  const isActiveLink = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const groups: Array<{ key: "main" | "tax" | "other"; label: string }> = [
    { key: "main", label: labels.main },
    { key: "tax", label: labels.tax },
    { key: "other", label: labels.other }
  ];

  return (
    <aside className="sideNav">
      <div className="sideNavBrand">
        <div className="brandMark" aria-hidden>
          N
        </div>
        <div className="brandCopy">
          <p className="brandName">NorthLedger</p>
          <p className="brandTagline">Business Accounting</p>
        </div>
      </div>
      <div className="sideNavSections">
        {groups.map(({ key, label }) => (
          <div className="sideNavGroup" key={key}>
            <p className="sideNavSectionLabel">{label}</p>
            {links
              .filter((link) => link.group === key)
              .map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`sideNavLink${isActiveLink(link.href) ? " active" : ""}`}
                >
                  <span className="sideNavIcon" aria-hidden>
                    {link.icon}
                  </span>
                  <span className="sideNavLinkText">{link.labels[locale]}</span>
                </Link>
              ))}
          </div>
        ))}
      </div>
      <div className="sideNavFooter">
        <LanguageSwitcher
          locale={locale}
          label={labels.language}
          englishLabel={labels.english}
          swedishLabel={labels.swedish}
        />
      </div>
    </aside>
  );
};
