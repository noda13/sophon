import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// 旧 apps が配信していた実データ。data ブランチへ移行したら参照先をそちらへ替える。
export const legacyDataDir = (app: 'stock' | 'tech' | 'issue' | 'econ') =>
  resolve(import.meta.dirname, '../../..', 'apps', app, 'frontend/public/data');

export const readLegacyJson = (app: 'stock' | 'tech' | 'issue' | 'econ', file: string): unknown =>
  JSON.parse(readFileSync(join(legacyDataDir(app), file), 'utf-8'));

export const listLegacyFiles = (app: 'stock' | 'tech' | 'issue' | 'econ'): string[] =>
  readdirSync(legacyDataDir(app)).filter((f) => f.endsWith('.json'));
