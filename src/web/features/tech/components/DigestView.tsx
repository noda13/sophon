import type { Digest } from '../../../../shared/schema/tech';
import { Card } from '../../../ui/Card';
import { safeHref } from '../../../ui/safeHref';
import { categoryLabel } from '../logic/categories';

function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '---' : d.toLocaleString('ja-JP');
}

export function DigestView({ digest }: { digest: Digest }) {
  return (
    <div className="space-y-4">
      <Card title="概要">
        <p className="text-sm leading-relaxed text-fg">{digest.overviewJa}</p>
        <p className="mt-3 text-xs text-fg-subtle">生成: {formatGeneratedAt(digest.generatedAt)}</p>
      </Card>
      {digest.sections.map((section) => (
        <Card key={section.category} title={categoryLabel(section.category)}>
          <ul className="space-y-3">
            {section.highlights.map((h, i) => (
              <li key={`${h.url}-${i}`} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                <h3 className="mb-1 text-sm font-semibold leading-snug text-fg">
                  <a
                    href={safeHref(h.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-accent"
                  >
                    {h.title}
                  </a>
                </h3>
                <p className="text-xs leading-relaxed text-fg-muted">{h.summaryJa}</p>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
