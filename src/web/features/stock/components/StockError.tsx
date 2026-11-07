import { Link } from '@tanstack/react-router';
import { ErrorBox } from '../../../ui/ErrorBox';
import { t } from '../logic/i18n';

interface StockErrorProps {
  title: string;
  error: unknown;
}

export function StockError({ title, error }: StockErrorProps) {
  const detail = error instanceof Error ? error.message : t('unknownError');
  return (
    <div className="space-y-3">
      <ErrorBox message={`${title}: ${detail}`} />
      <Link to="/stock" className="inline-block text-sm text-accent hover:underline">
        {t('backToRanking')}
      </Link>
    </div>
  );
}
