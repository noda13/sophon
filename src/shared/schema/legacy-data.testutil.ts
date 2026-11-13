import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// 移行前の配信 JSON のスナップショット。スキーマが実データの形（キー・型）に通ることを確かめるため、中身は加工せず置いている。
// stock の stock-<code>.json は容量のため業種・市場の異なる数件だけを置いている。
type LegacyApp = 'stock' | 'tech' | 'issue' | 'econ';

export const legacyDataDir = (app: LegacyApp) => resolve(import.meta.dirname, '../testdata/legacy', app);

export const readLegacyJson = (app: LegacyApp, file: string): unknown =>
  JSON.parse(readFileSync(join(legacyDataDir(app), file), 'utf-8'));

export const listLegacyFiles = (app: LegacyApp): string[] =>
  readdirSync(legacyDataDir(app)).filter((f) => f.endsWith('.json'));
