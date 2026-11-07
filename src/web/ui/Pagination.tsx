import { Pagination as ArkPagination } from '@ark-ui/react/pagination';

interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

const BUTTON =
  'min-w-9 rounded-md border border-border px-2.5 py-1 text-sm text-fg-muted hover:border-border-strong hover:text-fg disabled:cursor-not-allowed disabled:opacity-40';

export function Pagination({ page, pageSize, totalCount, onPageChange }: PaginationProps) {
  if (totalCount <= pageSize) return null;

  return (
    <ArkPagination.Root
      count={totalCount}
      pageSize={pageSize}
      page={page}
      onPageChange={(d) => onPageChange(d.page)}
      aria-label="ページ送り"
    >
      <div className="flex flex-wrap items-center justify-center gap-1">
        <ArkPagination.PrevTrigger className={BUTTON}>前へ</ArkPagination.PrevTrigger>
        <ArkPagination.Context>
          {(api) =>
            api.pages.map((p, i) =>
              p.type === 'page' ? (
                <ArkPagination.Item
                  key={p.value}
                  {...p}
                  className={`${BUTTON} data-[selected]:border-accent data-[selected]:bg-accent-muted data-[selected]:text-fg`}
                >
                  {p.value}
                </ArkPagination.Item>
              ) : (
                <ArkPagination.Ellipsis key={`e${i}`} index={i} className="px-1 text-fg-subtle">
                  …
                </ArkPagination.Ellipsis>
              ),
            )
          }
        </ArkPagination.Context>
        <ArkPagination.NextTrigger className={BUTTON}>次へ</ArkPagination.NextTrigger>
      </div>
    </ArkPagination.Root>
  );
}
