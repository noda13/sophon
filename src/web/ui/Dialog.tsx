import { Dialog as ArkDialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import type { ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, title, description, children }: DialogProps) {
  return (
    <ArkDialog.Root open={open} onOpenChange={(d) => onOpenChange(d.open)} lazyMount unmountOnExit>
      <Portal>
        <ArkDialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
        <ArkDialog.Positioner className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <ArkDialog.Content className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface-overlay p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <ArkDialog.Title className="text-lg font-semibold text-fg">{title}</ArkDialog.Title>
                {description && (
                  <ArkDialog.Description className="mt-1 text-sm text-fg-muted">{description}</ArkDialog.Description>
                )}
              </div>
              <ArkDialog.CloseTrigger
                aria-label="閉じる"
                className="rounded-md p-1 text-fg-muted hover:bg-surface-raised hover:text-fg"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </ArkDialog.CloseTrigger>
            </div>
            {children}
          </ArkDialog.Content>
        </ArkDialog.Positioner>
      </Portal>
    </ArkDialog.Root>
  );
}
