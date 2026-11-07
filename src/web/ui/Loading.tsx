export function Loading({ label = '読み込み中' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 p-8 text-fg-muted">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-accent" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
