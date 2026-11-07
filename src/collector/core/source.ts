import type { SourceId } from '../../shared/schema/meta';

export interface RunContext {
  dir: string;
  now: Date;
  env: NodeJS.ProcessEnv;
}

export interface RunResult {
  counts: Record<string, number>;
  errors: string[];
  /** true なら errors の有無にかかわらず run.status を failed にする。 */
  forceFailed?: boolean;
}

export interface CollectorSource {
  id: SourceId;
  run(ctx: RunContext): Promise<RunResult>;
}

// Partial so that a source without an implementation is reported as such instead of failing to type-check.
export type SourceRegistry = Partial<Record<SourceId, () => Promise<CollectorSource>>>;
