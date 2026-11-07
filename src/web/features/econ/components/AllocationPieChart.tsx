import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { AssetAllocation } from '../logic/profile';
import { ASSET_CLASS_COLORS, ASSET_CLASS_LABELS } from '../logic/profilePresets';

interface Props {
  allocation: AssetAllocation;
  size?: number;
}

export function AllocationPieChart({ allocation, size = 180 }: Props) {
  const outerRadius = Math.floor(size / 2) - 10;

  const data = (Object.keys(allocation) as (keyof AssetAllocation)[])
    .filter((key) => allocation[key] > 0)
    .map((key) => ({
      name: key,
      label: ASSET_CLASS_LABELS[key],
      value: allocation[key],
      color: ASSET_CLASS_COLORS[key],
    }));

  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ width: size, height: size }} role="img" aria-label="資産配分の円グラフ">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={0}
              outerRadius={outerRadius}
              startAngle={90}
              endAngle={-270}
              strokeWidth={1}
              stroke="var(--color-surface-overlay)"
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-xs text-fg-muted">{entry.label}</span>
            <span className="text-xs text-fg">{entry.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
