export const CATEGORIES = ['trend', 'ai', 'security', 'release'] as const;
export type Category = typeof CATEGORIES[number];

export const CATEGORY_META: Record<Category, { label: string; color: string; description: string }> = {
  trend:    { label: '技術トレンド',    color: 'blue',   description: '開発・技術の最新動向' },
  ai:       { label: 'AI / LLM',       color: 'purple', description: 'AI・機械学習・LLMの動向' },
  security: { label: 'セキュリティ',    color: 'red',    description: '脆弱性・セキュリティインシデント' },
  release:  { label: 'リリース / 更新', color: 'green',  description: '製品・OSS・SaaSのリリース情報' },
};
