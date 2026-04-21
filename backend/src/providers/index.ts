import { config } from '../lib/config.js';
import type { DataProvider } from './DataProvider.js';
import { CsvProvider } from './CsvProvider.js';

export function resolveProvider(): DataProvider {
  switch (config.dataProvider) {
    case 'csv':
      return new CsvProvider();
    // TODO: Phase 1 — jquants
    // TODO: Phase 2 — edinet, composite
    default:
      throw new Error(`Unknown DATA_PROVIDER: ${config.dataProvider}`);
  }
}
