interface FreshnessBadgeProps {
  generatedAt: string;
  isStale: boolean;
  health: 'ok' | 'partial' | 'failed';
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '---';
  return d.toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function FreshnessBadge({ generatedAt, isStale, health }: FreshnessBadgeProps) {
  const warnings: string[] = [];
  if (health === 'failed') warnings.push('最新の収集に失敗しています。表示は前回のデータです');
  else if (health === 'partial') warnings.push('一部の収集に失敗しています');
  if (isStale) warnings.push('データが古い可能性があります');

  return (
    <div className="text-xs text-fg-muted">
      <span>{formatDateTime(generatedAt)} 更新</span>
      {warnings.map((w) => (
        <p key={w} role="alert" className={health === 'failed' ? 'mt-1 text-danger' : 'mt-1 text-warning'}>
          {w}
        </p>
      ))}
    </div>
  );
}
