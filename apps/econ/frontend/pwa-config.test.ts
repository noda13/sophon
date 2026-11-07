import { describe, expect, it } from 'vitest';
import { buildDataUrlPattern, buildNavigateFallbackDenylist } from './pwa-config';

// workbox-routing の RegExpRoute と同じ判定: href に対して exec し、クロスオリジンは先頭一致のみ許可
function matchesRoute(pattern: RegExp, href: string, origin: string): boolean {
  const result = pattern.exec(href);
  if (!result) return false;
  return new URL(href).origin === origin || result.index === 0;
}

const DATA_FILES = [
  'news.json',
  'risks.json',
  'risk-history.json',
  'indicators.json',
  'composite-risk.json',
  'meta.json',
  'events.json',
];

describe.each([
  ['/', 'https://example.com'],
  ['/econoguard/', 'https://user.github.io'],
])('buildDataUrlPattern (base %s)', (base, origin) => {
  const pattern = buildDataUrlPattern(base);
  const matches = (path: string) => matchesRoute(pattern, `${origin}${path}`, origin);

  it.each(DATA_FILES)('matches %s', (file) => {
    expect(matches(`${base}data/${file}`)).toBe(true);
  });

  it('does not match non-JSON files under data/', () => {
    expect(matches(`${base}data/news.csv`)).toBe(false);
    expect(matches(`${base}data/news.json.map`)).toBe(false);
    expect(matches(`${base}data/`)).toBe(false);
  });

  it('does not match nested paths under data/', () => {
    expect(matches(`${base}data/sub/news.json`)).toBe(false);
  });

  it('does not match JSON outside data/', () => {
    expect(matches(`${base}news.json`)).toBe(false);
    expect(matches(`${base}assets/news.json`)).toBe(false);
    expect(matches(`${base}manifest.webmanifest`)).toBe(false);
  });

  it('does not match app shell or API requests', () => {
    expect(matches(base)).toBe(false);
    expect(matches(`${base}index.html`)).toBe(false);
    expect(matches(`${base}api/risks`)).toBe(false);
  });

  it('does not match a cross-origin data JSON', () => {
    expect(matchesRoute(pattern, `https://other.example.net${base}data/news.json`, origin)).toBe(false);
  });
});

describe('buildDataUrlPattern base isolation', () => {
  it('does not match another sub path when a sub path base is used', () => {
    const pattern = buildDataUrlPattern('/econoguard/');
    const origin = 'https://user.github.io';
    expect(matchesRoute(pattern, `${origin}/other/data/news.json`, origin)).toBe(false);
    expect(matchesRoute(pattern, `${origin}/data/news.json`, origin)).toBe(false);
  });

  it('treats regex metacharacters in the base literally', () => {
    const pattern = buildDataUrlPattern('/a.b/');
    const origin = 'https://example.com';
    expect(matchesRoute(pattern, `${origin}/a.b/data/news.json`, origin)).toBe(true);
    expect(matchesRoute(pattern, `${origin}/axb/data/news.json`, origin)).toBe(false);
  });
});

describe('buildNavigateFallbackDenylist', () => {
  it.each(['/', '/econoguard/'])('denies API navigations for base %s', (base) => {
    const denylist = buildNavigateFallbackDenylist(base);
    const denied = (pathname: string) => denylist.some((re: RegExp) => re.test(pathname));
    expect(denied('/api/risks')).toBe(true);
    expect(denied(`${base}api/risks`)).toBe(true);
    expect(denied(base)).toBe(false);
    expect(denied(`${base}index.html`)).toBe(false);
  });
});
