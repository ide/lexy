import { Observe } from 'expo-observe';
import { SQLiteStorage } from 'expo-sqlite/kv-store';

import { createUpdateHistoryRepository } from '@/updates/update-history-repository';
import { observeEventForActivity } from '@/updates/update-observe';
import type { UpdateActivityEvent } from '@/updates/update-utils';

const repository = createUpdateHistoryRepository(
  new SQLiteStorage('LexyUpdateHistory'),
);

export async function readUpdateActivity(): Promise<UpdateActivityEvent[]> {
  return repository.read();
}

export async function recordUpdateActivity(
  events: readonly UpdateActivityEvent[],
): Promise<void> {
  if (events.length === 0) {
    return;
  }
  // Mirror only newly persisted activity to EAS Observe — the repository
  // dedupes by id, so recorder re-renders don't produce duplicate events.
  const added = await repository.record(events);
  for (const event of added) {
    const observeEvent = observeEventForActivity(event);
    if (observeEvent) {
      Observe.logEvent(observeEvent.name, observeEvent.options);
    }
  }
}
