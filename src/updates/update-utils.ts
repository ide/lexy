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
