import type { ComponentProps } from 'react';
import { CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';

// recharts は SVG 属性に CSS 変数を渡せるが、Tooltip の contentStyle は style 属性なので同様に var() で渡す。
export const chartColors = {
  grid: 'var(--color-border)',
  axis: 'var(--color-fg-subtle)',
  tooltipBg: 'var(--color-surface-overlay)',
  tooltipBorder: 'var(--color-border-strong)',
  tooltipText: 'var(--color-fg)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  accent: 'var(--color-accent)',
} as const;

export const chartMargin = { top: 8, right: 16, bottom: 0, left: 0 } as const;

export function ChartGrid(props: ComponentProps<typeof CartesianGrid>) {
  return <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} {...props} />;
}

export function ChartXAxis(props: ComponentProps<typeof XAxis>) {
  return <XAxis stroke={chartColors.axis} tick={{ fontSize: 12 }} {...props} />;
}

export function ChartYAxis(props: ComponentProps<typeof YAxis>) {
  return <YAxis stroke={chartColors.axis} tick={{ fontSize: 12 }} {...props} />;
}

export function ChartTooltip(props: ComponentProps<typeof Tooltip>) {
  return (
    <Tooltip
      contentStyle={{
        backgroundColor: chartColors.tooltipBg,
        border: `1px solid ${chartColors.tooltipBorder}`,
        borderRadius: '8px',
        color: chartColors.tooltipText,
      }}
      labelStyle={{ color: chartColors.tooltipText }}
      {...props}
    />
  );
}
