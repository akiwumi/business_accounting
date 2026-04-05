import { AccountTypes, type AccountType } from "@/lib/domain/enums";

export type AccountSeed = {
  code: string;
  name: string;
  type: AccountType;
  vatCode?: string;
  isSystem?: boolean;
};

export const swedishSoleTraderDefaultAccounts: AccountSeed[] = [
  // ── ASSETS ──────────────────────────────────────────────────────────────
  { code: "1460", name: "Lager (Inventory)", type: AccountTypes.ASSET },
  { code: "1510", name: "Kundfordringar (Accounts Receivable)", type: AccountTypes.ASSET },
  { code: "1630", name: "Skattekonto (Tax Account)", type: AccountTypes.ASSET },
  { code: "1910", name: "Kassa (Cash)", type: AccountTypes.ASSET, isSystem: true },
  { code: "1930", name: "Bankkonto (Business Bank Account)", type: AccountTypes.ASSET, isSystem: true },
  { code: "2641", name: "Ingående moms (Input VAT)", type: AccountTypes.ASSET, vatCode: "IN_STANDARD", isSystem: true },

  // ── EQUITY ──────────────────────────────────────────────────────────────
  { code: "2010", name: "Eget kapital (Owner Equity)", type: AccountTypes.EQUITY, isSystem: true },
  { code: "2013", name: "Årets resultat (Current Year Result)", type: AccountTypes.EQUITY },
  { code: "2085", name: "Expansionsfond", type: AccountTypes.EQUITY },

  // ── LIABILITIES ─────────────────────────────────────────────────────────
  { code: "2100", name: "Skulder till kreditinstitut (Bank Loans)", type: AccountTypes.LIABILITY },
  { code: "2140", name: "Periodiseringsfonder (Tax Allocation Reserve)", type: AccountTypes.LIABILITY },
  { code: "2440", name: "Leverantörsskulder (Accounts Payable)", type: AccountTypes.LIABILITY },
  { code: "2510", name: "Skatteskulder (Tax Liabilities)", type: AccountTypes.LIABILITY },
  { code: "2610", name: "Utgående moms 25% (Output VAT 25%)", type: AccountTypes.LIABILITY, vatCode: "OUT_25", isSystem: true },
  { code: "2620", name: "Utgående moms 12% (Output VAT 12%)", type: AccountTypes.LIABILITY, vatCode: "OUT_12" },
  { code: "2630", name: "Utgående moms 6% (Output VAT 6%)", type: AccountTypes.LIABILITY, vatCode: "OUT_06" },
  { code: "2650", name: "Redovisningskonto för moms (VAT Account)", type: AccountTypes.LIABILITY },
  { code: "2710", name: "Preliminär skatt (Preliminary Tax Payable)", type: AccountTypes.LIABILITY },
  { code: "2730", name: "Lagstadgade sociala avgifter (Social Contributions Payable)", type: AccountTypes.LIABILITY },

  // ── INCOME ──────────────────────────────────────────────────────────────
  { code: "3001", name: "Försäljning 25% moms (Sales 25% VAT)", type: AccountTypes.INCOME, vatCode: "OUT_25", isSystem: true },
  { code: "3041", name: "Försäljning 12% moms (Sales 12% VAT)", type: AccountTypes.INCOME, vatCode: "OUT_12", isSystem: true },
  { code: "3046", name: "Försäljning 6% moms (Sales 6% VAT)", type: AccountTypes.INCOME, vatCode: "OUT_06", isSystem: true },
  { code: "3051", name: "Försäljning utan moms (Sales 0% VAT)", type: AccountTypes.INCOME },
  { code: "3590", name: "Övriga intäkter (Other Revenue)", type: AccountTypes.INCOME },
  { code: "3740", name: "Erhållna rabatter (Discounts Received)", type: AccountTypes.INCOME },
  { code: "3910", name: "Erhållna bidrag (Subsidies / Grants Received)", type: AccountTypes.INCOME },
  { code: "3920", name: "Försäkringsersättningar (Insurance Compensation)", type: AccountTypes.INCOME },
  { code: "3973", name: "Vinst avyttring inventarier (Gain on Disposal of Assets)", type: AccountTypes.INCOME },
  { code: "3980", name: "Övriga rörelseintäkter (Other Operating Income)", type: AccountTypes.INCOME },
  { code: "8310", name: "Ränteintäkter bankkonton (Interest Income)", type: AccountTypes.INCOME },
  { code: "8390", name: "Övriga finansiella intäkter (Other Financial Income)", type: AccountTypes.INCOME },

  // ── COST OF GOODS / MATERIALS ───────────────────────────────────────────
  { code: "4000", name: "Varor och material (Cost of Goods / Materials)", type: AccountTypes.EXPENSE, isSystem: true },
  { code: "4010", name: "Inköp av handelsvaror (Purchase of Goods for Resale)", type: AccountTypes.EXPENSE },
  { code: "4990", name: "Förändring av lager (Inventory Change)", type: AccountTypes.EXPENSE },

  // ── PREMISES / LOCAL COSTS ──────────────────────────────────────────────
  { code: "5000", name: "Lokalhyra (Office / Premises Rent)", type: AccountTypes.EXPENSE },
  { code: "5010", name: "El och värme (Electricity and Heating)", type: AccountTypes.EXPENSE },
  { code: "5020", name: "Vatten och avlopp (Water and Sewage)", type: AccountTypes.EXPENSE },
  { code: "5060", name: "Städning och renhållning (Cleaning)", type: AccountTypes.EXPENSE },
  { code: "5090", name: "Övriga lokalkostnader (Other Premises Costs)", type: AccountTypes.EXPENSE },

  // ── EQUIPMENT / CONSUMABLES ─────────────────────────────────────────────
  { code: "5400", name: "Förbrukningsinventarier (Short-lived Equipment < 25 000 kr)", type: AccountTypes.EXPENSE },
  { code: "5410", name: "Förbrukningsmaterial (Consumables)", type: AccountTypes.EXPENSE, isSystem: true },
  { code: "5460", name: "Förpackningsmaterial (Packaging Material)", type: AccountTypes.EXPENSE },

  // ── VEHICLES ────────────────────────────────────────────────────────────
  { code: "5610", name: "Leasing av personbil (Car Lease)", type: AccountTypes.EXPENSE },
  { code: "5612", name: "Drivmedel (Fuel)", type: AccountTypes.EXPENSE },
  { code: "5615", name: "Vägavgifter, parkering (Tolls and Parking)", type: AccountTypes.EXPENSE },
  { code: "5620", name: "Bilförsäkring (Vehicle Insurance)", type: AccountTypes.EXPENSE },
  { code: "5630", name: "Bilskatt (Vehicle Tax)", type: AccountTypes.EXPENSE },
  { code: "5650", name: "Reparation och underhåll bil (Vehicle Repair/Maintenance)", type: AccountTypes.EXPENSE },
  { code: "5690", name: "Övriga fordonsutgifter (Other Vehicle Costs)", type: AccountTypes.EXPENSE },
  { code: "5800", name: "Resekostnader (Travel Costs - Other)", type: AccountTypes.EXPENSE },
  { code: "5810", name: "Körjournal – milersättning (Mileage Deduction - Körjournal)", type: AccountTypes.EXPENSE },
  { code: "5830", name: "Hotell och logi (Accommodation)", type: AccountTypes.EXPENSE },

  // ── ADVERTISING / MARKETING ─────────────────────────────────────────────
  { code: "6000", name: "Hyra av inventarier och maskiner (Equipment Rental / Leasing)", type: AccountTypes.EXPENSE },
  { code: "6100", name: "Marknadsföring (Marketing)", type: AccountTypes.EXPENSE },
  { code: "6110", name: "Kontorsmaterial (Office Supplies)", type: AccountTypes.EXPENSE, isSystem: true },
  { code: "6150", name: "Trycksaker och profilmaterial (Print and Branded Materials)", type: AccountTypes.EXPENSE },
  { code: "6210", name: "Telefon (Phone)", type: AccountTypes.EXPENSE },
  { code: "6212", name: "Mobiltelefon (Mobile Phone)", type: AccountTypes.EXPENSE },
  { code: "6230", name: "Datorkommunikation och internet (Internet / Data)", type: AccountTypes.EXPENSE },
  { code: "6250", name: "Postbefordran (Postage)", type: AccountTypes.EXPENSE },
  { code: "6310", name: "Företagsförsäkringar (Business Insurance)", type: AccountTypes.EXPENSE },
  { code: "6350", name: "Föreningsavgifter (Membership Fees)", type: AccountTypes.EXPENSE },
  { code: "6420", name: "Representation (Entertainment / Representation)", type: AccountTypes.EXPENSE },
  { code: "6490", name: "Övrig representation (Other Representation)", type: AccountTypes.EXPENSE },
  { code: "6530", name: "Redovisningskonsult (Accounting Services)", type: AccountTypes.EXPENSE, isSystem: true },
  { code: "6540", name: "IT-tjänster och programvara (IT Services and Software)", type: AccountTypes.EXPENSE },
  { code: "6550", name: "Juridiska kostnader (Legal Fees)", type: AccountTypes.EXPENSE },
  { code: "6560", name: "Utbildning och kurser (Training and Education)", type: AccountTypes.EXPENSE },
  { code: "6570", name: "Bankavgifter (Bank Fees)", type: AccountTypes.EXPENSE, isSystem: true },
  { code: "6900", name: "Övriga externa kostnader (Other External Costs)", type: AccountTypes.EXPENSE },

  // ── PERSONNEL COSTS ─────────────────────────────────────────────────────
  { code: "7010", name: "Löner till tjänstemän (Employee Salaries)", type: AccountTypes.EXPENSE },
  { code: "7090", name: "Förändring semesterlöneskuld (Holiday Pay Accrual Change)", type: AccountTypes.EXPENSE },
  { code: "7210", name: "Löner till kollektivanställda (Wages - Hourly Workers)", type: AccountTypes.EXPENSE },
  { code: "7300", name: "Pensionsförsäkringspremier (Pension Insurance Premiums)", type: AccountTypes.EXPENSE },
  { code: "7380", name: "Tjänstegrupplivförsäkring TGL (Group Life Insurance)", type: AccountTypes.EXPENSE },
  { code: "7399", name: "Övriga pensionskostnader (Other Pension Costs)", type: AccountTypes.EXPENSE },
  { code: "7410", name: "Lagstadgade sociala avgifter / Arbetsgivaravgifter (Employer Social Contributions)", type: AccountTypes.EXPENSE },
  { code: "7510", name: "Hälsovård och sjukvård (Healthcare Costs)", type: AccountTypes.EXPENSE },
  { code: "7570", name: "Egenavgifter (Self-Employment Social Contributions)", type: AccountTypes.EXPENSE },
  { code: "7650", name: "Personalrepresentation (Staff Entertainment)", type: AccountTypes.EXPENSE },
  { code: "7690", name: "Övriga personalkostnader (Other Personnel Costs)", type: AccountTypes.EXPENSE },

  // ── DEPRECIATION ────────────────────────────────────────────────────────
  { code: "7810", name: "Avskrivningar immateriella anläggningstillgångar (Amortisation - Intangibles)", type: AccountTypes.EXPENSE },
  { code: "7832", name: "Avskrivningar inventarier (Depreciation - Equipment)", type: AccountTypes.EXPENSE },
  { code: "7834", name: "Avskrivningar personbilar (Depreciation - Vehicles)", type: AccountTypes.EXPENSE },
  { code: "7840", name: "Avskrivningar byggnader (Depreciation - Buildings)", type: AccountTypes.EXPENSE },
  { code: "7970", name: "Förlust avyttring inventarier (Loss on Disposal of Assets)", type: AccountTypes.EXPENSE },

  // ── FINANCIAL COSTS ─────────────────────────────────────────────────────
  { code: "8400", name: "Räntekostnader (Interest Expense)", type: AccountTypes.EXPENSE },
  { code: "8410", name: "Räntekostnader för skulder till kreditinstitut (Bank Interest)", type: AccountTypes.EXPENSE },
  { code: "8490", name: "Övriga finansiella kostnader (Other Financial Costs)", type: AccountTypes.EXPENSE }
];
