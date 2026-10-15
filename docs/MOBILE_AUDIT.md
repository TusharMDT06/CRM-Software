# FlowDesk CRM — Mobile Readiness Repository Audit

**Date:** October 2026  
**Auditor:** FlowDesk Mobile Engineering Team  
**Reference Document:** `docs/MOBILE_APP_SPEC.md`

---

## 1. Repository Structure, Node Version & Package Management

### 1.1 Folder Structure
```
flowdesk-crm/
├── client/                     # Web Frontend (React 18 + Vite + TailwindCSS + TanStack Query)
│   ├── src/
│   │   ├── api/                # Axios API clients
│   │   ├── components/         # UI components & modals
│   │   ├── context/            # AuthContext, ToastContext
│   │   ├── pages/              # Route view pages (Dashboard, Leads, Deals, etc.)
│   │   ├── types/              # Client TypeScript type declarations
│   │   └── utils/              # Client utility functions
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                     # Backend API (Node.js + Express + TypeScript + Mongoose)
│   ├── src/
│   │   ├── ai/                 # Gemini GenAI copilot services
│   │   ├── config/             # DB & environment configuration
│   │   ├── middleware/         # Auth, validation, plan limits, error handling
│   │   ├── models/             # Mongoose database models (32 models)
│   │   ├── routes/             # Express API route modules (26 routers)
│   │   ├── services/           # Business logic & lead attribution services
│   │   ├── types/              # Server-side TypeScript interfaces
│   │   ├── utils/              # Multi-tenant plugins, audit logging, helpers
│   │   └── validations/        # Zod validation schemas
│   ├── package.json
│   └── tsconfig.json
├── docs/                       # Specifications & architecture documentation
│   ├── MOBILE_APP_SPEC.md      # Master specification for FlowDesk Mobile
│   └── MOBILE_AUDIT.md         # This audit file
├── docker-compose.yml          # Container configuration
└── package.json                # Root orchestration package
```

### 1.2 Package Manager & Runtime
- **Node.js Runtime:** `v22.16.0`
- **Package Manager:** `npm 10.9.2`
- **Monorepo / Workspace Architecture:** Root `package.json` coordinates scripts (`npm run dev:server`, `npm run dev:client`). Configured as npm workspace (`shared`, `server`, `client`, and upcoming `mobile`).

---

## 2. Mongoose Models & Entity Fields

All models implement FlowDesk's multi-tenant isolation plugin (`tenantPlugin`), automatically scoping queries and documents to `tenantId`.

