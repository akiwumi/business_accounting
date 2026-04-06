# Akunta SaaS Phased Build Implementation Plan

Date: 2026-04-06  
Product: Akunta (Accounting SaaS for Sweden first, EU/UK expansion)

## 1) Product Decisions Locked

1. Delivery model is pure SaaS (cloud-only data and files).
2. No local client storage as source of truth.
3. Design and UX are mobile-first and optimized for small screens.
4. Hosting frontend on Vercel.
5. Database route is PostgreSQL, using Supabase managed Postgres.

## 2) Recommended Production Stack

1. Frontend and API routes: Next.js 14 (App Router) + TypeScript on Vercel.
2. Database, auth, and storage: Supabase in Stockholm region (`eu-north-1`).
3. ORM and migrations: Prisma.
4. Billing and license enforcement: Stripe Billing + webhooks.
5. Email delivery: Resend.
6. Background jobs (OCR/import/export): Upstash Redis + QStash (or equivalent queue runner).
7. Monitoring and alerting: Sentry + Vercel Observability.
8. File processing:
   1. Upload to Supabase Storage.
   2. Async OCR/extraction via queue.
   3. Review and approval workflow before posting entries.

## 3) Environment and Project Topology

1. Supabase projects:
   1. `akunta-dev`
   2. `akunta-staging`
   3. `akunta-prod`
2. Vercel environments:
   1. Development
   2. Preview
   3. Production
3. Mapping rule:
   1. Each Vercel env connects only to matching Supabase project.
   2. Never share production DB with preview builds.

## 4) Exact Environment Variables

Use these names exactly.

```bash
# App
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.akunta.com
SESSION_SECRET=change-this-very-long-random-string
CRON_SECRET=change-this-very-long-random-string

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Prisma / PostgreSQL
# Runtime pooled connection for serverless
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
# Direct connection for migrations
DIRECT_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres

# Stripe
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=Akunta <billing@akunta.com>
EMAIL_REPLY_TO=support@akunta.com

# OCR / AI
OPENAI_API_KEY=sk-...
OPENAI_RECEIPT_MODEL=gpt-4.1-mini

# Queue and jobs
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
QSTASH_TOKEN=...
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...

# Observability
SENTRY_DSN=https://...
NEXT_PUBLIC_SENTRY_DSN=https://...

# Localization / Translation
NEXT_PUBLIC_ENABLE_LOCALE_AUTODETECT=true
NEXT_PUBLIC_TRANSLATION_MODE=browser
SUPPORTED_APP_LOCALES=en-GB,sv-SE,de-DE,fr-FR,es-ES,it-IT,nl-NL,pl-PL,pt-PT,da-DK,fi-FI,no-NO
DEEPL_API_KEY=optional-for-dynamic-content
DEEPL_API_URL=https://api-free.deepl.com/v2

# Public site / support
NEXT_PUBLIC_SITE_URL=https://akunta.com
SUPPORT_CONTACT_EMAIL=support@akunta.com
SUPPORT_FORM_RECIPIENT=support@akunta.com
RESOURCES_DEFAULT_COUNTRY=SE
```

## 5) Target Repository Structure

```text
app/
  (auth)/login/page.tsx
  (app)/layout.tsx
  (app)/page.tsx
  (app)/receipts/page.tsx
  (app)/invoices/page.tsx
  (app)/ledger/page.tsx
  api/
    webhooks/stripe/route.ts
    receipts/upload/route.ts
    receipts/process/route.ts
    exports/accounts/route.ts

components/
  ui/
  layout/
  receipts/
  invoices/
  ledger/
  mobile/

lib/
  db/prisma.ts
  supabase/browser.ts
  supabase/server.ts
  supabase/admin.ts
  auth/
  billing/
  jobs/
  accounting/
  exports/
  security/

prisma/
  schema.prisma
  migrations/

scripts/
  seed.ts
  backfill-*.ts

tests/
  e2e/
  integration/

docs/
  architecture.md
  runbooks.md
  compliance.md
```

