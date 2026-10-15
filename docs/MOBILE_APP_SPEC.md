# FlowDesk Mobile App — Master Spec

> Save this file in the repo as `docs/MOBILE_APP_SPEC.md`. Every build prompt tells the agent to read it first.
> It is the single source of truth for architecture, data sync, design tokens, animation and screens.

---

## 0. Rules for the AI agent (read first)

1. The mobile app is a **second client of the EXISTING FlowDesk CRM** (web app + Express + MongoDB). Do **not** create a new backend, a new database, or mobile-only data. Same users, same organisation, same records.
2. Before writing any mobile code, **audit the repo** and write findings to `docs/MOBILE_AUDIT.md`: where the web frontend, backend, Mongoose models, routes, auth (JWT/cookies), roles/permissions, Resend email code, SMS provider code and lead-capture webhooks (Google Ads / Facebook / Instagram) live. Reuse what exists. Extend only when mobile needs it, and keep web working.
3. No mock data in the final app. Every number, name and chart on screen comes from the API. (Temporary fixtures are allowed only while an endpoint is being built, and must be removed in the same phase.)
4. Decide yourself; ask the user a question only if you are truly blocked.
5. Work in phases. At the end of each phase update `docs/MOBILE_PROGRESS.md` (done / not done / known issues / how to run).
6. Do not set up Playwright or e2e testing for now. Keep TypeScript strict, ESLint clean, and run a type-check before finishing each phase.
7. Email sending uses **Resend** (already used by the web CRM). Do not add nodemailer.
8. If a field shown in the mobile design does not exist in the data model (for example lead rating Hot/Warm/Cold, lead source, deal expected close date), add it to the backend model **and** the web UI **and** the shared types. Never create mobile-only fields.

---

## 1. Stack (decided)

| Area | Choice |
|---|---|
| App | Expo (latest stable SDK) + React Native + TypeScript (strict), **development build** (`expo-dev-client`), not Expo Go |
| Routing | expo-router (file based) |
| Server state | TanStack Query v5, cache persisted with `@tanstack/query-async-storage-persister` + AsyncStorage |
| UI state | Zustand (session, UI prefs only) |
| Forms | react-hook-form + zod (schemas come from the shared package) |
| Animation | react-native-reanimated 3 + react-native-gesture-handler |
| Charts | react-native-svg, hand-built donut / line / bars (to match the design exactly) |
| Lists | @shopify/flash-list for long lists |
| Icons | lucide-react-native (stroke width 1.8) |
| Font | @expo-google-fonts/plus-jakarta-sans (400, 500, 600, 700, 800) |
| Network | axios (interceptors), socket.io-client, @react-native-community/netinfo |
| Device | expo-secure-store, expo-notifications, expo-haptics, expo-linking, expo-local-authentication (optional biometric lock) |
| Builds | EAS (development, preview, production profiles) |

Folder: put the app in `/mobile` (or `apps/mobile` if the repo is already a monorepo). Put shared types in `/shared` (or `packages/shared`) — see 2.1.