| Model | Schema Fields & Types | Indexes & Scoping |
|---|---|---|
| **User** | `tenantId` (ObjectId, optional for platform_admin), `name` (String), `email` (String, unique), `passwordHash` (String), `role` (enum: `platform_admin`, `admin`, `manager`, `sales`), `active` (Boolean), `isVerified` (Boolean), `verificationToken` (String), `verificationExpires` (Date), `inviteToken` (String), `inviteExpires` (Date), `timestamps` | `email`, `tenantId`, `verificationToken`, `inviteToken` |
| **Tenant** | `name` (String), `slug` (String, unique), `status` (enum: `active`, `suspended`), `plan` (enum: `free`, `pro`), `limits` (`maxSeats`, `maxRecords`, `aiEnabled`, `aiMonthlyRequests`), `suspendedReason` (String), `deletionRequestedAt` (Date), `timestamps` | `slug` (unique), `status` |
| **Lead** | `tenantId` (ObjectId), `name` (String), `email` (String), `phone` (String), `company` (String), `source` (enum: `website`, `referral`, `social`, `email`, `event`, `other`), `status` (enum: `new`, `contacted`, `qualified`, `converted`, `lost`), `value` (Number), `notes` (String), `custom` (Record), `owner` (ObjectId -> User), `aiScore` (`score`, `grade`: `hot`\|`warm`\|`cold`, `reasons`, `explanation`, `scoredAt`), `channel` (enum: `google_ads`, `facebook`, `instagram`, `website_form`, `whatsapp`, `manual`, `import`, `api`, `other`), `campaign` (`externalId`, `name`), `adSet` (`externalId`, `name`), `ad` (`externalId`, `name`), `formName` (String), `utm` (`source`, `medium`, `campaign`, `term`, `content`), `clickIds` (`gclid`, `fbclid`), `landingPage` (String), `referrer` (String), `consent` (`given`, `text`, `at`, `via`), `inquiryCount` (Number), `lastInquiryAt` (Date), `firstContactAt` (Date), `isTest` (Boolean), `timestamps` | Text search (`name`, `company`, `email`), compound `(tenantId, email)`, `(tenantId, phone)`, `(tenantId, channel, createdAt)` |
| **Contact** | `tenantId` (ObjectId), `firstName` (String), `lastName` (String), `email` (String), `phone` (String), `jobTitle` (String), `account` (ObjectId -> Account), `custom` (Record), `owner` (ObjectId -> User), `timestamps` | Text search (`firstName`, `lastName`, `email`), `account`, `owner` |
| **Account** | `tenantId` (ObjectId), `name` (String), `industry` (String), `website` (String), `phone` (String), `city` (String), `employees` (Number), `custom` (Record), `owner` (ObjectId -> User), `timestamps` | Text search (`name`, `industry`, `city`), `owner` |
| **Deal** | `tenantId` (ObjectId), `title` (String), `account` (ObjectId -> Account), `contact` (ObjectId -> Contact), `amount` (Number), `stage` (enum: `qualified`, `proposal`, `negotiation`, `won`, `lost`), `expectedClose` (Date), `closedAt` (Date \| null), `custom` (Record), `owner` (ObjectId -> User), `aiRisk` (`level`: `low`\|`medium`\|`high`, `score`, `reasons`, `explanation`, `evaluatedAt`), `channel` (String), `campaign` (`externalId`, `name`), `timestamps` | `stage`, `expectedClose`, `closedAt`, `(tenantId, channel)`, `(tenantId, campaign.externalId)` |
| **Task** | `tenantId` (ObjectId), `title` (String), `description` (String), `dueDate` (Date), `status` (enum: `open`, `done`), `priority` (enum: `low`, `medium`, `high`), `deal` (ObjectId -> Deal \| null), `owner` (ObjectId -> User), `timestamps` | `dueDate`, `status`, `priority`, `deal`, `owner` |
| **LeadSource** | `tenantId` (ObjectId), `name` (String), `type` (enum: `meta_lead_ads`, `google_ads`, `website_form`, `generic_webhook`), `status` (enum: `active`, `paused`, `error`), `config` (Record), `webhookId` (String, unique), `routingRules` (Array), `counters` (`received`, `created`, `duplicates`, `failed`), `lastLeadAt` (Date), `lastError` (String), `createdBy` (ObjectId -> User), `timestamps` | `webhookId` (unique), `(tenantId, type)` |
| **LeadEvent** | `tenantId` (ObjectId), `source` (ObjectId -> LeadSource), `providerLeadId` (String), `status` (enum: `received`, `processed`, `duplicate`, `ignored`, `failed`), `attempts` (Number), `error` (String), `rawPayload` (Record), `lead` (ObjectId -> Lead), `isTest` (Boolean), `timestamps` | `(source, providerLeadId)` (dedup index), `(tenantId, status)` |
| **Notification** | `tenantId` (ObjectId), `user` (ObjectId -> User), `type` (NotificationType: 23 types), `title` (String), `body` (String), `link` (String), `entityType` (String), `entityId` (String), `readAt` (Date \| null), `createdAt` (Date) | TTL index (90 days on `createdAt`), `(tenantId, user, readAt, createdAt)` |
| **NotificationPreference** | `tenantId` (ObjectId), `user` (ObjectId -> User), `preferences` (Record of `inApp`: Boolean, `email`: Boolean), `timestamps` | Unique `(tenantId, user)` |
| **Activity** | `tenantId` (ObjectId), `type` (enum: `note`, `call`, `meeting`, `stage_change`, `system`, `email_sent`, `whatsapp_sent`), `subject` (String), `body` (String), `entityType` (enum: `lead`, `contact`, `account`, `deal`), `entityId` (ObjectId), `occurredAt` (Date), `durationMins` (Number), `outcome` (String), `messageId` (String for Resend ID), `createdBy` (ObjectId -> User), `timestamps` | `(tenantId, entityType, entityId, occurredAt)` |
| **Ticket & TicketMessage** | Tickets, SLA policies, and customer support messages (customer, agent, body, timestamps) | Scoped to tenant |
| **Quote & Invoice & Payment** | Financial billing documents, line items, status, PDF generation | Scoped to tenant |