## 6) Data Model Baseline (Multi-Tenant First)

1. Every business table includes `organization_id`.
2. Core tables:
   1. `organizations`
   2. `organization_members`
   3. `profiles`
   4. `customers`
   5. `receipts`
   6. `invoices`
   7. `invoice_items`
   8. `transactions`
   9. `ledger_entries`
   10. `vat_periods`
   11. `tax_years`
   12. `exports`
   13. `audit_logs`
3. Financial fields use exact numeric types.
4. Add immutable audit logs for create, update, delete, approve, and mark-paid actions.

## 7) Security and Compliance Baseline

1. Enable RLS on all tenant tables.
2. Enforce tenant scoping in all server queries.
3. Keep all secrets server-only.
4. Enable PITR and test restore procedures.
5. Encrypt storage objects at rest.
6. Add rate limiting for auth and upload endpoints.
7. Apply GDPR controls:
   1. Privacy policy.
   2. DPA with providers.
   3. Data retention policy.
   4. Export and deletion workflows.
8. Keep bookkeeping and tax documentation retention aligned with Swedish rules.

## 8) Phased Delivery Roadmap

## Phase 0: Platform Foundation
Duration: Week 1  
Outcome: Stable production topology.

1. Provision Supabase dev/staging/prod.
2. Configure Vercel env mappings.
3. Wire env vars and secret management.
4. Create base migration strategy and deploy runbook.

## Phase 1: Auth and Multi-Tenancy
Duration: Week 2  
Outcome: Secure tenant isolation.

1. Integrate Supabase Auth.
2. Create org and membership model.
3. Enforce tenant-scoped access and policies.
4. Add route protection across app and API.

## Phase 2: Core Accounting Domain
Duration: Weeks 3-4  
Outcome: Reliable bookkeeping core.

1. Finalize receipts, invoices, transactions, ledger schemas.
2. Implement posting rules for incoming and outgoing flows.
3. Add VAT and tax-year context fields.
4. Build review and approval checkpoints.

## Phase 3: File Ingestion and OCR Pipeline
Duration: Week 5  
Outcome: Scalable receipt ingestion.

1. Upload to Supabase Storage.
2. Queue OCR/extraction jobs asynchronously.
3. Save parsed fields with confidence indicators.
4. Push low-confidence items to review queue.

## Phase 4: Invoicing and Ledger Automation
Duration: Week 6  
Outcome: End-to-end invoice lifecycle.

1. Invoice creation and numbering patterns.
2. Paid/unpaid workflow and reminders.
3. Auto-posting to ledger on status transitions.
4. Customer search and filtering by period.

## Phase 5: Reporting and Exports
Duration: Week 7  
Outcome: Tax-ready outputs.

1. P&L and VAT reports.
2. Annual account export.
3. PDF and Excel exports with totals.
4. Historical year filtering and period controls.

## Phase 6: Billing and License Enforcement
Duration: Week 8  
Outcome: Monetization and entitlement checks.

1. Stripe checkout and customer portal.
2. Webhook-driven subscription state sync.
3. Plan gating and usage checks.
4. Downgrade and grace period logic.

## Phase 7: Mobile-First UX Optimization
Duration: Weeks 9-10  
Outcome: Production-grade small-screen usability.

1. Single-column default layouts.
2. Bottom tab navigation on small screens.
3. Convert wide tables into card lists with drill-down.
4. Add sticky primary actions and touch-safe controls.
5. Optimize camera-first receipt upload and mobile performance.

## Phase 8: Hardening and Launch
Duration: Weeks 11-12  
Outcome: Launch-ready SaaS.

1. Full Sentry and alert routing.
2. Security and load testing.
3. Backup and disaster recovery drills.
4. Go-live checklist and incident runbooks.

## 9) Week 1 Detailed Execution Plan (Phase 0 + Phase 1 Start)

## Day 1: Platform Setup

