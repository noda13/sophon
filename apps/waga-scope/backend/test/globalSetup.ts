import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'waga-scope-test-'));
  process.env.DATABASE_URL = `file:${join(dir, 'test.db')}`;
  execSync('pnpm exec prisma migrate deploy', { stdio: 'pipe', env: process.env });
  return () => rmSync(dir, { recursive: true, force: true });
}
