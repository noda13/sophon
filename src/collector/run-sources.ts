import { appendFileSync } from 'node:fs';
import { SourceIdSchema, type Meta, type SourceId } from '../shared/schema/meta';
import { sourceDir } from './core/io';
import { beginRun } from './core/meta';
import type { SourceRegistry } from './core/source';

export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

export type SourceOutcome =
  | { source: SourceId; status: Meta['run']['status']; counts: Record<string, number>; errors: string[] }
  | { source: SourceId; status: 'unimplemented'; counts: Record<string, number>; errors: string[] };

export interface RunSourcesOptions {
  root?: string;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
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

// Promise.race cannot cancel the loser: a timed-out run keeps going until the process exits,
// which is acceptable because the caller exits right after reporting.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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

  const outcomes: SourceOutcome[] = [];
  for (const id of ids) {
    const load = registry[id];
    if (!load) {
      outcomes.push({ source: id, status: 'unimplemented', counts: {}, errors: ['source is not implemented'] });
      continue;
    }

    const dir = sourceDir(id, opts.root);
    const handle = beginRun(id, dir, now);
    let meta: Meta;
    try {
      const result = await withTimeout(
        load().then((source) => source.run({ dir, now: now(), env })),
        timeoutMs,
      );
      meta = handle.finish(result.counts, result.errors);
    } catch (e) {
      meta = handle.finish({}, [errorMessage(e)]);
    }
    outcomes.push({ source: id, ...meta.run });
  }

  for (const outcome of outcomes) log(formatOutcome(outcome));

  const failedSources = outcomes.filter((o) => o.status === 'failed').map((o) => o.source);
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `failed_sources=${failedSources.join(',')}\n`);

  const exitCode = outcomes.some((o) => o.status === 'failed' || o.status === 'unimplemented') ? 1 : 0;
  return { outcomes, failedSources, exitCode };
}
