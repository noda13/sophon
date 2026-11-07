import { Card } from '../../../ui/Card';
import { EmptyState } from '../../../ui/EmptyState';
import { ErrorBox } from '../../../ui/ErrorBox';
import { Loading } from '../../../ui/Loading';
import { Pagination } from '../../../ui/Pagination';
import type { useIssues } from '../composables/useIssues';
import { CategorySelect, SortSelect, SourceTypeTabs } from './FilterBar';
import { IssueCard } from './IssueCard';

export function IssueFeed({ feed }: { feed: ReturnType<typeof useIssues> }) {
  return (
    <Card title="社会課題フィード">
      <SourceTypeTabs value={feed.sourceType} onChange={feed.setSourceType} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <CategorySelect value={feed.category} onChange={feed.setCategory} />
        <SortSelect value={feed.sort} onChange={feed.setSort} />
        <p className="ml-auto text-sm text-fg-muted" aria-live="polite">
          {feed.total} 件
        </p>
      </div>

      {feed.isPending && <Loading />}
      {feed.error && <ErrorBox message="課題データの取得に失敗しました" />}
      {!feed.isPending && !feed.error && feed.items.length === 0 && (
        <EmptyState title="該当する課題がありません" />
      )}
      {feed.items.length > 0 && (
        <div className="space-y-3">
          {feed.items.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}
      <div className="mt-4">
        <Pagination page={feed.page} pageSize={feed.pageSize} totalCount={feed.total} onPageChange={feed.setPage} />
      </div>
    </Card>
  );
}