Env: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SOCKET_URL`. No secrets inside the app bundle.

---

## 2. One data, two clients — sync architecture (most important requirement)

**Principle:** when a user adds, edits or deletes anything on the web, the same change must appear in the mobile app automatically (and the other way round). The mobile app never owns data; it only caches it.

### 2.1 Shared API contract
- All mobile requests use the same REST endpoints as the web. Do not fork endpoints.
- Create a `shared` package (npm/pnpm workspace if the repo is not one yet) containing zod schemas + TypeScript types for: `User`, `Role`, `Lead`, `Contact`, `Account`, `Deal`, `Task`, `Message`, `LeadSource`, `Notification`, and the realtime event payload. Web, server and mobile import from it so they cannot drift.
- Add, backward compatible, where missing: cursor pagination (`?cursor=&limit=`), `?updatedSince=ISO`, server-side search and filters on list endpoints, `updatedAt` on every document, and `PATCH` (partial update) for every entity.
- Aggregation endpoints the mobile dashboard and reports need (build them once, let the web dashboard reuse them):
  - `GET /dashboard/summary?scope=me|team&range=week|month|quarter|year` → leads, deals, contacts, revenue, each with value + % change vs previous period, plus pipeline counts by stage and the "up next" task.
  - `GET /reports/sales-trend`, `GET /reports/stage-analysis`, `GET /reports/kpis` (win rate, average deal size, sales cycle days)
  - `GET /lead-sources/summary?range=` → leads by source, total, new this week + delta, connected channels with status.

### 2.2 Realtime (server → every client)
- Attach **Socket.IO** to the existing HTTP server. Authenticate the handshake with the same JWT. Each socket joins `org:{orgId}` and `user:{userId}`.
- Create one helper, `emitChange({ entity, action, id, orgId, actorId, clientMutationId, updatedAt })`, and make sure **every** write path calls it, including: normal API writes, bulk updates/imports, lead-capture webhooks (Google Ads / Facebook / Instagram / website form), inbound SMS webhook, automations/cron. Easiest way to guarantee nothing is missed: Mongoose middleware (`post('save')`, `post('findOneAndUpdate')`, `post('deleteOne')`, `post('insertMany')`); for `updateMany` / `deleteMany` emit `{ action: 'bulk' }` so clients refetch lists.
- Event: `entity:changed` with `entity: 'lead'|'contact'|'account'|'deal'|'task'|'message'|'user'|'leadSource'` and `action: 'created'|'updated'|'deleted'|'bulk'`.
- Event: `notification:new` (to `user:{id}`) and `session:revoked` (password change, role change that removes access, forced logout, user deactivated).
- Clients (mobile **and web** — add a small `useRealtime` hook to the web app if it does not subscribe yet) react like this:
  - Event from another actor → invalidate the entity's list + detail queries (debounce 250 ms). If the event carries the document, patch the cache directly instead.
  - Event whose `clientMutationId` equals one this client just sent → ignore (no duplicate refetch).
  - Row that changed from a realtime event gets a short highlight (see animation 4.10) so the sync is visible.
- Fallbacks so data is never stale: refetch active queries on app foreground (AppState), on network reconnect (NetInfo), on socket reconnect, pull-to-refresh on every list, `staleTime` 30 s.

### 2.3 Offline and conflicts
- **Reads:** persisted cache → the app opens instantly with last known data and shows a subtle "Offline" banner when there is no network.
- **Writes:** optimistic update + rollback on error. Offline queue (replayed in order on reconnect) for: complete task, add note, update lead status/rating, move deal stage, create task. Sending SMS/email requires network (show clear error).
- Every mutation sends header `X-Client-Mutation-Id` (uuid). Server stores it with a 24 h TTL index and returns the original response on replay (idempotency).
- Always send **PATCH with only the changed fields**, never a full document, so two people editing different fields never overwrite each other.
- Concurrency: send `version`/`updatedAt` for risky edits; server answers `409` with the latest document → app shows a toast "Updated on web — review", refreshes the record, no silent data loss.
- Deleted-on-web while open on mobile: detail screen shows a "This record was removed" state with a back button.

### 2.4 Auth and roles
- Same login endpoint and JWT access + refresh tokens. Store in `expo-secure-store`. Axios interceptor with single-flight refresh. If refresh fails → clear session → Login.
- `GET /auth/me` returns user, role and permissions. Mobile hides/disables UI by permission; the **server stays the authority**. Never filter data only on the client — call the same endpoints so server-side scoping (Sales Rep sees own/assigned records, Manager sees team, Admin sees all — follow whatever the web already enforces) applies automatically.
- Roles shown in the design: Admin, Manager, Sales Rep. Map to the roles that already exist.
- Login methods: Email + password is required. Show "Google" and "Phone OTP" buttons **only if the backend already supports them**; otherwise hide them.
- Optional biometric lock (Face/Touch ID) after app is backgrounded 2 min — user setting in More.

### 2.5 Push notifications
- On login register the device: `POST /users/me/devices { expoPushToken, platform, appVersion }`; on logout remove it.
- Server sends push (Expo push service or FCM) for: lead assigned to me, new lead captured from ads/website (owner + admins, same rules as web notifications), task due in 30 min and overdue, deal stage changed on my deals, inbound SMS reply, @mention.
- Respect the **same notification preferences** as web (one preferences document per user).
- Tap on a push → deep link `flowdesk://leads/:id`, `flowdesk://deals/:id`, `flowdesk://tasks/:id`, `flowdesk://messages/:threadId`.