---

## 3. REST Routes Audit

The backend routes are mounted twice in `server/src/index.ts`: under `/api/*` and at root `/*` for complete deployment compatibility.

### 3.1 Core Entity Routes
- **`/auth`**
  - `POST /auth/bootstrap` — Public (disabled once users exist). Initializes first tenant + admin.
  - `POST /auth/signup` — Public. Rate limited. Creates tenant, admin user, triggers verification email.
  - `GET /auth/verify-email?token=` — Public. Verifies user email.
  - `POST /auth/accept-invite` — Public. Accepts team invite token and sets password.
  - `POST /auth/login` — Public. Verifies credentials, returns JWT Bearer token + user + tenant.
  - `GET /auth/me` — Authenticated. Returns current user profile, role, tenant, and impersonation status.
- **`/users`**
  - `GET /users` — Authenticated (Admin/Manager/Sales). Returns team members list.
  - `POST /users` — Authenticated (Admin only). Creates active team member directly.
  - `POST /users/invite` — Authenticated (Admin only). Generates invite token and emails team invite.
  - `GET /users/:id` — Authenticated.
  - `PATCH /users/:id` — Authenticated (Admin only; or self for limited fields).
  - `DELETE /users/:id` — Authenticated (Admin only).
- **`/leads`**
  - `GET /leads` — Authenticated. Role-scoped. Filters: `page`, `limit`, `sort`, `q`, `owner`, `status`, `source`, `channel`, `campaign`, `isTest`.
  - `GET /leads/export` — Authenticated. CSV export.
  - `GET /leads/:id` — Authenticated. Scoped.
  - `POST /leads` — Authenticated. Validates plan limits & custom fields.
  - `POST /leads/import` — Authenticated. Bulk CSV import.
  - `PATCH /leads/:id` — Authenticated. Scoped partial update.
  - `POST /leads/:id/convert` — Authenticated. Converts Lead to Account + Contact + Deal.
  - `DELETE /leads/:id` — Authenticated (Admin/Manager only).
- **`/contacts`**
  - `GET /contacts` — Authenticated. Role-scoped. Filters: `page`, `limit`, `sort`, `q`, `owner`, `account`.
  - `GET /contacts/export` — Authenticated. CSV export.
  - `GET /contacts/:id` — Authenticated. Scoped.
  - `POST /contacts` — Authenticated.
  - `PATCH /contacts/:id` — Authenticated. Scoped partial update.
  - `DELETE /contacts/:id` — Authenticated (Admin/Manager only).
- **`/accounts`**
  - `GET /accounts` — Authenticated. Role-scoped. Filters: `page`, `limit`, `sort`, `q`, `owner`, `industry`.
  - `GET /accounts/export` — Authenticated. CSV export.
  - `GET /accounts/:id` — Authenticated. Scoped.
  - `POST /accounts` — Authenticated.
  - `PATCH /accounts/:id` — Authenticated. Scoped partial update.
  - `DELETE /accounts/:id` — Authenticated (Admin/Manager only).
- **`/deals`**
  - `GET /deals` — Authenticated. Role-scoped. Filters: `page`, `limit`, `sort`, `q`, `owner`, `stage`, `account`, `contact`.
  - `GET /deals/export` — Authenticated. CSV export.
  - `GET /deals/:id` — Authenticated. Scoped.
  - `POST /deals` — Authenticated.
  - `PATCH /deals/:id` — Authenticated. Scoped partial update. Automatically manages `closedAt`.
  - `DELETE /deals/:id` — Authenticated (Admin/Manager only).
