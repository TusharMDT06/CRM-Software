# Flowdesk CRM — Modern Enterprise SaaS Sales Platform

Flowdesk is a fast, clean, enterprise sales CRM web application inspired by modern SaaS sales dashboards (HubSpot, Pipedrive, Zoho class). Built with a full-stack TypeScript monorepo architecture, strict role-based access control (RBAC), and sleek modern SaaS design aesthetics.

---

## ⚡ Tech Stack

- **Monorepo**: `/server` and `/client`
- **Backend (`/server`)**:
  - Node.js 20+ & Express 4
  - TypeScript (strict mode)
  - MongoDB + Mongoose 8
  - Zod validation (typed schema enforcement, returning 400 with `{ message }`)
  - JWT (Bearer token) authentication & bcryptjs password hashing
  - Nodemailer for email dispatch with graceful fallback
  - Helmet & CORS security
  - `express-rate-limit` (20 attempts / 15 mins on `/api/auth/login`, rate-limited email send)
- **Frontend (`/client`)**:
  - Vite + React 18 + TypeScript
  - Tailwind CSS v3 (pinned to `^3.4.17`, CSS variables for light/dark themes)
  - React Router DOM v6
  - `@tanstack/react-query` v5 (caching, optimistic updates, query invalidation)
  - Axios API client with automatic Bearer token interceptor
  - `@dnd-kit/core` (drag-and-drop Deals Kanban pipeline)
  - `@dnd-kit/sortable` (drag-and-drop custom field ordering)
  - PapaParse (client-side CSV parsing with live previews)
  - Recharts (smooth AreaCharts, Funnel & BarCharts)
  - Lucide React icons
  - Vite dev server proxying `/api` to `http://localhost:5000`

---

## 🔐 Roles and Permissions (RBAC)

| Feature | Admin | Manager | Sales |
|---|:---:|:---:|:---:|
| **Record Visibility** | All records across company | All records across company | Own records only (`owner == userId`) |
| **Record Editing** | Any record & assign owners | Any record & assign owners | Own records only (cannot reassign owner) |
| **Record Deletion** | ✅ Allowed | ✅ Allowed | ❌ Forbidden (403) |
| **Record Detail Page** | ✅ All records | ✅ All records | ✅ Own records only (404 otherwise) |
| **Lead Conversion** | ✅ Allowed | ✅ Allowed | ✅ Allowed (for owned leads) |
| **Custom Fields Settings** | ✅ Create, edit, reorder, deactivate | ❌ Forbidden (403) | ❌ Forbidden (403) |
| **Team Leaderboard Report** | ✅ View all reps' metrics | ✅ View all reps' metrics | ❌ Forbidden (403) |
| **Email Templates** | ✅ Manage all templates | ✅ Manage all templates | Own templates + view shared |
| **CSV Import** | ✅ Import for any owner | ✅ Import for any owner | Own records only |
| **Team Management** | ✅ Add member, edit role, toggle active, reset password | ❌ View list only | ❌ View self only |
| **Deactivated Users** | Rejected at login with 403 Forbidden | Rejected at login with 403 Forbidden | Rejected at login with 403 Forbidden |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- MongoDB instance running locally on `localhost:27017` (or MongoDB Atlas URI)

### 1. Clone & Install Dependencies

```bash
# Clone or open repository
cd "d:/crm software"

# Install server packages
cd server
npm install

# Install client packages
cd ../client
npm install
```

### 2. Configure Environment Variables

**Backend (`server/.env` or root `.env`)**:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/flowdesk
JWT_SECRET=flowdesk_super_secret_jwt_key_2026_crm
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development

# Optional Resend Configuration for Email Sending
RESEND_API_KEY=
EMAIL_FROM=Flowdesk <onboarding@resend.dev>

