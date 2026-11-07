import { Link } from '@tanstack/react-router';

const LINKS = [
  { to: '/tech', label: '記事' },
  { to: '/tech/digest', label: 'ダイジェスト' },
] as const;

export function TechNav() {
  return (
    <nav aria-label="tech のページ" className="flex gap-1">
      {LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          activeOptions={{ exact: true }}
          className="rounded-md px-3 py-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
          activeProps={{ className: 'bg-accent-muted text-fg', 'aria-current': 'page' }}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
