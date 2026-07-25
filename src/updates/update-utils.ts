type RunningUpdate = {
  updateId?: string;
  createdAt?: Date;
  isEmbeddedLaunch: boolean;
};

type UpdateCandidate = {
  updateId?: string;
  createdAt: Date;
};

export type UpdateEntry = {
  id: string;
  createdAt?: Date;
  source: string;
  state: 'Running now' | 'Downloaded · launches next' | 'Available to download';
};

export type UpdateActivityEvent = {
  id: string;
  timestamp: number;
  title: string;
  detail: string;
  updateId?: string;
  level?: 'info' | 'error';
};

export function sortNewestFirst<T extends { timestamp: number }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => b.timestamp - a.timestamp);
}

export function mergeUpdateActivity(
  existing: readonly UpdateActivityEvent[],
  incoming: readonly UpdateActivityEvent[],
  limit = 50,
): UpdateActivityEvent[] {
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of incoming) {
    if (!byId.has(entry.id)) {
      byId.set(entry.id, entry);
    }
  }
  return sortNewestFirst([...byId.values()]).slice(0, limit);
}

export function shortUpdateId(updateId: string | undefined): string {
  return updateId?.slice(0, 8) ?? 'Embedded';
}

export function buildUpdateEntries({
  running,
  available,
  downloaded,
}: {
  running: RunningUpdate;
  available?: UpdateCandidate;
  downloaded?: UpdateCandidate;
}): UpdateEntry[] {
  const runningId = running.updateId ?? 'embedded';
  const entries: UpdateEntry[] = [
    {
      id: runningId,
      createdAt: running.createdAt,
      source: running.isEmbeddedLaunch ? 'Embedded in build' : 'EAS Update',
      state: 'Running now',
    },
  ];

  if (downloaded && downloaded.updateId !== running.updateId) {
    entries.push({
      id: downloaded?.updateId ?? 'rollback-to-embedded',
      createdAt: downloaded?.createdAt,
      source: downloaded?.updateId ? 'EAS Update' : 'Rollback to embedded',
      state: 'Downloaded · launches next',
    });
  }

  if (
    available &&
    available.updateId !== running.updateId &&
    available.updateId !== downloaded?.updateId
  ) {
    entries.push({
      id: available.updateId ?? 'rollback-to-embedded',
      createdAt: available.createdAt,
      source: available.updateId ? 'EAS Update' : 'Rollback to embedded',
      state: 'Available to download',
    });
  }

  return entries;
}