# Google Gemini API Configuration (Official @google/genai SDK)
# Required to enable Copilot, smart email drafting, record summaries, and natural-language search
GEMINI_API_KEY=
# Strong model for Copilot chat, multi-step tool loops, record summaries, and scoring explanations
AI_MODEL=gemini-2.0-flash
# Fast/cost-effective model for natural-language search filters and short drafts
AI_MODEL_FAST=gemini-2.0-flash-lite
```

> **Note on Gemini Models**: Model IDs are read strictly from environment variables and never hardcoded. Check the current official model list in Google AI Studio at [ai.google.dev/gemini-api/docs](https://ai.google.dev/gemini-api/docs) or within your Google AI Studio dashboard. If `GEMINI_API_KEY` is missing or empty, all AI UI components remain gracefully hidden with no fake outputs. AI is OFF by default per organization until an administrator completes the Data Privacy Gate in **Settings > Company Settings > AI Intelligence**.

### 3. Seed Database with Realistic Demo Data

The seed script creates realistic Indian enterprise accounts (Tata Digital, Razorpay, Reliance Retail, Zerodha, Zomato, Freshworks, BrowserStack, Delhivery), contacts, leads, deals across all stages, tasks, 12 custom field definitions (3 per entity), 5 rich email templates, and timeline activities:

```bash
cd server
npm run seed
```

### 4. Run the Automated API Verification Suites

```bash
cd server
# Run Phase 1 verification suite (30 tests)
npm run test:api

# Run Phase 2 verification suite (23 tests)
npx tsx src/test-phase2-api.ts

# Run Stage 4 AI features verification suite (27 tests: tool scoping, prompt injection, whitelist, provider mock, scoring)
npm run test:stage4
```

### 5. Start Development Servers

Run the backend server (runs on `http://localhost:5000`):
```bash
cd server
npm run dev
```

