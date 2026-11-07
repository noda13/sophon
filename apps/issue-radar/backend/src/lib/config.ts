import 'dotenv/config';
import { z } from 'zod';

const baseSchema = z.object({
  GROQ_API_KEY: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  LLM_PROVIDER: z.string().default('groq'),
  LLM_MODEL: z.string().default(''),
  RSSHUB_URL: z.string().default('https://rsshub.app'),
  PORT: z.coerce.number().int().positive().default(8902),
  DATABASE_URL: z.string().default('file:./prisma/dev.db'),
  ADMIN_API_KEY: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
  NODE_ENV: z.string().default('development'),
});

// In production, ADMIN_API_KEY must be set and at least 32 characters
const prodExtension = z.object({
  ADMIN_API_KEY: z.string().min(32, 'ADMIN_API_KEY must be at least 32 characters in production'),
});

function parseConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const schema = isProduction ? baseSchema.merge(prodExtension) : baseSchema;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    console.error('[Config] Invalid configuration:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

const env = parseConfig();

export const config = {
  groqApiKey: env.GROQ_API_KEY,
  geminiApiKey: env.GEMINI_API_KEY,
  openaiApiKey: env.OPENAI_API_KEY,
  llmProvider: env.LLM_PROVIDER,
  llmModel: env.LLM_MODEL,
  rsshubUrl: env.RSSHUB_URL,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  adminApiKey: env.ADMIN_API_KEY,
  corsOrigins: env.CORS_ORIGINS,
} as const;