1. Create Supabase projects in Stockholm region.
2. Create Vercel project and configure environments.
3. Add all required env vars.
4. Validate app boot with dev environment only.

## Day 2: Prisma and Database Foundation

1. Configure pooled `DATABASE_URL` and migration `DIRECT_URL`.
2. Create baseline migration.
3. Add seed script with minimal dev data.
4. Document migration workflow for team use.

## Day 3: Auth Integration

1. Implement Supabase Auth login and logout.
2. Protect app routes and sensitive API routes.
3. Confirm session lifecycle behavior.
4. Add auth failure handling and UX states.

## Day 4: Multi-Tenant Core

1. Add `organizations`, `organization_members`, and `profiles`.
2. Link user-to-organization relationships.
3. Add `organization_id` to core domain tables.
4. Enforce org checks in server code.

## Day 5: RLS

1. Enable RLS for tenant tables.
2. Add policies for membership-based access.
3. Verify cross-tenant isolation with test accounts.
4. Restrict service role usage to backend-only paths.

## Day 6: Billing Skeleton

1. Create Stripe products and prices.
2. Implement webhook endpoint with signature verification.
3. Add subscriptions table linked to organizations.
4. Gate one premium feature by subscription state.

## Day 7: Hardening and Verification

1. Add Sentry instrumentation.
2. Add request validation on all write APIs.
3. Add rate limiting on login, upload, and webhooks.
4. Run smoke tests for auth, tenancy, billing, and migration rollback.

## 10) Definition of Done Per Phase

1. Platform is done when dev/staging/prod are isolated and reproducible.
2. Auth and tenancy are done when RLS and server checks prevent cross-tenant data access.
3. Core accounting is done when every receipt/invoice state change is traceable in ledger.
4. OCR pipeline is done when uploads are asynchronous, observable, and reviewable.
5. Reporting is done when outputs match ledger and can be exported reliably.
6. Billing is done when subscription state controls access without manual intervention.
7. Mobile optimization is done when all key flows are smooth on 360px width.
8. Launch hardening is done when runbooks, alerts, and recovery tests are complete.

## 11) Risks and Mitigations

1. Risk: Cross-tenant data leaks.  
Mitigation: Strict RLS + server-side tenant assertions + tests.
2. Risk: OCR quality variance.  
Mitigation: Confidence thresholds and mandatory review flow.
3. Risk: Webhook failures causing entitlement mismatch.  
Mitigation: Idempotency keys + retries + dead-letter handling.
4. Risk: Mobile UX degradation from desktop table designs.  
Mitigation: Card-based mobile views and responsive-first component specs.
5. Risk: Billing disputes and fraud.  
Mitigation: Audit logs, clear refund policy, webhook verification, and access grace windows.

## 12) Launch Readiness Checklist

1. RLS enabled and tested.
2. PITR configured and restore tested.
3. Webhooks verified in production.
4. Alerts configured for 5xx, job failures, and billing sync failures.
5. Privacy, terms, and support flows published.
6. On-call and incident runbooks completed.
7. Initial customer onboarding and help docs published.

## 13) Immediate Next Actions

1. Create `docs/` folder and split this plan into:
   1. `docs/architecture.md`
   2. `docs/runbooks.md`
   3. `docs/compliance.md`
2. Start Phase 0 Day 1 tasks in Supabase and Vercel.
3. Schedule weekly checkpoint review against this plan.

## 14) Current App Feature Baseline (Already Implemented)

This section is the as-built feature inventory from the current codebase and must be treated as baseline scope to preserve during SaaS migration.

## 14.1) Shell, Navigation, Branding, and Auth UX

1. Branded app identity: Akunta title, logo usage, and favicon.
2. Sidebar column navigation with grouped sections:
   1. Main bookkeeping
   2. Swedish tax modules
   3. Other sections (reports/settings)
