import { createFileRoute } from '@tanstack/react-router';
import { SourceCard } from '../features/home/components/SourceCard';

const SOURCES = [
  { source: 'stock', to: '/stock', description: '戦略別の銘柄ランキング' },
  { source: 'tech', to: '/tech', description: '技術記事とダイジェスト、EOL' },
  { source: 'issue', to: '/issue', description: '課題とアイデアのダッシュボード' },
  { source: 'econ', to: '/econ', description: 'グローバル経済リスクモニター' },
] as const;

function Home() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SOURCES.map((s) => (
        <SourceCard key={s.source} {...s} />
      ))}
    </div>
  );
}

export const Route = createFileRoute('/')({
  component: Home,
});
