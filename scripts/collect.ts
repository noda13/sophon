import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Parser from 'rss-parser';
import crypto from 'crypto';
import { z } from 'zod';
import { CATEGORIES, EOL_NO_DATE_DAYS, type Category } from '../shared/categories.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../frontend/public/data');
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(resolve(DATA_DIR, 'digest'), { recursive: true });

// --- Types ---
interface Article {
  id: string;
  source: string;
  category: Category;       // LLM-assigned single category
  importance: '高' | '中' | '低';  // LLM-assigned
  originalTitle: string;
  originalUrl: string;
  publishedAt: string;      // ISO
  summaryJa: string;        // Japanese 2-3 sentence summary
}

interface EolItem {
  product: string;
  cycle: string;
  eol: string | false;
  latest?: string;
  daysLeft: number;   // negative = already EOL
}

interface Digest {
  date: string;          // YYYY-MM-DD
  generatedAt: string;   // ISO
  overviewJa: string;    // 1 paragraph Japanese overview
  sections: Array<{
    category: Category;
    highlights: Array<{ title: string; summaryJa: string; url: string }>;
  }>;
}

// --- Helpers ---
function readJson<T>(filename: string, fallback: T): T {
  try { return JSON.parse(readFileSync(resolve(DATA_DIR, filename), 'utf-8')); } catch { return fallback; }
}

