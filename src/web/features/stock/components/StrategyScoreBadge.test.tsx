import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StrategyScoreBadge } from './StrategyScoreBadge';

afterEach(cleanup);

describe('StrategyScoreBadge', () => {
  it('reason が無いときはスコアだけ描画し、フォーカス対象にしない', () => {
    render(<StrategyScoreBadge score={72} reason="" />);
    expect(screen.getByText('72').closest('[tabindex]')).toBeNull();
  });

  it('reason があるときはキーボードで到達でき、フォーカスで理由が見える', async () => {
    render(<StrategyScoreBadge score={72} reason="出来高が急増" />);
    const trigger = screen.getByText('72').closest('[tabindex]') as HTMLElement;
    expect(trigger.getAttribute('tabindex')).toBe('0');
    expect(screen.queryByRole('tooltip')).toBeNull();

    // Ark は keyboard modality のフォーカスでしか開かない。modality 追跡の登録は mount 後の非同期処理で行われる
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(document.body, { key: 'Tab' });
    trigger.focus();
    fireEvent.focus(trigger);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toBe('出来高が急増');
    expect(tooltip.getAttribute('data-state')).toBe('open');
  });
});
