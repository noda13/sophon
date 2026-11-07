export const INVESTMENT_DISCLAIMER =
  '本表示は情報提供を目的としたもので、投資助言ではありません。個別銘柄の推奨でもありません。投資判断はご自身の責任で行ってください。';

export function Disclaimer({ className = '' }: { className?: string }) {
  return <p className={`text-xs text-fg-subtle ${className}`}>{INVESTMENT_DISCLAIMER}</p>;
}
