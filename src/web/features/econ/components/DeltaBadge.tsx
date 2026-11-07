import { describeDelta } from '../logic/dashboard';

const DIRECTION_CLASS = {
  up: 'text-danger',
  down: 'text-success',
  flat: 'text-fg-subtle',
} as const;

// リスクは上がるほど悪いので、上昇を赤・下降を緑にする
export function DeltaBadge({ delta, className = '' }: { delta: number | undefined; className?: string }) {
  if (delta === undefined) return null;
  const { text, direction } = describeDelta(delta);
  return <span className={`font-mono text-xs ${DIRECTION_CLASS[direction]} ${className}`}>{text}</span>;
}
