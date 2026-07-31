// In-memory stand-in for `expo-sqlite/kv-store`, wired up globally by the
// `resolve.alias` in vitest.config.ts so any module under test can import the
// real specifier without a per-file `vi.mock`.
//
// Why an alias instead of the real package: `expo-sqlite/kv-store` re-exports
// `build/Storage.js`, which does `import { openDatabaseSync } from './index'`.
// Vitest externalizes node_modules and lets Node's ESM resolver load it, and
// that resolver does not add file extensions — so the import throws before any
// native module is reached. Expo's server-runtime entry (web/SQLiteModule.node)
// is not a way out either: it is an explicit no-op stub, so following the web
// support docs would give us a store that silently drops every write.
//
// The surface here matches SQLiteStorage from expo-sqlite so app code cannot
// tell the difference: sync methods, async methods, and the AsyncStorage-shaped
// aliases. Databases are keyed by name in a module-level registry, so two
// `new SQLiteStorage("LexyUpdateHistory")` instances share rows the way the real
// SQLite-backed store does.

import type { SQLiteStorage as ExpoSQLiteStorage } from "expo-sqlite/kv-store";

type SetItemUpdateFunction = (previous: string | null) => string;

const databases = new Map<string, Map<string, string>>();

function tableFor(databaseName: string): Map<string, string> {
  let table = databases.get(databaseName);
  if (!table) {
    table = new Map();
    databases.set(databaseName, table);
  }
  return table;
}

/**
 * Drop every stored row. Vitest isolates modules per test file, so this is only
 * needed between tests in the same file (typically from `beforeEach`).
 */
export function resetKvStore(): void {
  databases.clear();
}

export class SQLiteStorage {
  constructor(public readonly databaseName: string) {}

  private get table(): Map<string, string> {
    return tableFor(this.databaseName);
  }

  private resolveValue(key: string, value: string | SetItemUpdateFunction): string {
    return typeof value === "function" ? value(this.getItemSync(key)) : value;
  }

  // --- Sync ---

  getItemSync(key: string): string | null {
    return this.table.get(key) ?? null;
  }

  setItemSync(key: string, value: string | SetItemUpdateFunction): void {
    this.table.set(key, this.resolveValue(key, value));
  }

  removeItemSync(key: string): boolean {
    return this.table.delete(key);
  }

  getAllKeysSync(): string[] {
    return [...this.table.keys()];
  }

  clearSync(): boolean {
    const had = this.table.size > 0;
    this.table.clear();
    return had;
  }

  closeSync(): void {}

  getLengthSync(): number {
    return this.table.size;
  }

  getKeyByIndexSync(index: number): string | null {
    // Negative indices count from the end, matching normalizeStorageIndex.
    const keys = this.getAllKeysSync();
    const offset = index < 0 ? keys.length + index : index;
    return keys[offset] ?? null;
  }

  // --- Async ---

  async getItemAsync(key: string): Promise<string | null> {
    return this.getItemSync(key);
  }

  async setItemAsync(key: string, value: string | SetItemUpdateFunction): Promise<void> {
    this.setItemSync(key, value);
  }

  async removeItemAsync(key: string): Promise<boolean> {
    return this.removeItemSync(key);
  }

  async getAllKeysAsync(): Promise<string[]> {
    return this.getAllKeysSync();
  }

  async clearAsync(): Promise<boolean> {
    return this.clearSync();
  }

  async closeAsync(): Promise<void> {}

  async getLengthAsync(): Promise<number> {
    return this.getLengthSync();
  }

  async getKeyByIndexAsync(index: number): Promise<string | null> {
    return this.getKeyByIndexSync(index);
  }

  // --- AsyncStorage-compatible aliases ---

  async getItem(key: string): Promise<string | null> {
    return this.getItemSync(key);
  }

  async setItem(key: string, value: string | SetItemUpdateFunction): Promise<void> {
    this.setItemSync(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.removeItemSync(key);
  }

  async getAllKeys(): Promise<string[]> {
    return this.getAllKeysSync();
  }

  async clear(): Promise<void> {
    this.clearSync();
  }

  /** Shallow-merges a JSON object into the existing record, like AsyncStorage. */
  async mergeItem(key: string, value: string): Promise<void> {
    const existing = this.getItemSync(key);
    if (existing == null) {
      this.setItemSync(key, value);
      return;
    }
    const merged: unknown = {
      ...(JSON.parse(existing) as object),
      ...(JSON.parse(value) as object),
    };
    this.setItemSync(key, JSON.stringify(merged));
  }

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    return keys.map((key) => [key, this.getItemSync(key)]);
  }

  async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    keyValuePairs.forEach(([key, value]) => this.setItemSync(key, value));
  }

  async multiRemove(keys: string[]): Promise<void> {
    keys.forEach((key) => this.removeItemSync(key));
  }

  async multiMerge(keyValuePairs: [string, string][]): Promise<void> {
    for (const [key, value] of keyValuePairs) {
      await this.mergeItem(key, value);
    }
  }

  async close(): Promise<void> {}
}

export const AsyncStorage = new SQLiteStorage("ExpoSQLiteStorage");
export const Storage = AsyncStorage;
export default AsyncStorage;

// Type-only guard against drift: `tsc` resolves `expo-sqlite/kv-store` to the
// real package (the alias is vitest-only), so this fails to compile if Expo
// adds a method or changes a signature the fake does not cover. The mapped type
// drops the real class's private fields, which are not ours to reproduce.
type PublicStorageApi = { [K in keyof ExpoSQLiteStorage]: ExpoSQLiteStorage[K] };
AsyncStorage satisfies PublicStorageApi;