- **`/tasks`**
  - `GET /tasks` — Authenticated. Role-scoped. Filters: `page`, `limit`, `sort`, `q`, `owner`, `status`, `priority`, `deal`.
  - `GET /tasks/:id` — Authenticated. Scoped.
  - `POST /tasks` — Authenticated.
  - `PATCH /tasks/:id` — Authenticated. Scoped partial update.
  - `DELETE /tasks/:id` — Authenticated.
- **`/dashboard`**
  - `GET /dashboard/summary` — Authenticated. Computes won deals, revenue change %, pipeline value, win rate, leads count, task stats, risk stats, and monthly breakdown.
- **`/reports`**
  - `GET /reports/funnel` — Funnel stage breakdown and conversion rate.
  - `GET /reports/revenue` — Monthly revenue trend, average deal size, previous period delta.
  - `GET /reports/leads` — Source and status conversion analytics.
  - `GET /reports/team` — Sales leaderboard (Admin/Manager only).
  - `GET /reports/forecast` — Weighted deal pipeline projections.
  - `GET /reports/invoices` — Cash collections, AR aging buckets (0-30, 31-60, 61-90, 90+ days).
  - `GET /reports/support` — SLA compliance, response times, agent resolution metrics.
- **`/marketing`**
  - `GET /marketing/sources` — Lead capture channel configurations & counters.
  - `POST /marketing/sources` — Create webhook or website form source.
  - `PATCH /marketing/sources/:id` — Modify source configuration.
  - `DELETE /marketing/sources/:id` — Remove source.
  - `GET /marketing/events` — Inspect received raw lead events.
  - `POST /marketing/events/:id/reprocess` — Reprocess raw lead event.
  - `GET /marketing/campaigns` — Marketing campaigns list.
  - `GET /marketing/analytics/attribution` & `roi` — Multi-touch attribution analytics.
- **`/notifications`**
  - `GET /notifications` — Recipient notifications list.
  - `GET /notifications/unread-count` — Unread count badge.
  - `PATCH /notifications/:id/read` — Mark read.
  - `POST /notifications/read-all` — Mark all read.
  - `GET /notifications/preferences` — Get user preferences.
  - `PUT /notifications/preferences` — Update notification channels.
- **`/emails`**
  - `GET /emails/config` — Resend status.
  - `GET /emails/templates` — List templates.
  - `POST /emails/send` — Direct transactional email send via Resend.
- **`/hooks` & `/f` (Public Ingestion Webhooks)**
  - `POST /hooks/generic/:webhookId` — Constant-time API key verification, idempotency checking, raw payload persistence, async attribution.
  - `GET /f/:formId` — Public embeddable form schema.
  - `POST /f/:formId/submit` — Anti-spam honeypot check, rate-limited public form intake.

---

## 4. Auth & Scoping Architecture

### 4.1 Token Generation & Transport
- **Mechanism:** JWT Bearer tokens in `Authorization: Bearer <token>` HTTP header.
- **Token Payload:** `{ userId: string }`.
- **Secret & Expiry:** `process.env.JWT_SECRET` (fallback for dev), default expiry `7d`.
- **Validation:** `authenticate` middleware verifies signature, reads user, and executes downstream handlers inside `AsyncLocalStorage` (`runWithTenantContext`).

### 4.2 Role & Permission Scoping
- **Roles:**
  - `platform_admin`: Superuser managing multi-tenant organizations. Can impersonate any tenant in read-only mode (`X-Impersonate-Tenant` header).
  - `admin`: Full administrative access to the organization's data, billing, settings, team members, and role assignments.
  - `manager`: Full visibility into organization records, reporting, dashboards, and team leaderboards.
  - `sales`: Scoped strictly to records they own (`owner: user._id`). `buildOwnerFilter` automatically applies this filter on list and aggregate endpoints. Attempts to access other sales reps' private records return `404 Not Found` (preventing ID enumeration).

