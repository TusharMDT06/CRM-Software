import { getTenantContext } from './tenantContext.js';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  requestId?: string;
  tenantId?: string;
  userId?: string;
  meta?: Record<string, any>;
  error?: string;
  stack?: string;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'jwt',
  'apiKey',
  'secret',
  'authorization',
  'resendApiKey',
  'creditCard',
  'cvv',
]);

function maskSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitiveData);

  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase()) || key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      cleaned[key] = maskSensitiveData(val);
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

function writeLog(level: LogEntry['level'], message: string, meta?: Record<string, any>, err?: Error | unknown) {
  const ctx = getTenantContext();
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    requestId: ctx?.requestId,
    tenantId: ctx?.tenantId,
    userId: ctx?.user?._id?.toString(),
  };

  if (meta) {
    entry.meta = maskSensitiveData(meta);
  }

  if (err instanceof Error) {
    entry.error = err.message;
    if (process.env.NODE_ENV !== 'production') {
      entry.stack = err.stack;
    }
  } else if (err) {
    entry.error = String(err);
  }

  if (process.env.NODE_ENV === 'test') {
    // Keep test logs clean unless error
    if (level === 'error') {
      console.error(JSON.stringify(entry));
    }
    return;
  }

  // Structured JSON output
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (message: string, meta?: Record<string, any>) => writeLog('info', message, meta),
  warn: (message: string, meta?: Record<string, any>) => writeLog('warn', message, meta),
  error: (message: string, err?: Error | unknown, meta?: Record<string, any>) => writeLog('error', message, meta, err),
  debug: (message: string, meta?: Record<string, any>) => writeLog('debug', message, meta),
};
