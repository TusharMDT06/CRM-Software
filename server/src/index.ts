import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { logger } from './utils/logger.js';
import { authRouter } from './routes/auth.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { leadsRouter } from './routes/leads.routes.js';
import { contactsRouter } from './routes/contacts.routes.js';
import { accountsRouter } from './routes/accounts.routes.js';
import { dealsRouter } from './routes/deals.routes.js';
import { tasksRouter } from './routes/tasks.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { activitiesRouter } from './routes/activities.routes.js';
import { emailsRouter } from './routes/emails.routes.js';
import { customFieldsRouter } from './routes/customFields.routes.js';
import { reportsRouter } from './routes/reports.routes.js';
import { productsRouter } from './routes/products.routes.js';
import { companySettingsRouter } from './routes/companySettings.routes.js';
import { quotesRouter } from './routes/quotes.routes.js';
import { invoicesRouter } from './routes/invoices.routes.js';
import { auditLogRouter } from './routes/auditLog.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { workflowsRouter } from './routes/workflows.routes.js';
import { platformRouter } from './routes/platform.routes.js';
import { tenantSettingsRouter } from './routes/tenantSettings.routes.js';
import { ticketsRouter } from './routes/tickets.routes.js';
import { supportPortalRouter } from './routes/supportPortal.routes.js';
import { aiRouter } from './routes/ai.routes.js';
import { marketingRouter } from './routes/marketing.routes.js';
import { webhooksRouter } from './routes/webhooks.routes.js';
import { syncRouter } from './routes/sync.routes.js';
import { messagesRouter, inboundSmsRouter } from './routes/messages.routes.js';
import { leadSourcesRouter } from './routes/leadSources.routes.js';
import { initSocketIO } from './realtime/socket.js';
import { idempotencyMiddleware } from './middleware/idempotency.js';
import { registerWorkflowListeners } from './utils/workflowEngine.js';
import { initCronJobs } from './utils/scheduler.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const server = http.createServer(app);
const PORT = env.PORT || 5000;

// Security & Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      const clientUrl = env.CLIENT_URL;
      const allowedOrigins = [
        clientUrl,
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
      ].filter(Boolean);

      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.onrender.com') ||
        origin.includes('render.com') ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }

      // Default allow any origin with credentials so Render deployments are never blocked
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '5mb' })); // Support logo uploads up to 1MB safely

// Request ID & Structured Logging Middleware
app.use((req, res, next) => {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.includes('/health') && !req.path.includes('/ready')) {
      logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
      });
    }
  });

  next();
});

// Direct APK download route for mobile installation
app.get('/FlowDesk.apk', (_req, res) => {
  const apkPath = path.resolve('../FlowDesk.apk');
  if (fs.existsSync(apkPath)) {
    res.download(apkPath, 'FlowDesk.apk');
  } else {
    res.status(404).send('FlowDesk.apk not found. Please build the APK first.');
  }
});

// Idempotency Middleware for mutating client requests (X-Client-Mutation-Id)
app.use(idempotencyMiddleware);

// Health check endpoints (available at both root and /api for all cloud providers)
const registerHealthEndpoints = (prefix: string) => {
  app.get(`${prefix}/health`, (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get(`${prefix}/ready`, (_req, res) => {
    const isDbReady = mongoose.connection.readyState === 1;
    if (isDbReady) {
      res.json({ status: 'ready', database: 'connected', time: new Date().toISOString() });
    } else {
      res.status(503).json({ status: 'not_ready', database: 'disconnected', time: new Date().toISOString() });
    }
  });
};

registerHealthEndpoints('/api');
registerHealthEndpoints('');

// Register business routes at both /api and root paths
// This guarantees compatibility whether VITE_API_URL includes /api or points to the base domain
const registerBusinessRoutes = (prefix: string) => {
  app.use(`${prefix}/auth`, authRouter);
  app.use(`${prefix}/users`, usersRouter);
  app.use(`${prefix}/leads`, leadsRouter);
  app.use(`${prefix}/contacts`, contactsRouter);
  app.use(`${prefix}/accounts`, accountsRouter);
  app.use(`${prefix}/deals`, dealsRouter);
  app.use(`${prefix}/tasks`, tasksRouter);
  app.use(`${prefix}/dashboard`, dashboardRouter);
  app.use(`${prefix}/activities`, activitiesRouter);
  app.use(`${prefix}/emails`, emailsRouter);
  app.use(`${prefix}/custom-fields`, customFieldsRouter);
  app.use(`${prefix}/reports`, reportsRouter);
  app.use(`${prefix}/products`, productsRouter);
  app.use(`${prefix}/settings/company`, companySettingsRouter);
  app.use(`${prefix}/settings/tenant`, tenantSettingsRouter);
  app.use(`${prefix}/quotes`, quotesRouter);
  app.use(`${prefix}/invoices`, invoicesRouter);
  app.use(`${prefix}/audit-log`, auditLogRouter);
  app.use(`${prefix}/notifications`, notificationsRouter);
  app.use(`${prefix}/automations`, workflowsRouter);
  app.use(`${prefix}/workflows`, workflowsRouter);
  app.use(`${prefix}/platform`, platformRouter);
  app.use(`${prefix}/tickets`, ticketsRouter);
  app.use(`${prefix}/support`, supportPortalRouter);
  app.use(`${prefix}/ai`, aiRouter);
  app.use(`${prefix}/marketing`, marketingRouter);
  app.use(`${prefix}/sync`, syncRouter);
  app.use(`${prefix}/messages`, messagesRouter);
  app.use(`${prefix}/lead-sources`, leadSourcesRouter);
  app.use(`${prefix}/hooks`, webhooksRouter);
};

registerBusinessRoutes('/api');
registerBusinessRoutes('');

app.use('/hooks', webhooksRouter);
app.use('/f', webhooksRouter);
app.use('/hooks/sms', inboundSmsRouter);
app.use('/api/hooks/sms', inboundSmsRouter);

// 404 handler for API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

// Global Error Handler
app.use(errorHandler);

// Connect DB & start listening
async function startServer() {
  try {
    await connectDB();

    // Register workflow engine event bus listeners
    registerWorkflowListeners();

    // Initialize background cron schedules
    initCronJobs();

    // Initialize Socket.IO realtime server
    initSocketIO(server);

    server.listen(PORT, () => {
      logger.info(`[Flowdesk Server] Running with Socket.IO on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('[Flowdesk Server] Failed to start:', error);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      logger.warn('[Flowdesk Server] Retrying server startup in 5 seconds...');
      setTimeout(startServer, 5000);
    }
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error('[Flowdesk Server] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
  logger.error('[Flowdesk Server] Uncaught Exception:', error);
});

if (process.env.NODE_ENV !== 'test' && !process.env.FLOWDESK_TEST) {
  startServer();
}

// Export app and server for tests and server deployment
export { server };
export default app;
