import {
  DifficultySchema,
  ISSUE_CATEGORIES,
  ISSUE_CATEGORY_LABELS,
  type Issue,
  SourceTypeSchema,
} from '../../../../shared/schema/issue';
import { Select, type SelectOption } from '../../../ui/Select';
import { Tabs, type TabItem } from '../../../ui/Tabs';
import { type CategoryFilter, CategoryFilterSchema, ISSUE_SORT_LABELS, type IssueSort, IssueSortSchema } from '../logic/issues';
import { DIFFICULTY_LABELS, UNCATEGORIZED_LABEL } from '../logic/format';

const ALL = 'all';

export const CATEGORY_OPTIONS: readonly SelectOption[] = [
  { value: ALL, label: 'すべてのカテゴリ' },
  ...ISSUE_CATEGORIES.map((c) => ({ value: c, label: ISSUE_CATEGORY_LABELS[c] })),
  { value: 'none', label: UNCATEGORIZED_LABEL },
];

export const SORT_OPTIONS: readonly SelectOption[] = IssueSortSchema.options.map((s) => ({
  value: s,
  label: ISSUE_SORT_LABELS[s],
}));

export const SOURCE_TYPE_TABS: readonly TabItem[] = [
  { value: ALL, label: 'すべて' },
  { value: 'news_jp', label: '国内' },
  { value: 'news_global', label: '海外' },
  { value: 'gov', label: '政府' },
  { value: 'twitter', label: 'Twitter' },
];

export const DIFFICULTY_TABS: readonly TabItem[] = [
  { value: ALL, label: 'すべて' },
  { value: 'low', label: DIFFICULTY_LABELS.low },
  { value: 'medium', label: DIFFICULTY_LABELS.medium },
  { value: 'high', label: DIFFICULTY_LABELS.high },
];

export function CategorySelect({
  value,
  onChange,
}: {
  value: CategoryFilter | undefined;
  onChange: (value: CategoryFilter | undefined) => void;
}) {
  return (
    <Select
      label="カテゴリ"
      options={CATEGORY_OPTIONS}
      value={value ?? ALL}
      onChange={(v) => onChange(CategoryFilterSchema.safeParse(v).data)}
    />
  );
}

export function SortSelect({ value, onChange }: { value: IssueSort; onChange: (value: IssueSort) => void }) {
  return (
    <Select
      label="並び順"
      options={SORT_OPTIONS}
      value={value}
      onChange={(v) => {
        const parsed = IssueSortSchema.safeParse(v);
        if (parsed.success) onChange(parsed.data);
      }}
    />
  );
}

export function SourceTypeTabs({
  value,
  onChange,
}: {
  value: Issue['sourceType'] | undefined;
  onChange: (value: Issue['sourceType'] | undefined) => void;
}) {
  return (
    <Tabs
      ariaLabel="ソース種別"
      items={SOURCE_TYPE_TABS}
      value={value ?? ALL}
      onChange={(v) => onChange(SourceTypeSchema.safeParse(v).data)}
    />
  );
}

export function DifficultyTabs({
  value,
  onChange,
}: {
  value: Exclude<Issue['difficulty'], ''> | undefined;
  onChange: (value: Exclude<Issue['difficulty'], ''> | undefined) => void;
}) {
  return (
    <Tabs
      ariaLabel="開発難易度"
      items={DIFFICULTY_TABS}
      value={value ?? ALL}
      onChange={(v) => onChange(DifficultySchema.safeParse(v).data)}
    />
  );
}