function writeJson(filename: string, data: unknown) {
  writeFileSync(resolve(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

function genId(url: string, title: string): string {
  return crypto.createHash('sha256').update(`${url}:${title}`).digest('hex').slice(0, 16);
}

const BATCH_DELAY_MS = 30_000;
// Max articles to summarize per run (rate-limit/cost cap). Un-summarized articles persist
// and are picked up in subsequent runs.
const MAX_SUMMARIZE_PER_RUN = 50;

const articleSchema = z.object({
  id: z.string(),
  source: z.string(),
  category: z.enum(CATEGORIES),
  importance: z.enum(['高', '中', '低']),
  originalTitle: z.string(),
  originalUrl: z.string(),
  publishedAt: z.string(),
  summaryJa: z.string(),
});

const eolItemSchema = z.object({
  product: z.string(),
  cycle: z.string(),
  eol: z.union([z.string(), z.literal(false)]),
  latest: z.string().optional(),
  daysLeft: z.number(),
});

function readArticles(): Article[] {
  const raw = readJson<unknown>('articles.json', []);
  const result = z.array(articleSchema).safeParse(raw);
  if (!result.success) {
    console.warn('[readArticles] Invalid articles.json, starting fresh');
    return [];
  }
  return result.data;
}

function readEolItems(): EolItem[] {
  const raw = readJson<unknown>('eol.json', []);
  const result = z.array(eolItemSchema).safeParse(raw);
  if (!result.success) {
    console.warn('[readEolItems] Invalid eol.json, starting fresh');
    return [];
  }
  return result.data;
}

// --- Sources ---
const SOURCES = [
  // trend
  { url: 'https://hnrss.org/frontpage', source: 'hackernews', hint: 'trend' as Category },
  { url: 'https://zenn.dev/feed', source: 'zenn', hint: 'trend' as Category },
  { url: 'https://qiita.com/popular-items/feed', source: 'qiita', hint: 'trend' as Category },
  { url: 'https://www.publickey1.jp/atom.xml', source: 'publickey', hint: 'trend' as Category },
  { url: 'https://github.blog/engineering.atom', source: 'github-blog', hint: 'trend' as Category },
  // ai
  { url: 'https://www.anthropic.com/rss.xml', source: 'anthropic', hint: 'ai' as Category },
  { url: 'https://openai.com/news/rss/', source: 'openai', hint: 'ai' as Category },
  { url: 'https://blog.google/technology/ai/rss/', source: 'google-ai', hint: 'ai' as Category },
  { url: 'https://huggingface.co/blog/feed.xml', source: 'huggingface', hint: 'ai' as Category },
  { url: 'https://export.arxiv.org/rss/cs.AI', source: 'arxiv-ai', hint: 'ai' as Category },
  // security
  { url: 'https://www.jpcert.or.jp/rss/jpcert.rdf', source: 'jpcert', hint: 'security' as Category },
  { url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', source: 'cisa', hint: 'security' as Category },
  { url: 'https://feeds.feedburner.com/TheHackersNews', source: 'the-hacker-news', hint: 'security' as Category },
  { url: 'https://www.bleepingcomputer.com/feed/', source: 'bleepingcomputer', hint: 'security' as Category },
  // release
  { url: 'https://nodejs.org/en/feed/blog.xml', source: 'nodejs', hint: 'release' as Category },
  { url: 'https://kubernetes.io/feed.xml', source: 'kubernetes', hint: 'release' as Category },
  { url: 'https://aws.amazon.com/blogs/aws/feed/', source: 'aws', hint: 'release' as Category },
  { url: 'https://github.com/vitejs/vite/releases.atom', source: 'vite', hint: 'release' as Category },
  { url: 'https://github.com/denoland/deno/releases.atom', source: 'deno', hint: 'release' as Category },
];

// --- Articles ---
async function collectArticles(existing: Article[]): Promise<Article[]> {
  const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'Techscope/1.0' } });
  const ids = new Set(existing.map(a => a.id));
  const fresh: Article[] = [];

  const results = await Promise.allSettled(
    SOURCES.map(async (src) => {
      const feed = await parser.parseURL(src.url);
      const items: Article[] = [];
      for (const item of (feed.items ?? []).slice(0, 30)) {
        if (!item.title || !item.link) continue;
        if (!/^https?:\/\//i.test(item.link)) continue;  // reject non-http(s) URLs (e.g. javascript:)
        const id = genId(item.link, item.title);
        if (ids.has(id)) continue;
        items.push({
          id,
          source: src.source,
          category: src.hint,
          importance: '中',
          originalTitle: item.title,
          originalUrl: item.link,
          publishedAt: (() => {
            const raw = item.isoDate ?? item.pubDate;
            const d = raw ? new Date(raw) : null;
            return d && !isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
          })(),
          summaryJa: '',
        });
      }
      console.log(`  ${src.source}: ${feed.items?.length || 0} items`);
      return items;
    }),
  );

  for (const r of results) {
    if (r.status === 'fulfilled') fresh.push(...r.value);
    else console.error(`  RSS failed:`, r.reason instanceof Error ? r.reason.message : r.reason);
  }

  const all = [...fresh, ...existing];
  all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  if (all.length <= 200) return all;
  const withSummary = all.filter(a => a.summaryJa.length > 0);
  const withoutSummary = all.filter(a => a.summaryJa.length === 0);
  // Reserve slots for fresh articles so they can be summarized in future runs
  const freshSlots = Math.min(withoutSummary.length, MAX_SUMMARIZE_PER_RUN);
  const merged = [...withSummary.slice(0, 200 - freshSlots), ...withoutSummary.slice(0, freshSlots)];
  merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return merged;
}

// --- EOL ---
const EOL_PRODUCTS = [
  { id: 'nodejs', label: 'Node.js' },
  { id: 'python', label: 'Python' },
  { id: 'php', label: 'PHP' },
  { id: 'ubuntu', label: 'Ubuntu' },
  { id: 'django', label: 'Django' },
  { id: 'kubernetes', label: 'Kubernetes' },
  { id: 'redis', label: 'Redis' },
  { id: 'go', label: 'Go' },
  { id: 'react', label: 'React' },
  { id: 'typescript', label: 'TypeScript' },
];

interface EndOfLifeCycle {
  cycle: string;
  eol: string | boolean;
  latest?: string;
  latestReleaseDate?: string;
  releaseDate?: string;
  lts?: boolean | string;
}

function computeDaysLeft(eol: string | false, today: Date): number {
  if (eol === false) return EOL_NO_DATE_DAYS;
  const ms = new Date(eol).getTime() - today.getTime();
  return Math.min(Math.round(ms / (1000 * 60 * 60 * 24)), EOL_NO_DATE_DAYS - 1);
}

async function collectEol(prev: EolItem[]): Promise<EolItem[]> {
  const today = new Date();
  const results: EolItem[] = [];

  await Promise.allSettled(
    EOL_PRODUCTS.map(async (product) => {
      try {
        const res = await fetch(`https://endoflife.date/api/${product.id}.json`, {
          headers: { 'User-Agent': 'Techscope/1.0' },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const cycles = await res.json() as EndOfLifeCycle[];

        // Get top 3 most recent active cycles (eol = false or future date)
        const active = cycles
          .filter(c => {
            if (c.eol === false) return true;
            if (typeof c.eol === 'string') {
              return new Date(c.eol) > today;
            }
            return false;
          })
          .slice(0, 3);

        for (const c of active) {
          const daysLeft = computeDaysLeft(c.eol as string | false, today);

          results.push({
            product: product.label,
            cycle: c.cycle,
            eol: c.eol as string | false,
            latest: c.latest,
            daysLeft,
          });
        }
        console.log(`  ${product.label}: ${active.length} active cycles`);
      } catch (e) {
        console.warn(`  ${product.label}: fetch failed (${e instanceof Error ? e.message : e}), using cache`);
        // Carry forward cached values for this product
        const cached = prev.filter(item => item.product === product.label);
        for (const item of cached) {
          const freshDaysLeft = computeDaysLeft(item.eol, today);
          if (!Number.isFinite(freshDaysLeft) || freshDaysLeft < 0) continue; // skip already-EOL items, consistent with success path
          results.push({ ...item, daysLeft: freshDaysLeft });
        }
      }
    }),
  );

  return results;
}

// --- LLM Provider ---
// Supports any OpenAI-compatible API (Groq, OpenAI, Together, OpenRouter, etc.) + Gemini
//
// Config via env vars:
//   LLM_PROVIDER=groq|gemini|openai (auto-detect if not set)
//   LLM_BASE_URL=https://api.groq.com/openai/v1 (override API endpoint)
//   LLM_MODEL=llama-3.3-70b-versatile (override model)
//   LLM_API_KEY=... (override API key)
//
// Provider-specific keys (auto-detect):
//   GROQ_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY

interface LLMConfig {
  provider: string;
  baseUrl: string;
  model: string;
  key: string;
}

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  groq:     { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  openai:   { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  gemini:   { baseUrl: '', model: 'gemini-2.0-flash' },
  together: { baseUrl: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct' },
};

function detectProvider(): LLMConfig | null {
  // Explicit full config
  if (process.env.LLM_API_KEY && process.env.LLM_BASE_URL) {
    return {
      provider: process.env.LLM_PROVIDER || 'custom',
      baseUrl: process.env.LLM_BASE_URL,
      model: process.env.LLM_MODEL || 'default',
      key: process.env.LLM_API_KEY,
    };
  }

  // Auto-detect from provider-specific keys
  const explicit = process.env.LLM_PROVIDER;
  const pairs: Array<[string, string | undefined]> = [
    ['groq', process.env.GROQ_API_KEY],
    ['gemini', process.env.GEMINI_API_KEY],
    ['openai', process.env.OPENAI_API_KEY],
  ];

  // Prioritize explicit provider
  if (explicit) {
    const match = pairs.find(([p]) => p === explicit);
    if (match?.[1]) {
      const defaults = PROVIDER_DEFAULTS[explicit] || { baseUrl: '', model: '' };
      return {
        provider: explicit,
        baseUrl: process.env.LLM_BASE_URL || defaults.baseUrl,
        model: process.env.LLM_MODEL || defaults.model,
        key: match[1],
      };
    }
  }

  // Auto-detect: first available key wins
  for (const [provider, key] of pairs) {
    if (key) {
      const defaults = PROVIDER_DEFAULTS[provider] || { baseUrl: '', model: '' };
      return { provider, baseUrl: defaults.baseUrl, model: defaults.model, key };
    }
  }

  return null;
}

async function callLLM(system: string, user: string): Promise<string> {
  const config = detectProvider();
  if (!config) throw new Error('No LLM configured. Set GROQ_API_KEY, GEMINI_API_KEY, or LLM_API_KEY+LLM_BASE_URL.');

  if (config.provider === 'gemini') {
    return callGemini(system, user, config);
  }
  return callOpenAICompatible(system, user, config);
}

async function callOpenAICompatible(system: string, user: string, config: LLMConfig): Promise<string> {
  const SUPPORTS_JSON_FORMAT = new Set(['groq', 'openai', 'together', 'openrouter']);
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.key}` },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.3,
      max_tokens: 8192,
      ...(SUPPORTS_JSON_FORMAT.has(config.provider) ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`${config.provider} ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${config.provider} returned empty or malformed response (no choices[0].message.content)`);
  return content;
}

async function callGemini(system: string, user: string, config: LLMConfig): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(config.key);
  const model = genAI.getGenerativeModel({
    model: config.model,
    systemInstruction: system,
  });
  const r = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { responseMimeType: 'application/json' },
  });
  return r.response.text();
}

function parseJson(text: string): unknown {
  let s = text.trim();
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  try { return JSON.parse(s); } catch {}
  // Fallback: extract first balanced {...} block (handles leading explanatory text from LLMs)
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch {}
  }
  console.error('JSON parse failed. Raw text (first 200 chars):', s.slice(0, 200));
  throw new Error('LLM returned invalid JSON');
}

// --- Summarize & Classify ---
async function summarizeAndClassify(articles: Article[]) {
  const todo = articles.filter(a => !a.summaryJa);
  if (!todo.length) return;

  const SYS = `あなたはITニュースのキュレーターです。与えられたニュース記事を分析し、JSON形式で応答してください。

各記事について:
- summaryJa: 日本語で2-3文の簡潔な要約
- category: 記事の内容に最も合致するカテゴリ（提示されたhintを参考にしつつ、最終判断はあなたが行う）。選択肢: "trend", "ai", "security", "release"
  - trend: 開発・技術の最新動向、フレームワーク、プログラミング手法など
  - ai: AI・機械学習・LLMの動向、モデルリリース、研究成果など
  - security: 脆弱性、セキュリティインシデント、CVE、セキュリティアドバイザリなど
  - release: 製品・OSS・SaaSのリリース、バージョンアップ、新機能発表など
- importance: 記事の重要度。選択肢: "高", "中", "低"
  - 高: 業界全体に影響する重大なニュース（メジャーバージョンリリース、重大脆弱性、業界を変えるAIリリースなど）
  - 中: 注目すべきだが限定的な影響（マイナーリリース、技術動向記事、中程度の脆弱性など）
  - 低: ニッチまたは影響が小さいニュース

応答は必ず以下のJSON形式: {"results":[{"index":0,"summaryJa":"...","category":"trend","importance":"中"}]}`;

  for (let i = 0; i < Math.min(todo.length, MAX_SUMMARIZE_PER_RUN); i += 10) {
    const batch = todo.slice(i, i + 10);
    const msg = batch.map((a, j) => `[${j}] source:${a.source} hint:${a.category} title:${a.originalTitle}`).join('\n');
    try {
      const raw = await callLLM(SYS, msg);
      const parsed = parseJson(raw);

      const articleResultSchema = z.object({
        index: z.number().int().min(0),
        summaryJa: z.string(),
        category: z.enum(CATEGORIES),
        importance: z.enum(['高', '中', '低']),
      });
      const responseSchema = z.object({ results: z.array(z.unknown()) });
      const { results: rawItems } = responseSchema.parse(parsed);

      let accepted = 0;
      for (const item of rawItems) {
        const res = articleResultSchema.safeParse(item);
        if (!res.success) {
          console.warn('[summarizeAndClassify] Dropping invalid result entry:', res.error.issues);
          continue;
        }
        const r = res.data;
        if (r.index < batch.length && batch[r.index]) {
          batch[r.index].summaryJa = r.summaryJa;
          batch[r.index].category = r.category;
          batch[r.index].importance = r.importance;
          accepted++;
        }
      }
      console.log(`  Batch ${Math.floor(i / 10) + 1} done (${accepted} summarized)`);
    } catch (e) { console.error('  Summarize failed:', e instanceof Error ? e.message : e); }
    if (i + 10 < Math.min(todo.length, MAX_SUMMARIZE_PER_RUN)) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }
}

// --- Build Digest ---
async function buildDigest(articles: Article[]) {
  const today = new Date().toISOString().slice(0, 10);

  // Filter: summaryJa populated + importance '高' or '中', max 30
  const candidates = articles
    .filter(a => a.summaryJa && a.summaryJa.length > 0 && (a.importance === '高' || a.importance === '中'))
    .slice(0, 30);

  if (!candidates.length) {
    console.log('  No summarized articles for digest, skipping');
    return;
  }

  const SYS = `あなたはITニュースのキュレーターです。本日の重要なIT関連ニュースを日本語でダイジェスト形式にまとめてください。

以下のJSON形式で応答してください:
{"overviewJa":"1段落の概要","sections":[{"category":"trend","highlights":[{"title":"...","summaryJa":"...","url":"..."}]}]}

カテゴリは trend, ai, security, release の中から該当するものだけ含めてください。
各セクションのhighlightsは最大5件にしてください。`;

  const ctx = candidates.map(a =>
    `[${a.category}][${a.importance}] ${a.source}: ${a.originalTitle}\nURL: ${a.originalUrl}\n要約: ${a.summaryJa}`
  ).join('\n\n');

  try {
    const raw = await callLLM(SYS, ctx);
    const parsed = parseJson(raw);

    const digestSchema = z.object({
      overviewJa: z.string(),
      sections: z.array(z.object({
        category: z.enum(CATEGORIES),
        highlights: z.array(z.object({
          title: z.string(),
          summaryJa: z.string(),
          url: z.string(),
        })).max(5),
      })),
    });

    const result = digestSchema.safeParse(parsed);
    if (!result.success) {
      console.error('[buildDigest] Invalid digest schema:', result.error.issues);
      return;
    }

    const now = new Date().toISOString();
    const digest: Digest = {
      date: today,
      generatedAt: now,
      overviewJa: result.data.overviewJa,
      sections: result.data.sections,
    };

    writeJson('digest-latest.json', digest);
    writeFileSync(
      resolve(DATA_DIR, 'digest', `${today}.json`),
      JSON.stringify(digest, null, 2),
    );
    console.log(`  Digest built for ${today}`);
  } catch (e) {
    console.error('  Digest build failed:', e instanceof Error ? e.message : e);
  }
}

// --- Main ---
async function main() {
  console.log('=== Techscope Static Collection ===\n');

  const prevArticles = readArticles();
  const prevEol = readEolItems();

  console.log('--- Articles ---');
  const articles = await collectArticles(prevArticles);
  console.log(`Total: ${articles.length} articles\n`);

  console.log('--- EOL ---');
  const eol = await collectEol(prevEol);
  console.log(`Total: ${eol.length} entries\n`);

  const llm = detectProvider();
  if (llm) {
    console.log(`--- LLM (${llm.provider}): Summarize & Classify ---`);
    await summarizeAndClassify(articles);

    // Persist summaries before buildDigest so a crash/kill there doesn't waste LLM work.
    writeJson('articles.json', articles.slice(0, 200));

    console.log(`\n--- LLM (${llm.provider}): Build Digest ---`);
    await buildDigest(articles);
  } else {
    console.log('No LLM configured, skipping AI processing\n');
    // Persist articles even when no LLM is configured (for dedup on next run).
    writeJson('articles.json', articles.slice(0, 200));
  }

  writeJson('eol.json', eol);
  writeJson('meta.json', { lastUpdated: new Date().toISOString() });

  console.log('\n=== Saved to frontend/public/data/ ===');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
