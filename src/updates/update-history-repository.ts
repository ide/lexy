import {
  mergeUpdateActivity,
  type UpdateActivityEvent,
} from "./update-utils";

export interface UpdateHistoryStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

export interface UpdateHistoryRepository {
  read(): Promise<UpdateActivityEvent[]>;
  /** Resolves with the events that were newly persisted (ids not seen before). */
  record(events: readonly UpdateActivityEvent[]): Promise<UpdateActivityEvent[]>;
}

function parseActivity(value: string | null): UpdateActivityEvent[] {
  if (!value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as UpdateActivityEvent[]) : [];
  } catch {
    return [];
  }
}

export function createUpdateHistoryRepository(
  storage: UpdateHistoryStorage,
  storageKey = "lexy.update-activity.v1",
): UpdateHistoryRepository {
  let queue: Promise<void> = Promise.resolve();

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation, operation);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return {
    read: () =>
      enqueue(async () => parseActivity(await storage.getItemAsync(storageKey))),
    record: (events) => {
      if (events.length === 0) {
        return Promise.resolve([]);
      }
      return enqueue(async () => {
        const previous = parseActivity(await storage.getItemAsync(storageKey));
        const seenIds = new Set(previous.map((entry) => entry.id));
        const added: UpdateActivityEvent[] = [];
        for (const entry of events) {
          if (!seenIds.has(entry.id)) {
            seenIds.add(entry.id);
            added.push(entry);
          }
        }
        const merged = mergeUpdateActivity(previous, events);
        await storage.setItemAsync(storageKey, JSON.stringify(merged));
        return added;
      });
    },
  };
}
