import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('flowdesk_super_secret_jwt_key_2026_crm'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Flowdesk <onboarding@resend.dev>'),
  AUDIT_RETENTION_DAYS: z.coerce.number().default(365),
  AI_MODEL: z.string().default('gemini-2.0-flash'),
  AI_MODEL_FAST: z.string().default('gemini-2.0-flash-lite'),
  GEMINI_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env;

try {
  parsedEnv = envSchema.parse({
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flowdesk',
    JWT_SECRET: process.env.JWT_SECRET,
    CLIENT_URL: process.env.CLIENT_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    AUDIT_RETENTION_DAYS: process.env.AUDIT_RETENTION_DAYS,
    AI_MODEL: process.env.AI_MODEL,
    AI_MODEL_FAST: process.env.AI_MODEL_FAST,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  });
} catch (error: any) {
  if (error instanceof z.ZodError) {
    console.error('❌ [Fatal] Environment variable validation failed:');
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
  } else {
    console.error('❌ [Fatal] Unexpected error validating env:', error);
  }
  process.exit(1);
}

export const env = parsedEnv;
