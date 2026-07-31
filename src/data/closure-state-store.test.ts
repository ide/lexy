import { beforeEach, describe, expect, it } from "vitest";

import Storage from "expo-sqlite/kv-store";
import { resetKvStore } from "@/test-support/expo-sqlite-kv-store";
import type { ClosureStore } from "@/data/closure-state";
import { clearClosureStore, loadClosureStore, saveClosureStore } from "./closure-state-store";

// This module imports `expo-sqlite/kv-store` directly and needs no `vi.mock`:
// the vitest alias swaps in an in-memory store with the same API.
const STORAGE_KEY = "lexy-closure-state-v2";

const store: ClosureStore = {
  vin: "JTJ00000000000001",
  seq: 1,
  closures: {
    "Driver Door": {
      label: "Driver Door",
      order: 0,
      state: { value: "Closed", at: "2026-07-30T18:00:00Z" },
      locked: { value: true, at: "2026-07-30T18:00:00Z" },
    },
  },
};

describe("closure store persistence", () => {
  beforeEach(() => {
    resetKvStore();
  });

  it("round-trips a saved store", async () => {
    await saveClosureStore(store);

    expect(await loadClosureStore()).toEqual(store);
  });

  it("returns null when nothing has been saved", async () => {
    expect(await loadClosureStore()).toBeNull();
  });

  it("rebuilds from scratch when the stored record is unreadable", async () => {
    await Storage.setItem(STORAGE_KEY, "{not json");

    expect(await loadClosureStore()).toBeNull();
  });

  it("rebuilds from scratch when the stored record has the wrong shape", async () => {
    await Storage.setItem(STORAGE_KEY, JSON.stringify({ vin: 42 }));

    expect(await loadClosureStore()).toBeNull();
  });

  it("clears the record on sign-out", async () => {
    await saveClosureStore(store);
    await clearClosureStore();

    expect(await loadClosureStore()).toBeNull();
    expect(await Storage.getItem(STORAGE_KEY)).toBeNull();
  });
});