---

## 3. Design system (approved prototype)

### Colours
```
ink        #14141A     (primary / app bars / primary buttons)
ink-2      #2A2A32     (buttons on ink bars)
bg         #F6F6F3     (screen background)
surface    #FFFFFF
border     #E6E5DF     divider #EEEDE8
text       #14141A     text-2 #3D3C38     muted #6B6A66     disabled #9A9993

blue    #2F6FED  text #1F55C7  tint #E7EEFB / #DCE8FF
orange  #F2711C  text #A54708  tint #FFEEDF / #FFE3D0   (avatar text #9A3412)
purple  #7C5CFC  text #5B3FD6  tint #EFEBFF / #EBE5FF   (avatar text #4C2FC0)
green   #22A06B  text #12724B  tint #E2F5EA / #D5F0E1

Hot  bg #FDE8E6 text #B42318
Warm bg #FFEEDA text #A54708
Cold bg #E3ECFC text #1D4ED8
```
Chart category order (fixed, never cycled): blue, orange, purple, green. Orange has low contrast on white, so charts always show visible labels/values next to colours.

### App bar colour per screen (white text)
Home, Leads, Deals, Contacts, Reports, More, Team → `#14141A` · Tasks → `#12724B` · Accounts → `#1F55C7` · Lead Sources → `#C2410C` · Messages → `#5B3FD6`. Secondary button on a coloured bar: a darker shade of that bar colour (`#2A2A32` on ink).

### Type (Plus Jakarta Sans)
Screen title 22/800 (letter-spacing −0.3) · section title 15/800 · row title 14–15/800 · meta 12–13/500 muted · KPI 30/800 (−0.5) · big money 26/800 · tab label 11/600 (active 800) · badges 11–12/800.

### Shape and spacing
Cards radius 18 · list rows 16 · inputs 14 · chips 17 · badges 10 · avatar full circle · tab pill 15. Screen padding 16 (app bar 20). Gap between cards 12, between list rows 8. Touch targets ≥ 44.

### Components to build once
`AppBar`, `TabBar` (custom: 5 tabs, active icon sits in a 52×30 ink pill with white icon, label 800), `SegmentedChips`, `UnderlineTabs`, `SearchInput`, `Avatar` (initials on tint colour chosen deterministically from the id: orange, purple, blue, green), `Badge`, `SourceChip`, `KpiCard`, `Card`, `ListRow`, `ProgressBar`, `Donut`, `LineChart`, `BarList`, `Checkbox`, `EmptyState`, `ErrorState`, `Skeleton`, `OfflineBanner`, `Toast`, `BottomSheet`.

### Helpers
`formatINR` (Indian grouping: ₹1,20,000), `formatCompactINR` (₹85K, ₹12.5L, ₹1.2Cr), `relativeTime` (Today 10:30 AM / Yesterday / 2 days ago / 14 Oct), time zone from the user's profile (default Asia/Kolkata).

Icons (lucide): Home, Funnel (Leads), Briefcase (Deals), User (Contacts), LayoutGrid (More), Bell, Plus, Search, Phone, MessageSquare, Mail, CheckSquare, Building2, Target (Lead Sources), Users (Team), BarChart3 (Reports), SlidersHorizontal (Settings), LogOut, ChevronRight, ChevronDown.

---

## 4. Animation spec (must match the approved prototype)

Use Reanimated 3, animate only `transform` and `opacity`. Easing: `Easing.bezier(0.2, 0.75, 0.25, 1)` unless stated.

