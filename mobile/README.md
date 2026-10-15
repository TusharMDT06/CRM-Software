# FlowDesk Mobile CRM (React Native / Expo)

Production-ready mobile client for FlowDesk CRM, built with **Expo SDK 52**, **Expo Router v4**, **TanStack Query v5**, **Zustand**, and **Reanimated 3**.

---

## 1. How to Run Locally

### Prerequisites
- Node.js >= 18 (Node 22 supported)
- Backend server running on port `5000`

### Step 1: Install Dependencies
```bash
cd mobile
npm install
```

### Step 2: Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env`:
```bash
# For physical phone testing, use your PC's LAN IP (e.g. http://192.168.1.50:5000)
EXPO_PUBLIC_API_URL=http://localhost:5000/api
EXPO_PUBLIC_SOCKET_URL=http://localhost:5000
```

### Step 3: Start the Development Server
```bash
npm start
```
- Press `w` to open in browser (web preview at `http://localhost:8081`).
- Press `a` to open Android Emulator.
- Press `i` to open iOS Simulator.
- Scan the QR code with **Expo Go** on your physical iOS/Android phone.

---

## 2. How to Build with EAS

FlowDesk includes predefined build profiles in `mobile/eas.json` for development, internal staging preview, and production app store release.

### Prerequisites
Install EAS CLI globally and log in to Expo:
```bash
npm install -g eas-cli
eas login
```

### Build Commands

```bash
# 1. Development Build (with native code & debugging tools)
eas build --profile development --platform android
eas build --profile development --platform ios

# 2. Preview Build (Internal testing APK / Ad-Hoc iOS build)
eas build --profile preview --platform android
eas build --profile preview --platform ios

# 3. Production App Store Build (AAB for Google Play / IPA for Apple App Store)
eas build --profile production --platform all
```

To run native builds locally without EAS Cloud:
```bash
npx expo run:android
npx expo run:ios
```

---

## 3. Environment Variables

| Variable | Description | Default / Example |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of the REST API (with `/api` suffix) | `http://localhost:5000/api` |
| `EXPO_PUBLIC_SOCKET_URL` | Socket.IO server URL | `http://localhost:5000` |

---

## 4. How Realtime Sync & Offline Mode Work

### Architecture Overview
```
┌──────────────┐                  ┌─────────────────┐
│   Backend    │──Socket.IO emit─▶│ Mobile App      │
│  (Mongoose   │◀─REST (Mutation)─│ (TanStack Query │
│   Hooks)     │                  │  + NetInfo)     │
└──────────────┘                  └─────────────────┘
                                           │
                                  Offline Fallback
                                           ▼
                                 ┌───────────────────┐
                                 │ Offline Queue     │
                                 │ (AsyncStorage     │
                                 │  FIFO Replay)     │
                                 └───────────────────┘
```

1. **Optimistic Updates:** When an action occurs (e.g. completing a task, moving a deal stage, or adding a note), the UI updates instantly via TanStack Query's cache.
2. **Offline Mutation Queue (`src/offline/mutationQueue.ts`):** If the network is down (`NetInfo.isConnected === false` or `Network Error`), mutations are stored in `AsyncStorage` with a unique `clientMutationId`.
3. **Sequential FIFO Replay:** When connectivity is restored, mutations are replayed sequentially in FIFO order with the header `X-Client-Mutation-Id`.
4. **Idempotency:** The backend's `idempotency.ts` middleware verifies `ClientMutation` records, preventing duplicate processing if a network drop occurred mid-request.
5. **Realtime Invalidation:** Server database changes fire Mongoose post-save hooks, emitting `entity:changed` to all tenant sockets. The client receives this event, triggers a 1.2s flash highlight, and invalidates active queries.
6. **Conflict Handling (HTTP 409):** If record versions drift on the server, the backend returns 409 with the current document. The client shows `"Updated on web — review"`, refreshes the cache, and keeps dirty form inputs intact so unsaved edits aren't lost.

---

## 5. How to Add a New Entity So It Syncs Automatically

Adding a new entity (e.g. `Ticket`, `Invoice`, or `Product`) to sync across web and mobile requires 5 clean steps:

### Step 1: Define Shared Types (`packages/shared/`)
Add the entity TypeScript interface and update `EntityChangedPayload`:
```ts
// packages/shared/src/types/index.ts
export interface Ticket {
  _id: string;
  ticketNumber: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  updatedAt: string;
}

export type EntityType = 'lead' | 'deal' | 'contact' | 'account' | 'task' | 'ticket';
```

### Step 2: Enable Realtime Plugin on Server Model (`server/src/models/`)
Attach the existing `realtimePlugin`:
```ts
// server/src/models/Ticket.ts
import { realtimePlugin } from '../utils/realtimePlugin.js';

TicketSchema.plugin(realtimePlugin, { entity: 'ticket' });
```
*Every `save()` or `findByIdAndUpdate()` will now automatically broadcast `entity:changed`.*

### Step 3: Register Query Keys (`mobile/src/api/queryKeys.ts`)
```ts
export const queryKeys = {
  // ...
  tickets: {
    all: ['tickets'] as const,
    lists: () => [...queryKeys.tickets.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.tickets.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.tickets.all, 'detail', id] as const,
  },
};
```

### Step 4: Map Realtime Invalidation (`mobile/src/realtime/useRealtimeSync.ts`)
Add the entity to `ENTITY_INVALIDATION_MAP`:
```ts
const ENTITY_INVALIDATION_MAP: Record<string, (readonly unknown[])[]> = {
  // ...
  ticket: [queryKeys.tickets.all, queryKeys.dashboard.all],
};
```

### Step 5: Consume in Mobile Screens (`mobile/app/`)
Use `useQuery` and `useMutation` with `enqueueOfflineMutation`:
```tsx
const { data: tickets } = useQuery({
  queryKey: queryKeys.tickets.list({ status: 'open' }),
  queryFn: fetchTickets,
});
```
*Your new entity now automatically updates in realtime, highlights when updated by colleagues, and syncs offline!*
