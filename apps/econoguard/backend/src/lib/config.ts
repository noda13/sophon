import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

const schema = z
  .object({
    PORT: z.coerce.number().int().positive().default(8901),
    // An enum, not a free string: a typo such as 'prod' would otherwise skip the production checks below.
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    // LLM providers
    GEMINI_API_KEY: z.string().optional().default(''),
    GEMINI_MODEL: z.string().optional().transform((v) => v?.trim() || DEFAULT_GEMINI_MODEL),
    OLLAMA_BASE_URL: z.string().optional().default('http://host.docker.internal:11434'),
    OLLAMA_MODEL: z.string().optional().default('qwen2.5:7b'),
    // Data sources
    NEWSAPI_KEY: z.string().optional().default(''),
    FRED_API_KEY: z.string().optional().default(''),
    OPENEXCHANGERATES_APP_ID: z.string().optional().default(''),
    // Database — required (Prisma also reads this directly, but we surface it for validation)
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    // Auth — enforced in production by the refinement below
    ADMIN_SECRET: z.string().optional().default(''),
    // CORS — comma-separated list of allowed origins; enforced in production by the refinement below
    ALLOWED_ORIGINS: z.string().optional().default(''),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    for (const key of ['ADMIN_SECRET', 'ALLOWED_ORIGINS'] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required in production`,
        });
      }
    }
  });

const result = schema.safeParse(process.env);
if (!result.success) {
  console.error('Invalid environment configuration:');
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const env = result.data;

export const config = {
  port: env.PORT,
  // LLM providers
  geminiApiKey: env.GEMINI_API_KEY,
  geminiModel: env.GEMINI_MODEL,
  ollamaBaseUrl: env.OLLAMA_BASE_URL,
  ollamaModel: env.OLLAMA_MODEL,
  // Data sources
  newsApiKey: env.NEWSAPI_KEY,
  fredApiKey: env.FRED_API_KEY,
  openExchangeRatesAppId: env.OPENEXCHANGERATES_APP_ID,
  // Auth
  adminSecret: env.ADMIN_SECRET,
  // CORS — parsed into a string[] for direct use in cors() origin checks
  allowedOrigins: env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : [] as string[],
};
