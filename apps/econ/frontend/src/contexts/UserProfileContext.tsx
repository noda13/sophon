import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import type { UserProfile } from '../lib/types/profile';
import { isValidProfile } from '../lib/profileValidation';

const STORAGE_KEY = 'econoguard-profile';

interface UserProfileContextValue {
  profile: UserProfile | null;
  setProfile: (profile: UserProfile) => void;
  clearProfile: () => void;
}

const UserProfileContext = createContext<UserProfileContextValue>({
  profile: null,
  setProfile: () => {},
  clearProfile: () => {},
});

function loadProfile(): UserProfile | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isValidProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile | null>(loadProfile);

  const setProfile = useCallback((p: UserProfile) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      // Persistence is best-effort (private mode, quota); in-memory state still applies.
    }
    setProfileState(p);
  }, []);

  const clearProfile = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Persistence is best-effort; in-memory state still applies.
    }
    setProfileState(null);
  }, []);

  const value = useMemo<UserProfileContextValue>(
    () => ({ profile, setProfile, clearProfile }),
    [profile, setProfile, clearProfile],
  );

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}
