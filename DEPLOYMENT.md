# Flowdesk CRM - Deployment Guide

This document details the multi-tenant architecture, deployment procedure, production configuration, and disaster recovery processes.

---

## 1. Architecture Overview
- **Database**: MongoDB (v6+ / 7.0) with central multi-tenant isolation via Mongoose plugin.
- **Backend**: Express on Node.js 20 with TypeScript strict mode and AsyncLocalStorage request context.
- **Frontend**: React 18, Vite, TailwindCSS v3, Motion.
- **Email**: Resend API.
- **Security**: Helmet CSP, CORS from environment, express-rate-limit, structured JSON logging with request IDs.

---

## 2. Environment Variables

### Server (`server/.env`)
| Variable | Description | Example |
|---|---|---|
| `PORT` | HTTP port | `5000` |
| `NODE_ENV` | Environment | `production` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017/flowdesk` |
| `JWT_SECRET` | Secret key for JWT signing ($\ge 16$ chars) | `flowdesk_super_secret_jwt_key_2026_crm` |
| `CLIENT_URL` | Allowed CORS origin and public link host | `https://crm.yourdomain.com` |
| `RESEND_API_KEY` | Resend API key for transactional emails | `re_123456789...` |
| `EMAIL_FROM` | Default verified sender address | `Flowdesk <support@yourdomain.com>` |
| `AUDIT_RETENTION_DAYS`| Retention window for audit logs | `365` |

---

## 3. Migration & Platform Setup

### Step 1: Pre-Migration Backup (MANDATORY)
Take a complete MongoDB dump before running migrations:
```bash
mongodump --uri="mongodb://127.0.0.1:27017/flowdesk" --out="./backup-$(date +%Y%m%d%H%M%S)"
```

### Step 2: Run Multi-Tenancy Backfill
```bash
cd server
npm run migrate:tenants
```
This script:
1. Creates the default organization if absent.
2. Backfills `tenantId` across all existing collections.
3. Drops legacy indexes and creates compound indexes (`{ tenantId: 1, ... }`).
4. Is idempotent and safely re-runnable.

### Step 3: Create Platform Administrator
Platform administrators cannot be created via the public signup UI or API:
```bash
npm run platform:admin platform.admin@yourdomain.com YourSecurePassword "Super Admin"
```

---

## 4. Docker Deployment
```bash
# Build and run containers
docker-compose up -d --build

# Inspect logs
docker-compose logs -f server
```

---

## 5. Health & Monitoring Endpoints
- **Liveness probe**: `GET /api/health` $\rightarrow$ `{ "status": "ok", "time": "..." }`
- **Readiness probe**: `GET /api/ready` $\rightarrow$ `{ "status": "ready", "database": "connected" }`

---

## 6. Render Deployment Guide (Step-by-Step)

### Step 1: MongoDB Atlas Network Access Configuration (Crucial)
Render uses dynamic outbound IP addresses. For your Render Web Service to connect to MongoDB Atlas:
1. Log in to [MongoDB Atlas Console](https://cloud.mongodb.com/).
2. In the left sidebar, click **Security** $\rightarrow$ **Network Access**.
3. Click **+ Add IP Address**.
4. Click **Allow Access from Anywhere** (`0.0.0.0/0`) and click **Confirm**.

---

### Step 2: Deploy Backend as a Render Web Service
1. Log in to [Render](https://dashboard.render.com/) and click **New +** $\rightarrow$ **Web Service**.
2. Connect your Git repository.
3. Configure settings:
   - **Name**: `flowdesk-server` (or any name)
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Instance Type**: Free / Starter
4. Add **Environment Variables** under the "Environment" tab:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | `mongodb+srv://<username>:<password>@cluster.mongodb.net/flowdesk?retryWrites=true&w=majority` |
   | `JWT_SECRET` | `flowdesk_super_secret_jwt_key_2026_crm` |
   | `CLIENT_URL` | `https://flowdesk-client.onrender.com` *(replace with your Render client URL)* |
   | `RESEND_API_KEY` | `re_your_resend_api_key_here` |
   | `EMAIL_FROM` | `Flowdesk <onboarding@resend.dev>` |
5. Click **Create Web Service**. Your backend will deploy and become available at `https://flowdesk-server.onrender.com`.

---

### Step 3: Deploy Frontend as a Render Static Site
1. In the Render Dashboard, click **New +** $\rightarrow$ **Static Site**.
2. Connect the same repository.
3. Configure settings:
   - **Name**: `flowdesk-client`
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add **Environment Variables**:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://flowdesk-server.onrender.com/api` *(your Render server backend URL)* |
5. Add **Redirects / Rewrites** (under settings) for SPA routing:
   - **Type**: `Rewrite`
   - **Source**: `/*`
   - **Destination**: `/index.html`
6. Click **Create Static Site**.

