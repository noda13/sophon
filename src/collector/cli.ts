import { resolveSourceIds, runSources, USAGE } from './run-sources';
import { sources } from './sources';

const ids = resolveSourceIds(process.argv.slice(2));
if (!ids) {
  console.error(USAGE);
  process.exit(2);
}

const { exitCode } = await runSources(ids, sources);
process.exit(exitCode);
