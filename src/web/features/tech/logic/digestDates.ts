export interface AdjacentDates {
  prev: string | null;
  next: string | null;
}

// dates は新しい順。date が一覧になくても、その前後で最も近い日を返す
export function adjacentDates(dates: readonly string[], date: string): AdjacentDates {
  let prev: string | null = null;
  let next: string | null = null;
  for (const d of dates) {
    if (d < date && (prev === null || d > prev)) prev = d;
    if (d > date && (next === null || d < next)) next = d;
  }
  return { prev, next };
}

export function latestDate(dates: readonly string[]): string | undefined {
  return dates.reduce<string | undefined>((max, d) => (max === undefined || d > max ? d : max), undefined);
}
