import { Card } from '../../../ui/Card';
import { buildExternalLinks } from '../logic/externalLinks';
import { t } from '../logic/i18n';

export function ExternalLinks({ code }: { code: string }) {
  return (
    <Card title={t('externalLinks')}>
      <ul className="grid grid-cols-2 gap-2">
        {buildExternalLinks(code).map((link) => (
          <li key={link.label}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full flex-col rounded-md bg-surface-overlay px-3 py-2 hover:bg-accent-muted"
            >
              <span className="text-sm font-semibold text-accent">{link.label}</span>
              <span className="text-xs text-fg-muted">{link.description}</span>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
