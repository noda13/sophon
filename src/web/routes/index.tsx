import { Link, createFileRoute } from '@tanstack/react-router';
import { Card } from '../ui/Card';

const SOURCES = [
  { to: '/stock', title: 'stock', description: '戦略別の銘柄ランキング' },
  { to: '/tech', title: 'tech', description: '技術記事とダイジェスト、EOL' },
  { to: '/issue', title: 'issue', description: '課題とアイデアのダッシュボード' },
  { to: '/econ', title: 'econ', description: 'グローバル経済リスクモニター' },
] as const;

function Home() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SOURCES.map((s) => (
        <Link
          key={s.to}
          // ルートはまだ生成されていないため、型付きの to を通さない
          to={s.to as string & {}}
          className="block rounded-lg transition-colors hover:ring-1 hover:ring-border-strong"
        >
          <Card title={s.title}>
            <p className="text-sm text-fg-muted">{s.description}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export const Route = createFileRoute('/')({
  component: Home,
});
