import { config } from '../lib/config.js';
import type { DataProvider } from './DataProvider.js';
import { CsvProvider } from './CsvProvider.js';
import { JQuantsProvider } from './JQuantsProvider.js';

export function resolveProvider(): DataProvider {
  switch (config.dataProvider) {
    case 'csv':
      return new CsvProvider();
    case 'jquants':
      return new JQuantsProvider();
    // TODO: Phase 2 — edinet, composite
    default:
      throw new Error(`Unknown DATA_PROVIDER: ${config.dataProvider}`);
  }
}