3. Page-level top sub-navigation that changes tabs by current page context.
4. Language switcher in nav with English and Swedish support, wired to locale API and refresh flow.
5. Login experience with:
   1. Splash screen
   2. Animated logo entry
   3. Click-to-open login form
   4. Fade transitions into app routes
6. Session login/logout API routes and route-level authenticated shell behavior.

## 14.2) Dashboard and Historical Year Controls

1. Closed tax-year selector based on configurable fiscal year start month.
2. KPI cards for:
   1. Revenue
   2. Expenses
   3. Operating profit
   4. Estimated VAT payable
   5. Running output VAT
   6. Running input VAT
3. Activity counters:
   1. Transactions posted
   2. Receipts stored
4. Historical annual books workflow messaging.
5. Dashboard-level "Export Full Accounts (Excel)" action.

## 14.3) Receipts Capture, OCR, and Review Workflow

1. Receipt upload flow for:
   1. JPEG/PNG/photo images
   2. PDF files
   3. Email-forwarded attachments via webhook route
2. OCR/extraction pipeline with:
   1. Local image OCR path
   2. PDF text extraction and image fallback
   3. Optional vision extraction via OpenAI model (`OPENAI_RECEIPT_MODEL`)
   4. Merged extraction strategy + fallback from filename
3. Extracted/managed receipt fields include:
   1. Vendor
   2. Receipt number
   3. Issue date / receipt date
   4. Gross, net, VAT amount
   5. VAT rate
   6. Currency
   7. Category
   8. Description / item purchased
   9. Confidence
   10. Needs-review flag
4. Automatic financial derivation logic:
   1. Net/VAT derivation from gross + VAT rate where needed
   2. VAT rate inference from extracted values where needed
5. Automatic currency conversion to SEK at receipt issue date with stored FX metadata:
   1. `sourceCurrency`
   2. `fxRateToSek`
   3. `fxRateDate`
6. Manual receipt entry form with category, VAT rate, and currency handling.
7. Receipts page filtering and views:
   1. Year and month filters
   2. Search by number/vendor/filename
   3. Recent vs all stored receipts toggle
8. Receipts table operations:
   1. Select row
   2. Select all
   3. Bulk delete
   4. Single delete
   5. Direct review link per row
9. Review detail page for each receipt with editable details and linked transactions list.
10. Receipt review edit form supports full field editing and auto-calculates net/VAT from gross + VAT rate.
11. Review actions support toggling needs-review status.

## 14.4) Invoicing, Customers, and Revenue Posting

1. Invoice builder UI with guided sections:
   1. Sender details
   2. Client details
   3. Invoice details
   4. Payment details
   5. Notes
   6. Signature/logo
   7. Email details
2. Customer profile data store with in-form search/suggestions and save profile action.
3. Invoice number management:
   1. Pattern-driven suggestion from business settings
   2. Sequence-based generation
   3. Manual override support
4. Invoice line items with units, price, VAT mode (`No VAT`, `Incl. VAT`, `Excl. VAT`), VAT rate.
5. Live invoice preview layout modeled on provided design references.
6. Logo and signature image support for invoice output.
7. Save invoice flow + generated invoice list.
8. Invoice PDF generation endpoint and download actions.
9. Invoice email send endpoint and UI actions.
10. Mark-as-paid workflow:
    1. Payment date capture
    2. Paid status update
    3. Link to posted transaction
11. Invoice list search and filtering by:
    1. Year
    2. Month
    3. Query (number/customer/project)
12. Invoice status visibility:
    1. Paid / unpaid
    2. Paid date
    3. Sent date

## 14.5) Transactions, Ledger, and Accounting Integrity

1. Payment received entry form for incoming revenue.
2. Transactions page with journal line rendering and review links.
3. Ledger page with filters:
   1. Closed tax year
   2. Custom date range
   3. Source filter
4. Ledger columns include:
   1. Item purchased
   2. Description
   3. Vendor
   4. Direction
   5. Gross/net/VAT
   6. Source
   7. Reference
   8. Journal
   9. Input/review link
