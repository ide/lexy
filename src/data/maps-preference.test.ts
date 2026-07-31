import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetKvStore } from "@/test-support/expo-sqlite-kv-store";
import {
  clearSavedMapsProviderId,
  getSavedMapsProviderIdSnapshot,
  saveMapsProviderId,
  subscribeToMapsProvider,
} from "./maps-preference";

// `expo-sqlite/kv-store` resolves to the in-memory fake via vitest.config.ts.
vi.mock("expo-linking", () => ({ canOpenURL: vi.fn() }));

describe("maps provider preference", () => {
  beforeEach(() => {
    clearSavedMapsProviderId();
    resetKvStore();
    vi.clearAllMocks();
  });

  it("publishes a saved choice to every subscriber", () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeToMapsProvider(first);
    const unsubscribeSecond = subscribeToMapsProvider(second);

    saveMapsProviderId("google");

    expect(getSavedMapsProviderIdSnapshot()).toBe("google");
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();

    unsubscribeFirst();
    saveMapsProviderId("waze");

    expect(getSavedMapsProviderIdSnapshot()).toBe("waze");
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledTimes(2);
    unsubscribeSecond();
  });

  it("publishes when a stale choice is cleared", () => {
    saveMapsProviderId("apple");
    const listener = vi.fn();
    const unsubscribe = subscribeToMapsProvider(listener);

    clearSavedMapsProviderId();

    expect(getSavedMapsProviderIdSnapshot()).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
