import { Portal } from '@ark-ui/react/portal';
import { Select as ArkSelect, createListCollection } from '@ark-ui/react/select';
import { useMemo } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

export function Select({ options, value, onChange, label, placeholder = '選択してください' }: SelectProps) {
  const collection = useMemo(() => createListCollection({ items: [...options] }), [options]);

  return (
    <ArkSelect.Root
      collection={collection}
      value={[value]}
      onValueChange={(d) => {
        const next = d.value[0];
        if (next !== undefined) onChange(next);
      }}
      positioning={{ sameWidth: true }}
    >
      {label && <ArkSelect.Label className="mb-1 block text-xs text-fg-muted">{label}</ArkSelect.Label>}
      <ArkSelect.Control>
        <ArkSelect.Trigger className="flex min-w-40 items-center justify-between gap-2 rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-fg hover:border-border-strong">
          <ArkSelect.ValueText placeholder={placeholder} />
          <ArkSelect.Indicator className="text-fg-muted" aria-hidden="true">
            ▾
          </ArkSelect.Indicator>
        </ArkSelect.Trigger>
      </ArkSelect.Control>
      <Portal>
        <ArkSelect.Positioner>
          <ArkSelect.Content className="z-50 max-h-64 overflow-y-auto rounded-md border border-border bg-surface-overlay p-1 shadow-xl">
            {collection.items.map((item) => (
              <ArkSelect.Item
                key={item.value}
                item={item}
                className="cursor-pointer rounded px-3 py-1.5 text-sm text-fg data-[highlighted]:bg-accent-muted data-[state=checked]:font-semibold"
              >
                <ArkSelect.ItemText>{item.label}</ArkSelect.ItemText>
              </ArkSelect.Item>
            ))}
          </ArkSelect.Content>
        </ArkSelect.Positioner>
      </Portal>
      <ArkSelect.HiddenSelect />
    </ArkSelect.Root>
  );
}