5. Ledger row operations:
   1. Select row
   2. Select all
   3. Bulk delete
   4. Single delete
6. Running ledger totals displayed in UI:
   1. Total gross
   2. Total net
   3. Total VAT
7. Transaction review page supports:
   1. Editing transaction description/date/reference
   2. Journal line inspection
   3. Linked bank import rows inspection
8. Receipt entries are treated as outgoing expense flows; invoice-paid entries are treated as incoming revenue flows.

## 14.6) Imports, Reporting, and Exports

1. Manual bank CSV import flow.
2. Import history with imported/accepted/rejected counts.
3. Financial reports runner with:
   1. Profit and loss
   2. Balance sheet
   3. VAT report
   4. Tax estimate
   5. NE-bilaga draft
4. Section-level export bar (Excel and PDF) across core pages.
5. Ledger exports include:
   1. Ledger entries table
   2. Ledger gross/net/VAT totals
   3. Profit and loss summary rows
6. Full accounts export workbook includes broad cross-module sheets (bookkeeping, receipts, invoices, payroll, tax, and supporting ledgers).

## 14.7) Payroll, Employees, and Approval Flows

1. Salaries and employees module with payroll readiness checks.
2. Employee master data includes:
   1. Personal identity details (including personal number)
   2. Contact and address
   3. Tax parameters
   4. Bank payment details (account/clearing/IBAN/BIC)
3. Employee-level salary entries with:
   1. Gross/taxable/net values
   2. Preliminary tax
   3. Employer contribution
   4. Pension
   5. Approval and payment statuses
4. Employee expense entries with:
   1. Gross/net/VAT
   2. Approval and payment statuses
   3. References and notes
5. Payroll overview and employee totals (including running totals for key payroll tax amounts).
6. Approved/paid payroll data is wired into transaction/ledger context.

## 14.8) Swedish Tax Support Modules and Compliance

1. Fixed asset register with depreciation handling.
2. Mileage log for business travel and deduction basis.
3. Periodiseringsfond/expansionsfond module with allocation/withdrawal tracking and balances.
4. Compliance checklist page with Swedish sole-trader requirements, status indicators, and filing deadline guidance.

## 14.9) Settings and Local Fallback Persistence

1. Settings coverage includes:
   1. Business identity fields
   2. Jurisdiction and locale
   3. Base currency
   4. Bookkeeping method
   5. VAT registration and frequency
   6. Tax year start month (custom month-to-month fiscal period)
   7. Swedish registration fields (SNI, VAT number, F-skatt, personnummer)
   8. Invoice defaults (number pattern, sender profile, default logo/signature, email-from)
   9. Tax projection rates (municipal tax, social contributions, deduction rate)
2. Local settings persistence fallback file is in use for robustness when needed.

## 15) Feature Carry-Forward Mapping Into SaaS Phases

The migration roadmap below must preserve Section 14 features while moving to production SaaS architecture.

## Phase 0-1 (Foundation, Auth, Multi-Tenant)

1. Preserve current login UX behavior while replacing local/session assumptions with managed auth.
2. Preserve EN/SV locale switching and sidebar/subnav architecture.
3. Migrate all existing single-business data to tenant-scoped organization model.

## Phase 2-3 (Core Domain + OCR Pipeline)

1. Preserve receipts/invoices/transactions/ledger data model semantics.
2. Preserve receipt extraction fields and review workflow behavior.
3. Preserve SEK conversion-at-issue-date logic and FX metadata capture.
4. Move OCR to reliable async queue workers without reducing extraction quality.

## Phase 4 (Invoicing and Ledger Automation)

1. Preserve invoice builder UX and customer database search flow.
2. Preserve invoice PDF/email/send/paid lifecycle.
3. Preserve auto-posting behavior into ledger and review links.

## Phase 5 (Reporting and Exports)

1. Preserve all section exports (Excel and PDF).
2. Preserve ledger export totals and built-in profit/loss summary.
3. Preserve full accounts workbook export breadth.
4. Preserve historical tax-year filtering behavior.

