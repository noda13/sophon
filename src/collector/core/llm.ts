// AI SDK のリトライは Retry-After / retry-after-ms を尊重する（上限 60 秒。超えると指数バックオフに戻る）。
// msw で実測済み（llm.test.ts）なので p-retry では包まない。generateObject は v7 で非推奨のため generateText + Output.object を使う。
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { generateText, Output, type LanguageModel } from 'ai';
import type { z } from 'zod';
import { sanitizeError } from './sanitize.js';

export type LlmProvider = 'gemini' | 'groq';

export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  apiKey: string;
}

export interface GenerateOptions {
  system?: string;
  temperature?: number;
  /** リトライを含む総試行回数の上限。 */
  maxAttempts?: number;
  /** リトライ待ちを含む 1 回の呼び出し全体の timeout。 */
  timeoutMs?: number;
  config?: LlmConfig;
  /** timeoutMs と合成して渡す。abort されるとリトライも止まる。 */
  signal?: AbortSignal;
  /** 未指定ならプロバイダの既定に従う。 */
  maxOutputTokens?: number;
}

export const DEFAULT_MODELS: Record<LlmProvider, string> = {
  gemini: 'gemini-flash-latest',
  groq: 'openai/gpt-oss-120b',
};

export const LLM_DISABLED_ERROR = 'LLM disabled: no API key';
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_TIMEOUT_MS = 120_000;

type Env = Record<string, string | undefined>;

export function detectProvider(env: Env = process.env): LlmConfig | null {
  const keys: Record<LlmProvider, string | undefined> = {
    groq: env.GROQ_API_KEY || undefined,
    gemini: env.GEMINI_API_KEY || undefined,
  };
  // GitHub Actions は未設定の secret を空文字で渡すので、空は未設定として扱う。
  const requested = env.LLM_PROVIDER;
  const provider: LlmProvider | undefined =
    requested && requested in keys && keys[requested as LlmProvider]
      ? (requested as LlmProvider)
      : (['groq', 'gemini'] as const).find((p) => keys[p]);
  if (!provider) return null;
  return {
    provider,
    model: env.LLM_MODEL || DEFAULT_MODELS[provider],
    apiKey: keys[provider]!,
  };
}

export function isLlmAvailable(env: Env = process.env): boolean {
  return detectProvider(env) !== null;
}

function createModel(config: LlmConfig): LanguageModel {
  return config.provider === 'gemini'
    ? createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model)
    : createGroq({ apiKey: config.apiKey })(config.model);
}

/** キー未設定なら null を返す。失敗（リトライ尽き・schema 不一致・timeout）は throw する。 */
export async function generateStructured<T>(
  schema: z.ZodType<T>,
  prompt: string,
  opts: GenerateOptions = {},
): Promise<T | null> {
  const config = opts.config ?? detectProvider();
  if (!config) return null;

  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError(`maxAttempts must be a positive integer: ${maxAttempts}`);
  }

  const timeout = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const { output } = await generateText({
      model: createModel(config),
      output: Output.object({ schema }),
      system: opts.system,
      prompt,
      temperature: opts.temperature ?? 0.3,
      maxRetries: maxAttempts - 1,
      ...(opts.maxOutputTokens !== undefined && { maxOutputTokens: opts.maxOutputTokens }),
      abortSignal: opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout,
    });
    return output;
  } catch (error) {
    logLlmFailure(config, error);
    throw error;
  }
}

const DIAGNOSTIC_MAX_LENGTH = 2000;

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

// run.errors は 200 文字で切られ、provider が返した本文（Groq の failed_generation など）が残らない。
// 原因の切り分けにはこの本文が要るので、Actions のログ側に長めに残す。ログは公開されるため sanitizeError を通す。
function logLlmFailure(config: LlmConfig, error: unknown): void {
  try {
    // リトライが尽きると RetryError に包まれ、provider のエラーは lastError にある。
    const inner = field(error, 'lastError') ?? error;
    const body = field(inner, 'responseBody');
    const text = field(inner, 'text');
    const cause = field(inner, 'cause');
    const detail =
      typeof body === 'string' && body
        ? `responseBody: ${body}`
        : typeof text === 'string' && text
          ? `generated text: ${text}`
          : cause !== undefined
            ? `cause: ${cause instanceof Error ? cause.message : String(cause)}`
            : '';
    const status = field(inner, 'statusCode');
    const env = { ...process.env, [config.provider === 'groq' ? 'GROQ_API_KEY' : 'GEMINI_API_KEY']: config.apiKey };
    // message と本文は別々に上限を掛ける。message が長くても本文が切り落とされないようにするため。
    const clean = (value: string) => sanitizeError(value, env, DIAGNOSTIC_MAX_LENGTH);
    console.error(
      `[llm] ${config.provider}/${config.model} failed${typeof status === 'number' ? ` (status ${status})` : ''}`,
      `message: ${clean(error instanceof Error ? error.message : String(error))}`,
      ...(detail ? [clean(detail)] : []),
    );
  } catch {
    // 診断ログの失敗で元のエラーを隠さない。
  }
}
