import Storage from 'expo-sqlite/kv-store';

import { parseClosureLog, type ClosureLog } from '@/data/closure-log';

// SQLite-backed persistence for the closure observation log. Kept separate
// from closure-log.ts so the merge logic stays free of native imports (and
// unit-testable in Node) — same split as updates/update-history.

const STORAGE_KEY = 'lexy-closure-log-v1';

export async function loadClosureLog(): Promise<ClosureLog | null> {
  try {
    const raw = await Storage.getItem(STORAGE_KEY);
    return raw ? parseClosureLog(JSON.parse(raw)) : null;
  } catch {
    // A corrupt record just means we rebuild from the next fetch.
    return null;
  }
}

export async function saveClosureLog(log: ClosureLog): Promise<void> {
  await Storage.setItem(STORAGE_KEY, JSON.stringify(log));
}

/** Called from sign-out so no vehicle data survives an account switch. */
export async function clearClosureLog(): Promise<void> {
  await Storage.removeItem(STORAGE_KEY);
}