## Phase 6 (Billing and Entitlements)

1. Add subscription gating without breaking existing accounting workflows.
2. Keep all current core accounting modules available in baseline plan tiers as defined by product policy.

## Phase 7 (Mobile-First UX)

1. Keep current feature parity while adapting table-heavy pages to small-screen patterns.
2. Prioritize mobile usability for:
   1. Receipt upload/review
   2. Invoice creation
   3. Ledger filtering and review drill-down
   4. Payroll approvals

## Phase 8 (Hardening and Launch)

1. Validate that all Section 14 features work in production topology.
2. Add regression checks for critical flows:
   1. Receipt upload/extraction/posting
   2. Invoice create/send/pay/posting
   3. Ledger totals and exports
   4. Payroll approval/pay flows
   5. Reports and annual workbook generation

## 16) International, Public Site, and UX Expansion Addendum

This addendum captures the newly requested scope and is now part of the baseline delivery plan.
Where it conflicts with Section 14 (current-state baseline), this addendum takes precedence for forward implementation.

## 16.1) Geographic and Tax Scope

1. UK and EU must be first-class supported operating regions.
2. Organizations outside the UK/EU must be supported through configurable tax criteria in Settings.
3. Settings must include a country selector that drives tax profile behavior.
4. Tax profile behavior by territory:
   1. UK/EU countries: preload territory templates (VAT defaults, filing frequency defaults, local identifiers, baseline reporting assumptions).
   2. Non-UK/EU countries: show a custom tax setup flow where the user defines territory-specific criteria.
5. The app must store both:
   1. Template-driven defaults for known countries.
   2. User-edited overrides per organization.

## 16.2) Tax Configuration Model for Non-UK/EU Territories

1. Add configurable settings fields for custom jurisdictions:
   1. Tax year start month and end month.
   2. Standard/reduced/zero VAT or sales tax rates.
   3. VAT registration threshold.
   4. Filing frequency and due-day rules.
   5. Income tax estimation rates.
   6. Payroll contribution rates (where used).
   7. Required registration identifiers.
2. Allow custom labels for tax terms so the UI can adapt to local wording.
3. Include validation and warning states when required tax fields are missing.

## 16.3) Localization and Auto-Translation Strategy

1. On first visit, detect user language from browser/OS (`Accept-Language` and client locale).
2. Auto-apply a supported UK/EU locale when available, while still allowing manual language override.
3. Translation approach priority:
   1. First preference: browser translation support for site pages.
   2. Optional enhancement: DeepL for controlled translation workflows.
4. Implement browser-translation-friendly behavior:
   1. Correct `lang` attributes.
   2. Semantic HTML and clean text nodes.
   3. No blockers that prevent browser translation engines from working.
5. If DeepL is enabled:
   1. Use it for dynamic content translation where needed.
   2. Cache translated outputs.
   3. Keep source language fallback if translation fails.
6. UK/EU language support rollout target:
   1. Start with `en-GB` + key EU languages in wave 1.
   2. Expand coverage in later waves as quality is verified.

## 16.4) Authentication and Landing Page Restructure

1. Remove login-from-splash as the primary entry flow.
2. Move sign-in entry to the public landing page.
3. Keep a direct sign-in route (`/sign-in`) as a fallback path.
4. Route architecture target:
   1. Public marketing experience under `/`.
   2. Authenticated product workspace under `/app` (or `/dashboard`) with existing accounting modules.
5. Keep transition animations subtle and consistent between landing, sign-in, and app shell.

## 16.5) Branding Requirement

1. Use Akunta logo branding consistently across all pages (public + authenticated).
2. Keep brand usage consistent in:
   1. Header/nav
   2. Footer
   3. Auth surfaces
   4. Email templates
   5. PDFs where relevant

## 16.6) New Public-Site Pages and Content Requirements

