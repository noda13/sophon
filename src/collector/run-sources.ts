import { appendFileSync } from 'node:fs';
import { SourceIdSchema, type Meta, type SourceId } from '../shared/schema/meta';
import { sourceDir } from './core/io';
import { beginRun, type RunHandle } from './core/meta';
import { sanitizeError } from './core/sanitize';
import type { SourceRegistry } from './core/source';

export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
export const ABORT_GRACE_MS = 5000;

export type SourceOutcome =
  | { source: SourceId; status: Meta['run']['status']; counts: Record<string, number>; errors: string[] }
  | { source: SourceId; status: 'unimplemented'; counts: Record<string, number>; errors: string[] };

export interface RunSourcesOptions {
  root?: string;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  abortGraceMs?: number;
  log?: (line: string) => void;
}

export interface RunSourcesResult {
  outcomes: SourceOutcome[];
  failedSources: SourceId[];
  exitCode: 0 | 1;
}

export const USAGE = `usage: pnpm collect <source...|all>\nsources: ${SourceIdSchema.options.join(', ')}`;

export function resolveSourceIds(args: string[]): SourceId[] | null {
  if (args.length === 0) return null;
  const ids: SourceId[] = [];
  for (const arg of args) {
    if (arg === 'all') {
      ids.push(...SourceIdSchema.options);
      continue;
    }
    const parsed = SourceIdSchema.safeParse(arg);
    if (!parsed.success) return null;
    ids.push(parsed.data);
  }
  return [...new Set(ids)];
}

export function resolveTimeoutMs(env: NodeJS.ProcessEnv): number {
  const raw = Number(env.COLLECT_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`timed out after ${ms}ms`);
  }
}

// Promise.race cannot cancel the loser, so the caller aborts the run's signal and waits briefly
// for it to settle; otherwise a late write would land after meta.json already says failed.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function settleWithin(promise: Promise<unknown>, ms: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const grace = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  await Promise.race([promise.then(noop, noop), grace]);
  clearTimeout(timer);
}

const noop = () => {};

type RunHealth = Meta['run'];

// A meta.json write failure must not abort the remaining sources or the GITHUB_OUTPUT report.
function finishSafely(
  handle: RunHandle,
  env: NodeJS.ProcessEnv,
  counts: Record<string, number>,
  errors: string[],
  forceFailed?: boolean,
): RunHealth {
  try {
    return handle.finish(counts, errors, forceFailed).run;
  } catch (e) {
    console.error(`failed to write meta.json: ${errorMessage(e)}`);
    const failure = [...errors, `failed to write meta.json: ${errorMessage(e)}`];
    try {
      return handle.finish({}, failure, true).run;
    } catch {
      return { status: 'failed', counts: {}, errors: failure.map((m) => sanitizeError(m, env)) };
    }
  }
}

export function formatOutcome({ source, status, counts }: SourceOutcome): string {
  const parts = Object.entries(counts).map(([key, n]) => `${key}=${n}`);
  return [`${source}: ${status}`, ...parts].join(' ');
}

export async function runSources(
  ids: SourceId[],
  registry: SourceRegistry,
  opts: RunSourcesOptions = {},
): Promise<RunSourcesResult> {
  const env = opts.env ?? process.env;
  const now = opts.now ?? (() => new Date());
  const log = opts.log ?? ((line: string) => console.log(line));
  const timeoutMs = opts.timeoutMs ?? resolveTimeoutMs(env);
  const abortGraceMs = opts.abortGraceMs ?? ABORT_GRACE_MS;

  const outcomes: SourceOutcome[] = [];
  for (const id of ids) {
    const load = registry[id];
    if (!load) {
      outcomes.push({ source: id, status: 'unimplemented', counts: {}, errors: ['source is not implemented'] });
      continue;
    }

    const dir = sourceDir(id, opts.root);
    let handle: RunHandle;
    try {
      handle = beginRun(id, dir, now, env);
    } catch (e) {
      // Running without the up-front failed marker would leave a stale ok status if the run dies.
      console.error(`failed to write meta.json: ${errorMessage(e)}`);
      outcomes.push({
        source: id,
        status: 'failed',
        counts: {},
        errors: [sanitizeError(`failed to write meta.json: ${errorMessage(e)}`, env)],
      });
      continue;
    }

    const controller = new AbortController();
    const running = (async () => (await load()).run({ dir, now: now(), env, signal: controller.signal }))();
    let health: RunHealth;
    try {
      const result = await withTimeout(running, timeoutMs);
      health = finishSafely(handle, env, result.counts, result.errors, result.forceFailed);
    } catch (e) {
      if (e instanceof TimeoutError) {
        controller.abort();
        await settleWithin(running, abortGraceMs);
      }
      health = finishSafely(handle, env, {}, [errorMessage(e)]);
    }
    outcomes.push({ source: id, ...health });
  }

  for (const outcome of outcomes) log(formatOutcome(outcome));

  const failedSources = outcomes.filter((o) => o.status === 'failed').map((o) => o.source);
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `failed_sources=${failedSources.join(',')}\n`);

  const exitCode = outcomes.some((o) => o.status === 'failed' || o.status === 'unimplemented') ? 1 : 0;
  return { outcomes, failedSources, exitCode };
}
