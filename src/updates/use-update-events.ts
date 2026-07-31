import * as Updates from "expo-updates";
import { useCallback, useEffect, useRef, useState } from "react";

import { readUpdateActivity } from "@/updates/update-history";
import { sortNewestFirst, type UpdateActivityEvent } from "@/updates/update-utils";
import { haptic } from "@/utils/haptics";

export const MAX_VISIBLE_EVENTS = 20;
const NATIVE_LOG_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

function sameEntries<T>(previous: T[], next: T[]): boolean {
  return (
    previous.length === next.length &&
    previous.every((entry, index) => JSON.stringify(entry) === JSON.stringify(next[index]))
  );
}

/**
 * The two event lists on the update diagnostics screen — the native
 * expo-updates log and Lexy's own recorded activity — plus the refresh
 * plumbing they share.
 */
export function useUpdateEvents(onReadError: (message: string) => void) {
  const [logs, setLogs] = useState<Updates.UpdatesLogEntry[]>([]);
  const [activity, setActivity] = useState<UpdateActivityEvent[]>([]);
  const exclusiveRef = useRef(false);
  // The error sink lives in a ref so the initial-load effect below cannot
  // re-fire when a caller passes a fresh callback each render.
  const onReadErrorRef = useRef(onReadError);
  onReadErrorRef.current = onReadError;

  const refreshEvents = useCallback(async () => {
    const [nativeEntries, activityEntries] = await Promise.all([
      Updates.readLogEntriesAsync(NATIVE_LOG_MAX_AGE_MS),
      readUpdateActivity(),
    ]);
    const nextLogs = sortNewestFirst(nativeEntries).slice(0, MAX_VISIBLE_EVENTS);
    const nextActivity = sortNewestFirst(activityEntries).slice(0, MAX_VISIBLE_EVENTS);
    // Keep the previous arrays when nothing changed so a no-op refresh does
    // not re-render (and visibly flash) the native tree.
    setLogs((previous) => (sameEntries(previous, nextLogs) ? previous : nextLogs));
    setActivity((previous) => (sameEntries(previous, nextActivity) ? previous : nextActivity));
  }, []);

  useEffect(() => {
    refreshEvents().catch((error: unknown) => {
      onReadErrorRef.current(
        error instanceof Error ? error.message : "Could not read update logs.",
      );
    });
  }, [refreshEvents]);

  /**
   * Run a task unless one started through this gate is still in flight — the
   * Refresh button and pull-to-refresh share it, so they cannot stack.
   */
  const runExclusive = useCallback(async (task: () => Promise<void>) => {
    if (exclusiveRef.current) {
      return;
    }
    exclusiveRef.current = true;
    try {
      await task();
    } finally {
      exclusiveRef.current = false;
    }
  }, []);

  const refreshEventLists = useCallback(
    () =>
      runExclusive(async () => {
        try {
          await refreshEvents();
          haptic("selection");
        } catch (error) {
          onReadErrorRef.current(
            error instanceof Error ? error.message : "Could not read update logs.",
          );
        }
      }),
    [refreshEvents, runExclusive],
  );

  return { logs, activity, refreshEvents, refreshEventLists, runExclusive };
}
