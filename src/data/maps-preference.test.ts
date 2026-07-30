import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearSavedMapsProviderId,
  getSavedMapsProviderIdSnapshot,
  saveMapsProviderId,
  subscribeToMapsProvider,
} from "./maps-preference";

const storage = vi.hoisted(() => {
  let value: string | null = null;

  return {
    getItemSync: vi.fn(() => value),
    setItemSync: vi.fn((_key: string, next: string) => {
      value = next;
    }),
    removeItemSync: vi.fn(() => {
      value = null;
    }),
    reset: () => {
      value = null;
    },
  };
});

vi.mock("expo-sqlite/kv-store", () => ({ default: storage }));
vi.mock("expo-linking", () => ({ canOpenURL: vi.fn() }));

describe("maps provider preference", () => {
  beforeEach(() => {
    clearSavedMapsProviderId();
    storage.reset();
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