1. **Screen entrance** (plays once, after the first real data arrives — never on top of skeletons): app bar slides down 24 px + fades in (550 ms); content blocks rise 16 px + fade (600 ms), staggered 70 ms starting at 100 ms; inner items (list rows, KPI cards, columns) stagger 70 ms starting at 300 ms, capped at the first 8 items; tab bar rises 40 px + fades (550 ms, delay 50 ms).
2. **Active tab pill** pops in (scale 0.4→1, spring with slight overshoot, delay 400 ms). Switching tabs slides the pill.
3. **Donut** (dashboard + reports): rotates in from −150° and scale 0.5→1 with fade (1000 ms, delay 450 ms).
4. **Line chart** (reports): path draws with `strokeDashoffset` (1400 ms ease-out), end dot + value label pop with a spring at ~1.8 s.
5. **Bars** (lead sources, team targets, task progress): grow from 0 to value (1000 ms), staggered 100 ms.
6. **KPI numbers** count up from 0 to value (900 ms ease-out) the first time they appear, and animate from old value to new value whenever a realtime update changes them.
7. **Press feedback**: every pressable scales to 0.96 with a spring; light haptic on primary actions.
8. **Underline tabs / segmented chips**: the indicator slides between tabs (250 ms).
9. **Task checkbox**: circle fills green, check mark draws (200 ms), title strikes through, progress bar and "x of y done" update together.
10. **Realtime highlight**: a row/card changed by someone else flashes its tint colour and fades over 1.2 s; new rows slide in with layout animation; deleted rows collapse out. This is what makes web→mobile sync visible.
11. **Deals pipeline**: stage columns are horizontally paged; long-press a card to drag it into another column (gesture handler + reanimated); on drop it springs into place, `PATCH` the stage, column totals tick.
12. **Ambient**: login logo floats ±6 px (4.5 s loop); notification bell dot pulses (2 s loop).
13. **Loading**: shape-matched skeleton shimmer (1.2 s loop) for every screen.
14. **Reduce motion** (`useReducedMotion`): disable everything except short opacity fades.
15. Long lists: only the items in the first viewport use the entrance animation; later items just appear.

---

## 5. Navigation and screens

### 5.1 Structure (expo-router)
```
app/(auth)/login.tsx
app/(tabs)/_layout.tsx            custom TabBar: Home · Leads · Deals · Contacts · More
app/(tabs)/index.tsx              Dashboard
app/(tabs)/leads/index|[id]|new
app/(tabs)/deals/index|[id]|new
app/(tabs)/contacts/index|[id]|new
app/(tabs)/more/index.tsx         menu
app/(tabs)/more/reports | tasks | accounts(+[id]) | lead-sources | messages(+thread/[id]) | team | settings
```
Screens opened from More keep the tab bar visible with **More** active.
Detail and form screens are not in the prototype but are required: Lead, Deal, Contact, Account detail (ink app bar with back, info cards, quick actions Call / SMS / Email / WhatsApp, activity timeline of notes, calls, emails, stage changes, edit in a bottom sheet) and create/edit forms. Build them in the same visual style.

### 5.2 The 12 screens (data → UI)

