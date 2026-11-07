interface DateNavProps {
  date: string | undefined;
  prevDate: string | null;
  nextDate: string | null;
  onSelect: (date: string) => void;
}

const BUTTON =
  'rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-fg-muted transition-colors hover:border-border-strong hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-fg-muted';

export function DateNav({ date, prevDate, nextDate, onSelect }: DateNavProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button type="button" className={BUTTON} disabled={!prevDate} onClick={() => prevDate && onSelect(prevDate)}>
        <span aria-hidden="true">←</span> 前の日
      </button>
      <span className="min-w-28 text-center font-mono text-lg font-semibold tabular-nums text-fg">{date ?? '---'}</span>
      <button type="button" className={BUTTON} disabled={!nextDate} onClick={() => nextDate && onSelect(nextDate)}>
        次の日 <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
