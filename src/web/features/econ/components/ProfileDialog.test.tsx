import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '../logic/profile';
import { PROFILE_PRESETS } from '../logic/profilePresets';
import { ProfileDialog } from './ProfileDialog';

const saved: UserProfile = { age: 55, sensitivity: 'relaxed', allocation: PROFILE_PRESETS[2]!.allocation };
const CONFIRM_MESSAGE = '保存していない変更があります。閉じますか？';

function Harness() {
  const [open, setOpen] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(saved);
  return (
    <ProfileDialog
      open={open}
      onOpenChange={setOpen}
      profile={profile}
      onSave={setProfile}
      onClear={() => setProfile(null)}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function editAge(value: string) {
  fireEvent.change(screen.getByLabelText('年齢'), { target: { value } });
}

function clickClose() {
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '閉じる' }));
}

describe('ProfileDialog の未保存ガード', () => {
  it('未保存の変更があって確認でキャンセルすると閉じない', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Harness />);
    editAge('60');
    clickClose();

    await vi.waitFor(() => expect(confirm).toHaveBeenCalledWith(CONFIRM_MESSAGE));
    expect(screen.queryByRole('dialog')).not.toBeNull();
  });

  it('未保存の変更があって確認で OK すると閉じる', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Harness />);
    editAge('60');
    clickClose();

    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Esc でも確認を挟む', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Harness />);
    await screen.findByRole('dialog');
    // Ark の Esc リスナーは開いた直後には効かないので、登録を待つ
    await new Promise((r) => setTimeout(r, 50));
    editAge('60');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape', code: 'Escape' });

    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeNull();
  });

  it('変更がなければ確認せずに閉じる', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<Harness />);
    clickClose();

    expect(confirm).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('保存して閉じるときは確認しない', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<Harness />);
    editAge('60');
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(confirm).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('設定をクリアして閉じるときは確認しない', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<Harness />);
    editAge('60');
    fireEvent.click(screen.getByRole('button', { name: '設定をクリア' }));

    expect(confirm).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
