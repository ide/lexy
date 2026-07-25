import { describe, expect, it } from "vitest";

import { createUpdateHistoryRepository } from "./update-history-repository";
import type { UpdateActivityEvent } from "./update-utils";

class TestStorage {
  value: string | null = null;
  activeWrites = 0;
  maxActiveWrites = 0;
  writtenValues: unknown[] = [];

  async getItemAsync(): Promise<string | null> {
    await Promise.resolve();
    return this.value;
  }

  async setItemAsync(_key: string, value: string): Promise<void> {
    this.writtenValues.push(value);
    this.activeWrites += 1;
    this.maxActiveWrites = Math.max(this.maxActiveWrites, this.activeWrites);
    await new Promise((resolve) => setTimeout(resolve, 5));
    this.value = value;
    this.activeWrites -= 1;
  }
}

function event(id: string, timestamp: number): UpdateActivityEvent {
  return {
    id,
    timestamp,
    title: id,
    detail: `${id} detail`,
  };
}

describe("update history repository", () => {
  it("serializes concurrent read-merge-write operations", async () => {
    const storage = new TestStorage();
    const repository = createUpdateHistoryRepository(storage);

    await Promise.all([
      repository.record([event("first", 1)]),
      repository.record([event("second", 2)]),
    ]);

    expect(storage.maxActiveWrites).toBe(1);
    expect(await repository.read()).toEqual([
      event("second", 2),
      event("first", 1),
    ]);
  });

  it("passes a string to SQLite storage instead of opening an updater transaction", async () => {
    const storage = new TestStorage();
    const repository = createUpdateHistoryRepository(storage);

    await repository.record([event("check", 1)]);

    expect(storage.writtenValues).toHaveLength(1);
    expect(typeof storage.writtenValues[0]).toBe("string");
  });

  it("queues reads behind pending writes", async () => {
    const storage = new TestStorage();
    const repository = createUpdateHistoryRepository(storage);

    const write = repository.record([event("available", 1)]);
    const read = repository.read();

    await expect(read).resolves.toEqual([event("available", 1)]);
    await write;
  });
});
