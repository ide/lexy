import { SQLiteStorage } from "expo-sqlite/kv-store";

import { createUpdateHistoryRepository } from "@/updates/update-history-repository";
import type { UpdateActivityEvent } from "@/updates/update-utils";

const repository = createUpdateHistoryRepository(new SQLiteStorage("LexyUpdateHistory"));

export async function readUpdateActivity(): Promise<UpdateActivityEvent[]> {
  return repository.read();
}

export async function recordUpdateActivity(events: readonly UpdateActivityEvent[]): Promise<void> {
  if (events.length === 0) {
    return;
  }
  await repository.record(events);
}
