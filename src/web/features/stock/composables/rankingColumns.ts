import { createColumnHelper } from '@tanstack/react-table';
import type { RankingRow } from '../../../../shared/schema/stock';
import type { DataTableFeatures } from '../../../composables/useDataTable';
import { t } from '../logic/i18n';

const helper = createColumnHelper<DataTableFeatures, RankingRow>();

// null は undefined にして、並べ替えで昇降どちらでも末尾に寄せる
const orUndefined = (n: number | null): number | undefined => n ?? undefined;

export const rankingColumns = helper.columns([
  helper.accessor('rank', { header: t('colRank'), enableGlobalFilter: false }),
  helper.accessor('code', { header: t('colCode') }),
  helper.accessor('name', { header: t('colName') }),
  helper.accessor((r) => r.sector33Name ?? undefined, { id: 'sector', header: t('colSector') }),
  helper.accessor('marketCap', { header: t('colMarketCap'), enableGlobalFilter: false }),
  helper.accessor((r) => orUndefined(r.netCash), { id: 'netCash', header: t('colNetCash'), enableGlobalFilter: false }),
  helper.accessor((r) => orUndefined(r.netCashRatio), { id: 'ncr', header: t('colNcr'), enableGlobalFilter: false }),
  helper.accessor((r) => orUndefined(r.cashNeutralPer), { id: 'cnper', header: t('colCnper'), enableGlobalFilter: false }),
  helper.accessor((r) => orUndefined(r.per), { id: 'per', header: t('colPer'), enableGlobalFilter: false }),
  helper.accessor((r) => r.strategyScore.score, { id: 'score', header: t('colScore'), enableGlobalFilter: false }),
]);

export type RankingColumnId = 'rank' | 'code' | 'name' | 'sector' | 'marketCap' | 'netCash' | 'ncr' | 'cnper' | 'per' | 'score';
