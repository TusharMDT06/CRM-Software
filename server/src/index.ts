import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import crypto from 'crypto';
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
import { registerWorkflowListeners } from './utils/workflowEngine.js';
import { initCronJobs } from './utils/scheduler.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = env.PORT || 5000;

// Security & Middlewares
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", env.CLIENT_URL],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: env.CLIENT_URL || 'http://localhost:5173',
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
    if (req.path !== '/api/health' && req.path !== '/api/ready') {
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

// Health check endpoints
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/ready', (_req, res) => {
  const isDbReady = mongoose.connection.readyState === 1;
  if (isDbReady) {
    res.json({ status: 'ready', database: 'connected', time: new Date().toISOString() });
  } else {
    res.status(503).json({ status: 'not_ready', database: 'disconnected', time: new Date().toISOString() });
  }
});

// Business Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/deals', dealsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/emails', emailsRouter);
app.use('/api/custom-fields', customFieldsRouter);
app.use('/api/reports', reportsRouter);

// Phase 3 & 4 Platform Routes
app.use('/api/products', productsRouter);
app.use('/api/settings/company', companySettingsRouter);
app.use('/api/settings/tenant', tenantSettingsRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/audit-log', auditLogRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/automations', workflowsRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/platform', platformRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/support', supportPortalRouter);
app.use('/api/ai', aiRouter);
app.use('/api/marketing', marketingRouter);
app.use('/api/hooks', webhooksRouter);
app.use('/hooks', webhooksRouter);
app.use('/f', webhooksRouter);

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

    app.listen(PORT, () => {
      logger.info(`[Flowdesk Server] Running on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('[Flowdesk Server] Failed to start:', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test' && !process.env.FLOWDESK_TEST) {
  startServer();
}

// Export app for tests and server deployment
export default app;
