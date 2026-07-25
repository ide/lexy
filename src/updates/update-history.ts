import Storage from 'expo-sqlite/kv-store';

import {
  mergeUpdateActivity,
  type UpdateActivityEvent,
} from '@/updates/update-utils';

const STORAGE_KEY = 'lexy.update-activity.v1';

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

export async function readUpdateActivity(): Promise<UpdateActivityEvent[]> {
  return parseActivity(await Storage.getItemAsync(STORAGE_KEY));
}

export async function recordUpdateActivity(
  events: readonly UpdateActivityEvent[],
): Promise<void> {
  if (events.length === 0) {
    return;
  }
  await Storage.setItemAsync(STORAGE_KEY, (previous) =>
    JSON.stringify(mergeUpdateActivity(parseActivity(previous), events)),
  );
}
