// How the app renders instants. Every function here accepts either an ISO
// string (a server `occurrenceDate`) or epoch milliseconds (TanStack Query's
// `dataUpdatedAt`), because both are what the callers hold.

/** The precise timestamp behind the dashboard tooltips, in the device's time zone. */
export function absoluteLocalTime(from: string | number): string {
  const then = typeof from === "number" ? from : new Date(from).getTime();
  if (!Number.isFinite(then)) {
    return "Unknown time";
  }
  return new Date(then).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * A vehicle-reported timestamp placed on the device's clock, bounded by the read
 * that delivered it.
 *
 * The car stamps its events from its own clock and the app measures "how long
 * ago" against the phone's. Car clocks drift by minutes, so a car running ahead
 * produces a snapshot that reads as newer than the fetch carrying it — two
 * footer lines contradicting each other. We cannot know about a sync later than
 * our own read, so the read is the ceiling.
 *
 * Display-only: the stored `occurrenceDate` keeps the car's own value, because
 * the closure fold orders snapshots against each other in the car's clock (see
 * closure-state.ts).
 *
 * Returns NaN for an unparseable stamp, which `relativeTime` renders as
 * "unknown", and leaves the stamp alone when there is no read to bound it by.
 */
export function observedAt(at: string | undefined, fetchedAt: number): number {
  const time = at ? new Date(at).getTime() : NaN;
  if (!Number.isFinite(time)) {
    return NaN;
  }
  return fetchedAt > 0 ? Math.min(time, fetchedAt) : time;
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/**
 * A plain "how long ago" for the vehicle-sync and data-freshness lines. Reads
 * down to seconds and pairs the two largest units ("2 hours 5 minutes ago") so
 * recent syncs stay legible.
 */
export function relativeTime(from: string | number, now: number = Date.now()): string {
  const then = typeof from === "number" ? from : new Date(from).getTime();
  if (!Number.isFinite(then)) {
    return "unknown";
  }
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 5) {
    return "just now";
  }
  if (seconds < 60) {
    return `${plural(seconds, "second")} ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${plural(minutes, "minute")} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remMinutes = minutes % 60;
    return remMinutes === 0
      ? `${plural(hours, "hour")} ago`
      : `${plural(hours, "hour")} ${plural(remMinutes, "minute")} ago`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours === 0
    ? `${plural(days, "day")} ago`
    : `${plural(days, "day")} ${plural(remHours, "hour")} ago`;
}
