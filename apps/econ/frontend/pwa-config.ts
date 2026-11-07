const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ベースパスを埋め込むため、サブパス配信（例: /econoguard/）でも同一オリジンの data/*.json だけに当たる
export function buildDataUrlPattern(base: string): RegExp {
  return new RegExp(`${escapeRegExp(base)}data/[^/]+\\.json$`);
}

export function buildNavigateFallbackDenylist(base: string): RegExp[] {
  return [/^\/api\//, new RegExp(`^${base}api/`)];
}
