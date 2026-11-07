import { Portal } from '@ark-ui/react/portal';
import { Tooltip as ArkTooltip } from '@ark-ui/react/tooltip';
import type { ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <ArkTooltip.Root openDelay={200} closeDelay={100}>
      <ArkTooltip.Trigger asChild>
        <span className="inline-flex">{children}</span>
      </ArkTooltip.Trigger>
      <Portal>
        <ArkTooltip.Positioner>
          <ArkTooltip.Content className="z-50 max-w-xs rounded-md border border-border bg-surface-overlay px-2.5 py-1.5 text-xs text-fg shadow-lg">
            {content}
          </ArkTooltip.Content>
        </ArkTooltip.Positioner>
      </Portal>
    </ArkTooltip.Root>
  );
}