### 4.3 Multi-Tenant Isolation
- Handled at database driver level by `server/src/utils/tenantPlugin.ts`.
- Automatically enforces `tenantId` on all Mongoose queries (`find`, `findOne`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`, `aggregate`, `validate`, `insertMany`).

---

## 5. Third-Party Integrations & Webhook Ingest

### 5.1 Resend Email Integration
- Configured in:
  - `server/src/utils/notificationService.ts` — Sends invitations, account verifications, and user notification emails.
  - `server/src/routes/emails.routes.ts` — Sends manual and template-based emails from CRM records.
  - `server/src/utils/workflowEngine.ts` — Automated workflow emails.
- Environment variables: `RESEND_API_KEY`, `EMAIL_FROM`.
- Graceful fallback: If `RESEND_API_KEY` is not present, emails are safely logged to console in test/development mode without crashing.

### 5.2 SMS Provider
- **Current State:** Not implemented in backend.
- **Spec Requirement:** Message schema, SMS provider wrapper, inbound SMS webhook, and message thread endpoints.

### 5.3 Lead Capture Webhooks
- Implemented in `server/src/routes/webhooks.routes.ts` and `server/src/services/leadAttributionService.ts`.
- **Meta (Facebook & Instagram) / Google Ads / Zapier:** Ingested via `POST /hooks/generic/:webhookId` with constant-time API key verification (`x-api-key`), duplicate prevention via `providerLeadId` / `x-idempotency-key`, and automatic phone number E.164 normalization (+91 for Indian mobile numbers).
- **Website Form:** Ingested via `POST /f/:formId/submit` with honeypot anti-spam verification and CORS origin protection.

---

## 6. Gap Analysis & Roadmap for Mobile Parity

| Spec Requirement | Current Repo State | Actions to Implement in Phase 1 |
|---|---|---|
| **Shared Workspace (`shared`)** | Types duplicated in `client/src/types` and `server/src/validations` | Create `shared/` workspace package containing single source-of-truth Zod schemas and TypeScript types for all CRM entities + realtime events. |
| **Realtime Sync (Socket.IO)** | No WebSockets / Socket.IO configured | Attach Socket.IO to HTTP server with JWT handshake authentication; create `org:{orgId}` and `user:{userId}` rooms. |
| **`emitChange` + Mongoose Hooks** | Event emitter only used internally for workflows | Create centralized `emitChange()` utility; attach Mongoose post-save/update/delete hooks across core models to emit `entity:changed`. Emit `session:revoked` and `notification:new`. |
| **Idempotency (`X-Client-Mutation-Id`)** | Not implemented | Add idempotency middleware with 24-hour TTL Mongo collection (`client_mutations`), echo `clientMutationId` in realtime events. |
| **Cursor Pagination & `updatedSince`** | Only page-based pagination (`page`, `limit`) | Add cursor-based pagination (`cursor`, `limit`) and `updatedSince` query filters to `leads`, `contacts`, `accounts`, `deals`, `tasks`. |
| **Optimistic Concurrency & 409 Conflict** | PATCH endpoints overwrite without version check | Add `updatedAt` / `version` concurrency check on PATCH endpoints returning `409 Conflict` with the latest record on drift. |
| **Aggregation Endpoints (Spec 2.1)** | Only basic `/dashboard/summary` and `/reports/*` exist | Add mobile-aligned endpoints: `GET /dashboard/summary` with `scope` & `range`, `GET /reports/sales-trend`, `GET /reports/stage-analysis`, `GET /reports/kpis`, `GET /lead-sources/summary`. |
| **Device Registration & Push Sender** | No device registration endpoints or push service | Add `POST/DELETE /users/me/devices`, `Device` model, and Expo Push notification sender service. |
| **Missing Model Fields** | Missing: Lead rating (`hot`\|`warm`\|`cold`), Task type (`call`\|`email`\|`meeting`\|`document`\|`todo`) | Add `rating` to Lead model, add `type` to Task model, update validations, web forms, and shared types. |
| **Web Realtime Consumer (`useRealtime`)** | Web app does not subscribe to WebSockets | Create `useRealtime` hook in web frontend connecting via `socket.io-client` with TanStack Query cache invalidations. |
