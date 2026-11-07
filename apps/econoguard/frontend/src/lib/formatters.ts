export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatChange(
  current: number,
  previous: number | null,
): { text: string; direction: 'up' | 'down' | 'flat' } | null {
  if (previous === null || previous === 0) return null;
  const diff = current - previous;
  const ratio = (diff / Math.abs(previous)) * 100;
  // Subnormal floats can overflow the division to Infinity
  if (!Number.isFinite(ratio)) return null;
  const pct = ratio.toFixed(2);
  return {
    text: `${diff > 0 ? '+' : ''}${pct}%`,
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
  };
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString('ja-JP', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function safeHttpUrl(url: string): string | undefined {
  const trimmed = url.trim();
  try {
    const { protocol } = new URL(trimmed);
    return protocol === 'http:' || protocol === 'https:' ? trimmed : undefined;
  } catch {
    return undefined;
  }
}
