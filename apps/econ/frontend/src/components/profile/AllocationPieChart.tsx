import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { AssetAllocation } from '../../lib/types/profile';
import { ASSET_CLASS_LABELS, ASSET_CLASS_COLORS } from '../../lib/profilePresets';

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
      <div style={{ width: size, height: size }}>
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
              stroke="#1f2937"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-gray-400">{entry.label}</span>
            <span className="text-xs text-gray-300">{entry.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