1. Landing page (`/`) must include:
   1. Short impactful introduction focused on simplicity.
   2. Primary call-to-action button.
   3. Sign-in action.
   4. Features section listing core app features.
   5. Latest 4 blog posts section.
   6. Testimonials section showing 5 testimonials at a time.
2. Add Help pages:
   1. `/help` index.
   2. `/help/[slug]` detail pages.
3. Add Support page:
   1. `/support` with contact form.
   2. Backend support submission workflow (ticket/email).
4. Add Blog pages:
   1. `/blog` listing.
   2. `/blog/[slug]` article pages.
5. Add Resources page:
   1. `/resources` with tax and small-business links.
   2. Country-aware resource filtering based on detected/selected country.
   3. Manual country override in UI.

## 16.7) Data and Content Model Additions

1. Add territory/tax profile tables:
   1. `country_tax_templates`
   2. `organization_tax_profiles`
   3. `organization_tax_profile_rules`
2. Add public content tables:
   1. `blog_posts`
   2. `blog_post_translations`
   3. `help_articles`
   4. `help_article_translations`
   5. `testimonials`
3. Add support and resources tables:
   1. `support_tickets`
   2. `support_messages`
   3. `resource_links` (country, category, language, URL, verification metadata)

## 16.8) Repository Structure Additions

Add/extend structure for public pages and content domain:

```text
app/
  (public)/
    page.tsx                    # Landing page
    sign-in/page.tsx
    help/page.tsx
    help/[slug]/page.tsx
    support/page.tsx
    blog/page.tsx
    blog/[slug]/page.tsx
    resources/page.tsx
  (app)/
    layout.tsx
    page.tsx                    # Authenticated dashboard
    receipts/page.tsx
    invoices/page.tsx
    ledger/page.tsx

components/
  public/
    Hero.tsx
    FeatureGrid.tsx
    TestimonialCarousel.tsx
    LatestPosts.tsx
    CountryResourceLinks.tsx
    SupportForm.tsx
  layout/
    BrandHeader.tsx
    BrandFooter.tsx

lib/
  i18n/
    detect.ts
    locales.ts
    deepl.ts
  tax/
    templates/
      eu/
      uk/
      custom/
  content/
    blog.ts
    help.ts
    resources.ts
```

## 16.9) Phase Mapping for New Scope

Integrate new scope into existing phases as follows:

1. Phase 1 (Auth and Multi-Tenancy):
   1. Implement public/app route split.
   2. Move sign-in entry to landing.
   3. Retain direct `/sign-in` route.
2. Phase 2 (Core Accounting Domain):
   1. Add country-aware tax profile schema.
   2. Implement UK/EU template loading + non-UK/EU custom criteria fields.
3. Phase 3 (OCR Pipeline):
   1. Ensure parsing/posting remains compatible with country tax profile settings.
4. Phase 4 (Invoicing and Ledger):
   1. Apply country/tax-profile constraints in calculations and defaults.
5. Phase 5 (Reporting and Exports):
   1. Add country-aware report labels/logic where applicable.
6. Phase 7 (Mobile-First UX):
   1. Optimize landing/help/support/blog/resources for small screens.
7. Phase 8 (Hardening and Launch):
   1. Add regression checks for localization detection, translation fallbacks, and country tax-profile workflows.
8. New content stream (runs parallel across Phases 4-8):
   1. Build and populate Help, Blog, Testimonials, and Resources content pipelines.

## 16.10) Acceptance Criteria for This Addendum

1. A UK/EU user gets country-appropriate tax defaults from Settings.
2. A non-UK/EU user can fully define tax criteria for their territory in Settings.
3. Language defaults to detected browser/OS locale for supported UK/EU languages.
4. Browser translation works cleanly on public and app pages.
5. Landing page contains intro, CTA, sign-in, features, 4 latest posts, and 5-visible testimonials.
6. Help, Support, Blog, and Resources pages are live and mobile-optimized.
7. Resources are country-aware and user-overridable.
8. Akunta branding is consistent on every page.
