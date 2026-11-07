import { MetaSchema, type Meta, type SourceId } from '../../shared/schema/meta';
import { writeJson } from './io';
import { sanitizeError } from './sanitize';

const META_FILE = 'meta.json';
export const UNFINISHED_RUN_ERROR = 'run did not finish';

export interface RunHandle {
  /** forceFailed は、データを書いても成功扱いにしてはならない欠落（LLM 無効など）用。 */
  finish(counts: Record<string, number>, errors: string[], forceFailed?: boolean): Meta;
}

// Counts that describe failures say nothing about whether the run produced data.
const NON_OUTPUT_COUNT = /fail|error|skip/i;

export function resolveStatus(counts: Record<string, number>, errors: string[]): Meta['run']['status'] {
  if (errors.length === 0) return 'ok';
  const producedOutput = Object.entries(counts).some(([key, n]) => n > 0 && !NON_OUTPUT_COUNT.test(key));
  return producedOutput ? 'partial' : 'failed';
}

// meta.json is written as failed up front so a run that crashes or is killed part-way still
// shows up as failed instead of leaving the previous run's status in place.
export function beginRun(
  source: SourceId,
  dir: string,
  now: () => Date = () => new Date(),
  env: Record<string, string | undefined> = process.env,
): RunHandle {
  writeJson(dir, META_FILE, MetaSchema, {
    source,
    generatedAt: now().toISOString(),
    run: { status: 'failed', counts: {}, errors: [UNFINISHED_RUN_ERROR] },
  });

  let finished = false;
  return {
    finish(counts, errors, forceFailed = false) {
      if (finished) throw new Error(`run for ${source} was already finished`);
      finished = true;
      const meta: Meta = {
        source,
        generatedAt: now().toISOString(),
        run: {
          status: forceFailed ? 'failed' : resolveStatus(counts, errors),
          counts,
          errors: errors.map((e) => sanitizeError(e, env)),
        },
      };
      writeJson(dir, META_FILE, MetaSchema, meta);
      return meta;
    },
  };
}
