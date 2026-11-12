/**
 * localStorage helpers. Every call is wrapped in try/catch because storage can
 * be blocked (private mode, strict settings) and the app must still work.
 */
export const RESUME_KEY = "rkm:resume";

export function loadSaved(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function save(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
