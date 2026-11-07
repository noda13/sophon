import { describe, expect, it } from 'vitest';
import { ISSUE_CATEGORIES } from '../../../../shared/schema/issue';
import { buildHeatmapCells } from './heatmap';

describe('buildHeatmapCells', () => {
  it('空でも全カテゴリを固定の順で返す', () => {
    const cells = buildHeatmapCells([]);
    expect(cells.map((c) => c.category)).toEqual([...ISSUE_CATEGORIES]);
    expect(cells.every((c) => c.count === 0 && c.intensity === 0)).toBe(true);
  });

  it('最大件数に対する比率を intensity にする', () => {
    const cells = buildHeatmapCells([
      { category: 'education', count: 10, avgSeverity: 70, avgAppifiability: 20 },
      { category: 'governance', count: 5, avgSeverity: 10, avgAppifiability: 85 },
    ]);
    const edu = cells.find((c) => c.category === 'education');
    const gov = cells.find((c) => c.category === 'governance');
    expect(edu).toMatchObject({ intensity: 1, severityTone: 'high', appifiabilityTone: 'critical', label: '教育・学習' });
    expect(gov).toMatchObject({ intensity: 0.5, severityTone: 'low', appifiabilityTone: 'low' });
  });
});
