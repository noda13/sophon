import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { RankingRow } from '../../../../shared/schema/stock';
import type { useDataTable } from '../../../composables/useDataTable';
import { DataTable } from '../../../ui/DataTable';
import type { RankingColumnId } from '../composables/rankingColumns';
import {
  EMPTY_VALUE,
  formatPer,
  formatRatio,
  formatYen,
  netCashRatioTone,
  netCashTone,
} from '../logic/formatters';
import { t } from '../logic/i18n';
import { StrategyScoreBadge } from './StrategyScoreBadge';
import { TONE_BADGE, TONE_TEXT } from './tones';

type RankingTableInstance = ReturnType<typeof useDataTable<RankingRow>>;

const RIGHT_ALIGNED = new Set<string>(['rank', 'marketCap', 'netCash', 'ncr', 'cnper', 'per', 'score'] satisfies RankingColumnId[]);
// 文字列の列は昇順、数値の列は大きい順を最初の並びにする
const TEXT_COLUMNS = new Set<string>(['code', 'name', 'sector'] satisfies RankingColumnId[]);

const CELLS: Record<RankingColumnId, (row: RankingRow) => ReactNode> = {
  rank: (r) => <span className="text-fg-muted">{r.rank}</span>,
  code: (r) => (
    <Link to="/stock/$code" params={{ code: r.code }} className="font-mono text-accent hover:underline">
      {r.code}
    </Link>
  ),
  name: (r) => <span className="font-medium">{r.name}</span>,
  sector: (r) => <span className="text-xs text-fg-muted">{r.sector33Name ?? EMPTY_VALUE}</span>,
  marketCap: (r) => <span className="font-mono">{formatYen(r.marketCap)}</span>,
  netCash: (r) => <span className={`font-mono ${TONE_TEXT[netCashTone(r.netCash)]}`}>{formatYen(r.netCash)}</span>,
  ncr: (r) => (
    <span
      className={`inline-block rounded px-2 py-0.5 font-mono text-xs font-bold ${TONE_BADGE[netCashRatioTone(r.netCashRatio)]}`}
    >
      {formatRatio(r.netCashRatio)}
    </span>
  ),
  cnper: (r) => <span className="font-mono">{formatPer(r.cashNeutralPer)}</span>,
  per: (r) => <span className="font-mono text-fg-muted">{formatPer(r.per)}</span>,
  score: (r) => <StrategyScoreBadge score={r.strategyScore.score} reason={r.strategyScore.reason} />,
};

export function RankingTable({ table }: { table: RankingTableInstance }) {
  const headers = table.getHeaderGroups().flatMap((group) =>
    group.headers.map((header) => {
      const column = header.column;
      const sorted = column.getIsSorted();
      return {
        id: column.id,
        label: String(column.columnDef.header ?? column.id),
        align: RIGHT_ALIGNED.has(column.id) ? ('right' as const) : ('left' as const),
        sortDirection: sorted,
        onSort: () => column.toggleSorting(sorted ? sorted === 'asc' : !TEXT_COLUMNS.has(column.id)),
      };
    }),
  );

  const rows = table.getRowModel().rows.map((row) => ({
    id: row.original.code,
    cells: row.getAllCells().map((cell) => CELLS[cell.column.id as RankingColumnId](row.original)),
  }));

  return <DataTable headers={headers} rows={rows} caption={t('rankingTitle')} emptyMessage={t('noMatch')} />;
}
