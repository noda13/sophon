import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Card } from './Card';
import { DataTable } from './DataTable';
import { Disclaimer, INVESTMENT_DISCLAIMER } from './Disclaimer';
import { EmptyState } from './EmptyState';
import { ErrorBox } from './ErrorBox';
import { FreshnessBadge } from './FreshnessBadge';
import { Loading } from './Loading';
import { Pagination } from './Pagination';
import { ScoreBadge, scoreTone } from './ScoreBadge';
import { Tabs } from './Tabs';

afterEach(cleanup);

describe('ui', () => {
  it('Loading は status を出す', () => {
    render(<Loading />);
    expect(screen.getByRole('status').textContent).toContain('読み込み中');
  });

  it('ErrorBox は alert でメッセージを出す', () => {
    render(<ErrorBox message="失敗しました" />);
    expect(screen.getByRole('alert').textContent).toBe('失敗しました');
  });

  it('EmptyState はタイトルと説明を出す', () => {
    render(<EmptyState title="なし" description="説明" />);
    expect(screen.getByText('なし')).toBeTruthy();
    expect(screen.getByText('説明')).toBeTruthy();
  });

  it('Card はタイトルと子要素を出す', () => {
    render(<Card title="見出し">本文</Card>);
    expect(screen.getByRole('heading', { name: '見出し' })).toBeTruthy();
    expect(screen.getByText('本文')).toBeTruthy();
  });

  it('ScoreBadge は値に応じた段階を返し、整数以外は小数1桁にする', () => {
    expect(scoreTone(10)).toBe('low');
    expect(scoreTone(45)).toBe('moderate');
    expect(scoreTone(70)).toBe('high');
    expect(scoreTone(90)).toBe('critical');
    expect(scoreTone(90, true)).toBe('low');
    render(<ScoreBadge label="リスク" score={42.345} />);
    expect(screen.getByText('42.3')).toBeTruthy();
  });

  it('Tabs は選択中のタブを示す', () => {
    render(
      <Tabs
        items={[
          { value: 'all', label: 'すべて' },
          { value: 'ai', label: 'AI' },
        ]}
        value="all"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('tab', { name: 'すべて' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'AI' }).getAttribute('aria-selected')).toBe('false');
  });

  it('DataTable はヘッダー、行、ソート表示を描く', () => {
    const onSort = vi.fn();
    render(
      <DataTable
        headers={[
          { id: 'name', label: '名前', sortDirection: 'asc', onSort },
          { id: 'score', label: 'スコア', align: 'right' },
        ]}
        rows={[{ id: 'a', cells: ['A社', 12] }]}
      />,
    );
    expect(screen.getByRole('columnheader', { name: /名前/ }).getAttribute('aria-sort')).toBe('ascending');
    expect(screen.getByText('A社')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /名前/ }));
    expect(onSort).toHaveBeenCalled();
  });

  it('DataTable は行がないとき空メッセージを出す', () => {
    render(<DataTable headers={[{ id: 'x', label: 'X' }]} rows={[]} />);
    expect(screen.getByText('該当するデータがありません')).toBeTruthy();
  });

  it('Pagination は1ページに収まるとき何も描かず、複数ページならページ番号を描く', () => {
    const onPageChange = vi.fn();
    const { container, rerender } = render(<Pagination page={1} pageSize={10} totalCount={5} onPageChange={onPageChange} />);
    expect(container.innerHTML).toBe('');
    rerender(<Pagination page={1} pageSize={10} totalCount={35} onPageChange={onPageChange} />);
    expect(screen.getByRole('button', { name: /next|次/i })).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('FreshnessBadge は正常時に警告を出さず、古いときと failed のときに出す', () => {
    const iso = '2026-11-07T00:00:00Z';
    const { rerender } = render(<FreshnessBadge generatedAt={iso} isStale={false} health="ok" />);
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<FreshnessBadge generatedAt={iso} isStale health="ok" />);
    expect(screen.getByRole('alert').textContent).toContain('古い');
    rerender(<FreshnessBadge generatedAt={iso} isStale={false} health="failed" />);
    expect(screen.getByRole('alert').textContent).toContain('失敗');
  });

  it('FreshnessBadge は generatedAt を持たない unknown で確認できない旨を warning で出し、日時は出さない', () => {
    render(<FreshnessBadge generatedAt={null} isStale={false} health="unknown" />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('確認できません');
    expect(alert.className).toContain('text-warning');
    expect(screen.queryByText(/更新$/)).toBeNull();
  });

  it('FreshnessBadge は日時なしの failed でも失敗の警告を danger で出す', () => {
    render(<FreshnessBadge generatedAt={null} isStale={false} health="failed" />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('失敗');
    expect(alert.className).toContain('text-danger');
    expect(screen.queryByText(/更新$/)).toBeNull();
  });

  it('FreshnessBadge は generatedAt があれば更新日時を出す', () => {
    render(<FreshnessBadge generatedAt="2026-11-07T00:00:00Z" isStale={false} health="ok" />);
    expect(screen.getByText(/更新$/)).toBeTruthy();
  });

  it('Disclaimer は免責文を出す', () => {
    render(<Disclaimer />);
    expect(screen.getByText(INVESTMENT_DISCLAIMER)).toBeTruthy();
  });
});