In a separate terminal, run the frontend client (runs on `http://localhost:5173`):
```bash
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔑 Demo Credentials

All demo users share the default password `Password@123`. The login screen includes quick-fill buttons for instant testing:

| Role | Email | Password | Scope & Access |
|---|---|---|---|
| **Admin** | `admin@crm.test` | `Password@123` | Full access, user management, custom fields settings, team leaderboard |
| **Manager** | `manager@crm.test` | `Password@123` | View all deals & leads, delete records, assign owners, view all reports |
| **Sales** | `sales@crm.test` | `Password@123` | Scoped to own records only, drag-and-drop Kanban, compose emails |
| **Sales 2** | `sales2@crm.test` | `Password@123` | Second sales rep for leaderboard comparison & scoping tests |
| **Disabled Test** | `disabled@crm.test` | `Password@123` | Verifies rejection of deactivated accounts |

---

## 🌟 Phase 2 Features

### 1. Record Detail Pages
- **Routes**: `/leads/:id`, `/contacts/:id`, `/accounts/:id`, `/deals/:id`.
- Clicking table rows or Kanban cards navigates directly to the dedicated detail view.
- **3-Column Responsive Layout**:
  - **Left**: Record info card with primary fields, owner, timestamps, dynamic custom fields, and quick action bar (`Send Email`, `Log Call`, `Add Task`, and `Convert Lead` on leads).
  - **Center**: Tabbed workspace with **Timeline**, **Notes**, **Tasks**, and **Emails**.
  - **Right**: Related records cards with bi-directional links (Account has contacts and deals; Contact has account and deals; Deal has account, contact, and tasks).
- **Strict Owner Scoping**: Sales users attempting to access a record owned by someone else are strictly denied with a 404.

### 2. Activity Timeline
- **Activity Model**: Tracks notes, phone calls, meetings, emails, tasks, deal stage changes, and system events.
- **Server-Side Automated System Activities**:
  - Lead created and lead converted.
  - Deal created.
  - Deal stage advanced or changed.
  - Task completed.
  - Email dispatched.
- **Rich Composer**: Segmented control for Note, Call, and Meeting with call duration and outcome tracking (`connected`, `left_message`, `no_answer`).
- **Vertical Day-Grouped Timeline**: Type-specific icons, author avatar, relative timestamp ("2 hours ago", exact datetime on hover), and permission-aware deletion.
- **Dashboard Widget**: Real-time "Recent Activity" card mounted in the right column of the main dashboard displaying the latest 8 events.

### 3. Email Templates & Composing
- **Model**: `EmailTemplate` with name, subject, body, category, shared toggle, and owner.
- **Templates Page (`/templates`)**: Create, edit, duplicate, delete, and live preview email templates with merge field insertion dropdown.
- **Merge Fields Support**: `{{contact.firstName}}`, `{{contact.lastName}}`, `{{account.name}}`, `{{deal.title}}`, `{{deal.amount}}` (formatted in ₹), `{{owner.name}}`, `{{lead.name}}`, `{{lead.company}}`.
- **Compose Modal**: Accessible from any record detail page. Select a template or write custom content with live merge token resolution and visual highlight for unresolved tokens.
- **Resend Dispatch & Fallback**: `POST /emails/send` validates input, resolves merge fields, constructs both HTML and plain-text formats, and dispatches via official `resend` SDK with `replyTo` set to the signed-in salesperson's address. If `RESEND_API_KEY` is not configured, returns a 503 response with prefilled `mailto:` link and offers "Open in my email app" and "Log as sent" (`POST /emails/log-sent`) so the user's workflow is never interrupted. Shows a test-mode warning banner in the compose modal when using the `resend.dev` test sender.

### 4. CSV Export & Import Wizard
- **Streaming UTF-8 CSV Export**: Dedicated "Export CSV" buttons on Leads, Contacts, Accounts, and Deals respecting search queries, filters, and owner scoping. Encoded with UTF-8 BOM (`\uFEFF`) for Excel compatibility and protected against formula injection (`=`, `+`, `-`, `@`).
- **4-Step Import Wizard**:
  1. **Upload**: Client-side parsing with PapaParse (up to 5,000 rows), sample CSV download.
  2. **Column Mapping**: Intelligent auto-mapping with fuzzy matching and unmapped column preview.
  3. **Dry-Run Validation**: Server-side `POST /:entity/import?dryRun=true` runs zod validation, checks for duplicate emails or company names, and returns row-by-row error diagnostics.
  4. **Batch Import**: Chunked batch processing with progress bar, summary card (created, updated, skipped, failed), and error rows CSV export.

### 5. Custom Fields System
- **Model**: `FieldDefinition` per entity (`lead`, `contact`, `account`, `deal`) supporting `text`, `number`, `date`, `select`, `checkbox`, and `url`.
- **Settings Page (`/settings/custom-fields`)**: Admin-only manager with tabbed entities, drag-and-drop reordering (`@dnd-kit/sortable`), and non-destructive deactivation.
- **Dynamic Forms**: All drawers and detail cards render active custom fields with type-appropriate inputs.
- **Customizable List Columns**: "Columns" toggle menu on tables allows showing/hiding standard and custom fields, persisting preferences per user in `localStorage`.

### 6. Reports & Analytics (`/reports`)
MongoDB aggregation pipelines providing sub-second analytics across 5 key dimensions:
1. **Sales Funnel**: Deals distribution by stage with aggregate amounts in ₹, and lead-to-deal conversion rate.
2. **Won Revenue**: Monthly won revenue trends compared against previous periods, with total and average deal size.
3. **Leads Analytics**: Volume and conversion rates broken down by lead source and status.
4. **Team Leaderboard (Admin & Manager)**: Comparative rep rankings for deals won, total revenue, win rate %, open pipeline, and completed tasks.
5. **Close Forecast**: Open opportunities grouped by close month with stage-weighted expected values (Qualified 20%, Proposal 40%, Negotiation 70%).
- Includes date range presets (This Month, Last 30 Days, This Quarter, This Year, Custom) and instant CSV export for all reports.

### 7. Motion & Animation System
- **Library**: Official `motion` package (`import ... from 'motion/react'`) with single shared token definition in `client/src/lib/motion.ts`.
- **Top-to-Bottom Page Entrance**: Sections animate downwards from -12px to 0 with 60ms stagger per section (header, KPI row, chart card, health meter cards, table card, right column cards), 300ms duration each, ease-out, total page entrance < 700ms.
- **Skeleton Crossfade**: While fetching data, skeleton displays smoothly; once data arrives, skeleton crossfades out (~150ms) and actual content animates in.
- **One-Shot Entrance**: Animations play on page mount or loading→loaded transition only, and do NOT replay on refetches, window focus, pagination, or sorting (which use subtle 120ms table row opacity fades).
- **KPI CountUp**: Numerical KPIs count up smoothly from 0 to target value over 800ms using `requestAnimationFrame` with ease-out cubic curve and INR compact formatting (`₹4.5L`, `₹1.2Cr`) at every frame.
- **Kanban Motion**: Columns slide in left-to-right (60ms stagger), cards inside rise with small stagger (capped at 8 cards per column), and cards smoothly animate into new columns using Framer Motion layout transitions while retaining drag-and-drop drop physics.
- **Drawers, Modals & Shell**: Drawers slide in from the right (250ms), modals and command palette fade and scale (0.98→1), toasts slide up with popLayout transitions, and the sidebar active pill glides smoothly with a shared `layoutId`.
- **Accessibility**: Wrapped in `<MotionConfig reducedMotion="user">`, respecting `prefers-reduced-motion` across the application. Skip CountUp and movements when reduced motion is preferred.

---

## 💼 Phase 3: Products, Billing, Automations, Notifications & Audit Trails

### 1. Products, Company Settings & Atomic Document Numbering
- **Product Model (`/products`)**: Stores product catalog with SKU (unique uppercase), name, description, unit price in integer paise, tax rate (default 18%), unit (`nos`, `hours`, `days`, `months`, `kg`, `other`), active status, and owner. Hard delete is strictly blocked if a product is linked to existing quotes or invoices.
- **Company Settings (`/settings/company`)**: Single document managed by Admins containing legal entity name, address, state (used for automatic intra vs inter-state GST determination), GSTIN, PAN, logo upload (max 1 MB base64 data URL), bank details (account name, account number, IFSC, bank name), payment terms (default 30 days), quote validity (default 15 days), standard terms & conditions, and numbering prefixes (`QT`, `INV`).
- **Atomic Document Numbering**: Prefixed identifiers (`QT-2026-0001`, `INV-2026-0001`) use a dedicated atomic `Counter` MongoDB collection updated with `findOneAndUpdate` and `$inc`. Numbers are never derived from count or max, preventing duplicate numbers under concurrent requests.
- **Strict Money Rule**: Every monetary value is stored as an integer number of paise on the server (`1 INR = 100 paise`). Conversions to Rupees occur solely for client input and presentation. All totals are calculated on the server with half-up line-level rounding before summing.

### 2. Quotes & Public Portal
- **Quote Model (`/quotes`)**: Tracks status (`draft`, `pending_approval`, `sent`, `viewed`, `accepted`, `declined`, `expired`), line items, computed subtotal, discount, CGST/SGST (intra-state) or IGST (inter-state), total in paise, notes, terms, and a secure 32-byte hex public token.
- **Builder UI (`/quotes/new`, `/quotes/:id`)**: Line items table with product catalog autocomplete, live subtotal/discount/tax calculation, Indian amount in words conversion, and prefilling from Deals.
- **Approval Engine**: Quotes with line discounts exceeding 15% or total amounts exceeding ₹10,00,000 (100,000,000 paise) are automatically placed in `pending_approval` when sent by Sales reps. Managers and Admins can approve or reject with a reason, or send directly.
- **Server-Side PDF Generation**: Generated on-demand via `pdfkit` (GET `/api/quotes/:id/pdf`) featuring company logo, bill-to client block, items table, GST breakdown, bank details, and terms.
- **Public Client Portal (`/q/:publicToken`)**: Unauthenticated, rate-limited public view outside the app shell allowing clients to review the proposal, download the official PDF, and Accept or Decline (with reason). The first visit marks the quote as `viewed`, and actions trigger timeline activities and notifications.
- **Accepted Quote Conversion**: Offers one-click conversion to an Invoice and prompts to advance the linked deal to Won.

### 3. Invoices, Payments & Receivables
- **Invoice Model (`/invoices`, `/invoices/:id`)**: Matches quote line items structure, tracking issue date, due date, computed balance, and payments list.
- **Payment Recording**: Validates positive amounts up to the remaining balance, updates invoice status (`partially_paid` or `paid`), logs timeline activities, and triggers owner notifications. Payments can be deleted by Admins only (which automatically recomputes balance and status).
- **Voiding**: Invoices that have been sent or issued can be voided with a reason by Admins or Managers (numbers are never reused).
- **Receivables Dashboard**: The main dashboard features a 4th metric card displaying outstanding receivables, overdue percentage, overdue invoice count, and overdue amount with direct navigation to the invoices ledger.
- **Aging Reports (`/reports` - Invoices tab)**: Visualizes collections by month over the past 6 months, accounts receivable aging buckets (0-30, 31-60, 61-90, 90+ days), and top customer accounts by paid revenue with CSV export.

### 4. Workflow Automation Engine (`/automations`)
- **Event Bus & Loop Safety**: In-process EventEmitter that executes workflows on domain events (`lead_created`, `deal_created`, `deal_stage_changed`, `deal_won`, `deal_lost`, `task_overdue`, `quote_accepted`, `quote_declined`, `invoice_overdue`, `invoice_paid`).
  - **Loop Guards**: Enforces maximum execution depth of 3; prevents workflows from re-triggering for the same record within 60 seconds; and caps runs at 50 per minute per workflow, automatically disabling erratic workflows and alerting Admins.
- **Conditions & Actions**: Evaluates field conditions (`equals`, `not_equals`, `greater_than`, `less_than`, `contains`, `is_empty`) and executes actions:
  - `create_task`: Generates tasks with merge tag substitution (`{{title}}`, `{{name}}`) assigned to the record owner or a specific user.
  - `send_email`: Dispatches templated emails via Resend.
  - `send_notification`: Emits in-app and email alerts to owners, specific users, or managers.
  - `update_field`: Safely mutates whitelisted entity fields (`lead.status`, `deal.stage`, `owner`).
  - `assign_owner`: Rotates leads or records across sales reps using persisted round-robin pointers.
- **Testing & Dry Run**: Step-based builder UI with an interactive "Dry Run Test" modal that simulates conditions and action outputs against real records without mutating data.
- **Run History**: Expandable audit logs per workflow tracking status, step messages, execution durations, and error traces.

### 5. In-App Notifications & Preferences
- **Bell Popover & Route (`/notifications`)**: Top bar bell icon with real-time unread badge, 30-second background polling (auto-paused on hidden tabs), quick-read popover, mark-all-as-read, and full paginated history with all/unread filters.
- **Deduplication & Anti-Self Alerting**: Actions performed by the current user never generate self-notifications. Duplicate notifications for the same entity and type within 10 minutes are automatically coalesced. 90-day automatic TTL index cleanup.
- **Notification Preferences (`/settings/notifications`)**: Per-user matrix allowing toggling in-app alerts and optional Resend emails across all system notification types.

### 6. Audit Trail & Compliance (`/audit-log`)
- **Centralized Mutation Hook**: Automatically captures creates, updates, and deletes across all entities (leads, contacts, accounts, deals, tasks, products, quotes, invoices, payments, workflows, field definitions, and company settings) with field-level diffs.
- **Sensitive Data Masking**: Excludes passwords, JWT tokens, and API keys.
- **Compliance UI (Admin Only)**: Filter by actor, action type, entity type, and date range; quick search; row drawer with field-by-field diff (old value struck through, new value highlighted); and CSV export with formula injection sanitization.
- **Entity History Tabs**: Account, Deal, Lead, and Contact detail pages feature an embedded "History" tab displaying chronological audit entries (with field diffs visible to Managers and Admins).

### 7. Background Scheduler & Crons
Automated background tasks managed via `node-cron`:
- **Every 15 Minutes**: Idempotent checks for quote expirations (past `validUntil`), overdue invoices (past `dueDate`), overdue open tasks, and scheduled automation triggers using persistent `lastFiredFor` tracking.
- **Daily at 8:00 AM**: Generates `task_due_today` notifications for all users with tasks due that day.
- **Daily at Midnight**: 365-day audit log retention cleanup (configurable via `AUDIT_RETENTION_DAYS`), which logs its own audit cleanup entry upon completion.