1. **Login** — ink hero with logo (two wave strokes in a white rounded square), "FlowDesk" + orange CRM tag, tagline; email + password inputs (focus ring), Sign In (ink), Forgot password, optional Google / Phone OTP, Sign Up link only if the web has sign-up.
2. **Dashboard** — greeting by time of day + user's first name, "n follow-ups due today"; chips My Dashboard / Team (Manager+Admin only) / Activity; 4 KPI cards (Leads blue, Deals orange, Contacts purple, Revenue green) with % change; Sales Pipeline donut + legend with counts per stage; "Up next" card (next due task/call with call button); bell → notifications list; avatar → More. Source: `/dashboard/summary`.
3. **Leads** — search (debounced, server side), chips All / Hot / Warm / Cold with counts, rows: avatar, name, company, source chip, relative created time, rating badge. Infinite scroll (cursor), pull to refresh, swipe row → call / SMS, "+" → new lead form, filter sheet (owner, source, status).
4. **Deals** — tabs Pipeline / List / Forecast. Pipeline: paged stage columns (stage name tinted, ₹ total · deal count) with cards (company, amount, contact, close date) and drag-to-move. List: flat, sortable. Forecast: weighted amount by month/stage. Stage names/order come from the backend (same as web Kanban).
5. **Contacts** — search, chips All / Customers / Prospects / Partners, rows with avatar, name, role · company, email, call button (disabled and muted if no phone).
6. **Reports** — period selector (Week / Month / Quarter / Year), Sales Trend card (total + delta + line chart), Deal Stage Analysis (donut + % legend), three tiles: Win rate, Avg. deal, Sales cycle.
7. **More** — profile card (avatar, name, role badge) → profile/settings; 2×3 tiles: Reports, Tasks (due today), Accounts (count), Lead Sources, Messages (unread), Team and Roles; list: Help and support, Sign out. Settings: notification preferences, biometric lock.
8. **Tasks** (green bar) — tabs Today / Upcoming / Overdue; progress card ("1 of 6 done" + bar); rows: checkbox, title, related contact/company · type (Call, Email, Meeting, Document), time, red Overdue badge; add task; swipe to snooze / delete.
9. **Accounts** (blue bar) — two stat tiles (total accounts, lifetime value), search, rows: letter tile, company, industry · city, ₹ revenue, deals count.
10. **Lead Sources** (orange bar) — period selector; "New leads this week" + delta; Leads by source (horizontal bars sorted high→low with values and total); Connected channels (Google Ads, Facebook Lead Ads, Instagram, Website Form) with status dot + text Connected / Setup needed. Connecting or editing a channel happens on web: show a "Finish setup on web" action that opens the web URL.
11. **Messages** (purple bar) — tabs SMS / Email / Templates; search; conversation rows with avatar, name, last message preview, time, unread badge, delivery tick for outgoing. Thread screen: bubbles, composer, template picker, send via the existing SMS endpoint and the existing Resend email endpoint; inbound messages arrive in realtime.
12. **Team and Roles** (ink bar) — team target card (₹ achieved of target + % + bar) for Admin/Manager; member rows with avatar, name, role badge (Admin ink, Manager purple, Sales Rep blue), target % bar; "Invite team member" and role change for Admin only (same server rules as web); other roles see a read-only list.

Every screen needs: loading skeleton, empty state, error state with retry, offline behaviour, pull-to-refresh, and the entrance animation from section 4.

---

## 6. Backend additions checklist (only what is missing)
- Socket.IO server + `emitChange` + Mongoose hooks + `session:revoked`
- `/sync/changes?since=ISO` (optional catch-up endpoint after long disconnects)
- Device registration endpoints + push sender service
- Idempotency middleware for `X-Client-Mutation-Id`
- Cursor pagination, `updatedSince`, search/filter params, PATCH endpoints, `version`/`updatedAt` conflict check
- Dashboard / reports / lead-sources aggregation endpoints (shared with web)
- Notification preferences shared by web and mobile

## 7. Quality bar
- TypeScript strict, no `any`, ESLint clean, error boundary at root.
- Accessibility labels on every icon button, dynamic text up to 130% without clipping.
- Light theme only for now.
- Cold start < 2 s with cached data; lists scroll at 60 fps.
- App name FlowDesk, scheme `flowdesk`, bundle id placeholder `com.flowdesk.crm`; icon = white rounded square with two ink wave strokes on ink background.

## 8. Acceptance checklist (manual — run it at the end and fix failures)
**Sync**
1. Edit a lead's name on web → the row on mobile updates within 2 s and flashes.
2. Create a lead on mobile → appears on the web list live.
3. Move a deal stage on mobile → the web Kanban card moves; totals update on both.
4. Complete a task on web → mobile progress bar and counts update.
5. A lead arrives from an ads webhook → new row on mobile, push notification, Dashboard Leads KPI counts up.
6. Change a user's role on web → mobile permissions change; deactivate/password-change → mobile is logged out immediately.
7. Airplane mode → cached data visible with the Offline banner; complete a task offline → it syncs after reconnect and web shows it.
8. Edit the same lead field on web and mobile at once → conflict toast, no data lost.
9. Delete a record on web while it is open on mobile → "This record was removed" state.

**Design and motion**
10. Each screen matches section 3 tokens and section 5 layout.
11. All animations in section 4 are present; reduce-motion works.
