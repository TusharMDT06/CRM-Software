import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
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
import { registerWorkflowListeners } from './utils/workflowEngine.js';
import { initCronJobs } from './utils/scheduler.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' })); // Support logo uploads up to 1MB safely

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Routes
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

// Phase 3 Routes
app.use('/api/products', productsRouter);
app.use('/api/settings/company', companySettingsRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/audit-log', auditLogRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/automations', workflowsRouter);
app.use('/api/workflows', workflowsRouter);

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
      console.log(`[Flowdesk Server] Running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Flowdesk Server] Failed to start:', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test' && !process.env.FLOWDESK_TEST) {
  startServer();
}

export default app;
