export const MASCOT_PREFERENCE_KEY = "kagura-mascot-preference-v1";

export type MascotPreference = "DISMISSED";

export interface MascotPreferenceStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
  readonly removeItem: (key: string) => void;
}

function getBrowserStorage(): MascotPreferenceStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readMascotPreference(
  storage: MascotPreferenceStorage | null = getBrowserStorage(),
): MascotPreference | null {
  try {
    return storage?.getItem(MASCOT_PREFERENCE_KEY) === "DISMISSED" ? "DISMISSED" : null;
  } catch {
    return null;
  }
}

export function writeMascotPreference(
  preference: MascotPreference,
  storage: MascotPreferenceStorage | null = getBrowserStorage(),
): void {
  try {
    storage?.setItem(MASCOT_PREFERENCE_KEY, preference);
  } catch {
    // Storage can be unavailable in private browsing or under a strict browser policy.
  }
}

export function clearMascotPreference(
  storage: MascotPreferenceStorage | null = getBrowserStorage(),
): void {
  try {
    storage?.removeItem(MASCOT_PREFERENCE_KEY);
  } catch {
    // The visible control must keep working even when persistence is denied.
  }
}
