import Storage from "expo-sqlite/kv-store";

import { parseClosureStore, type ClosureStore } from "@/data/closure-state";

// SQLite-backed persistence for the materialized closure store. Kept separate
// from closure-state.ts so the fold/merge logic stays free of native imports
// (and unit-testable in Node) — same split as updates/update-history.
//
// v2 supersedes the earlier event-log key (lexy-closure-log-v1); the old blob
// is simply abandoned and rebuilt from the next fetch.
const STORAGE_KEY = "lexy-closure-state-v2";

export async function loadClosureStore(): Promise<ClosureStore | null> {
  try {
    const raw = await Storage.getItem(STORAGE_KEY);
    return raw ? parseClosureStore(JSON.parse(raw)) : null;
  } catch {
    // A corrupt record just means we rebuild from the next fetch.
    return null;
  }
}

export async function saveClosureStore(store: ClosureStore): Promise<void> {
  await Storage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/** Called from sign-out so no vehicle data survives an account switch. */
export async function clearClosureStore(): Promise<void> {
  await Storage.removeItem(STORAGE_KEY);
}
