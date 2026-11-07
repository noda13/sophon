import { Tabs as ArkTabs } from '@ark-ui/react/tabs';
import type { ReactNode } from 'react';

export interface TabItem {
  value: string;
  label: string;
  title?: string;
}

interface TabsProps {
  items: readonly TabItem[];
  value: string;
  onChange: (value: string) => void;
  children?: ReactNode;
  ariaLabel?: string;
}

export function Tabs({ items, value, onChange, children, ariaLabel }: TabsProps) {
  return (
    <ArkTabs.Root value={value} onValueChange={(d) => onChange(d.value)}>
      <ArkTabs.List aria-label={ariaLabel} className="mb-4 flex flex-wrap gap-2">
        {items.map((item) => (
          <ArkTabs.Trigger
            key={item.value}
            value={item.value}
            title={item.title}
            className="rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg data-[selected]:border-accent data-[selected]:bg-accent-muted data-[selected]:text-fg"
          >
            {item.label}
          </ArkTabs.Trigger>
        ))}
      </ArkTabs.List>
      {children}
    </ArkTabs.Root>
  );
}
