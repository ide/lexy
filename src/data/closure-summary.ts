import type { IconName } from "@/components/ui/icon-registry";
import { cornerVisibility, doorStatus, openingStatus, windowStatus } from "@/data/closure-display";
import type { Corner } from "@/data/closures";
import type { Closure } from "@/data/vehicle";

// The verdict the Doors & Windows card leads with: one headline for the whole
// closures area, plus the exceptions worth a row of their own. Pure and
// color-free, like closure-display, so it stays unit-testable.

export type SummaryException = {
  key: string;
  /** Row form — what is wrong ("Door unlocked"). */
  label: string;
  /** Row trailing — where ("Front driver"). Openings name themselves. */
  where?: string;
  /** Headline form used when this is the only exception ("Front driver door unlocked"). */
  headline: string;
  symbol: IconName;
};

export type ClosuresSummary = {
  /** secure = green, attention = orange, busy = a lock command in flight. */
  kind: "secure" | "attention" | "busy";
  /**
   * Sentence case, not title case like the app's labels. This slot holds a
   * *status*, and most of what can land in it is a phrase rather than a name:
   * "Front driver door unlocked", "2 open, 1 unlocked", "Trunk open". Title
   * case would make those read as shouting, so the two fixed verdicts —
   * "All secure", "All closed" — follow the dynamic ones rather than the
   * other way round.
   */
  headline: string;
  subline: string | null;
  symbol: IconName;
  /**
   * Exceptions beyond the headline. Populated only when more than one thing
   * needs attention — a single exception is the headline.
   */
  exceptions: SummaryException[];
};

// "windows, moonroof and trunk" — prose join for the settled groups.
function humanList(parts: string[]): string {
  if (parts.length <= 1) {
    return parts[0] ?? "";
  }
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type Shown = {
  doors: { corner: Corner; door: Closure }[];
  windows: { corner: Corner; window: Closure }[];
};

function shownReadings(corners: Corner[]): Shown {
  const doors: Shown["doors"] = [];
  const windows: Shown["windows"] = [];
  for (const corner of corners) {
    const { showDoor, showWindow } = cornerVisibility(corner);
    if (showDoor) {
      doors.push({ corner, door: corner.door! });
    }
    if (showWindow) {
      windows.push({ corner, window: corner.window! });
    }
  }
  return { doors, windows };
}

// The groups that are settled and shown, named for a subline: doors first,
// then windows and the openings by their own labels.
function settledGroups(
  shown: Shown,
  openings: Closure[],
  exceptions: SummaryException[],
): { doorsPart: string | null; rest: string[] } {
  const excepted = new Set(exceptions.map((e) => e.key));
  const settledDoors = shown.doors.filter(({ corner }) => !excepted.has(`door:${corner.key}`));
  const settledWindows = shown.windows.filter(
    ({ corner }) => !excepted.has(`window:${corner.key}`),
  );
  const settledOpenings = openings.filter((o) => !excepted.has(`opening:${o.label}`));

  const doorsPart =
    settledDoors.length === 0
      ? null
      : settledDoors.every(({ door }) => door.locked === true)
        ? "Doors locked"
        : "Doors closed";
  const rest = [
    ...(settledWindows.length > 0 ? ["windows"] : []),
    ...settledOpenings.map((o) => o.label.toLowerCase()),
  ];
  return { doorsPart, rest };
}

export function closuresSummary(corners: Corner[], openings: Closure[]): ClosuresSummary {
  const shown = shownReadings(corners);

  // A lock/unlock command in flight owns the headline: the doors are in flux,
  // so neither "locked" nor "unlocked" is worth asserting yet.
  const optimistic = shown.doors.find(({ door }) => door.lockedOptimistic);
  if (optimistic) {
    const locking = optimistic.door.locked === true;
    const exceptions = collectExceptions({ doors: [], windows: shown.windows }, openings);
    const { rest } = settledGroups({ doors: [], windows: shown.windows }, openings, exceptions);
    return {
      kind: "busy",
      headline: locking ? "Locking…" : "Unlocking…",
      subline: restSubline(rest),
      symbol: locking ? "lock" : "lock-open",
      exceptions,
    };
  }

  const exceptions = collectExceptions(shown, openings);
  const { doorsPart, rest } = settledGroups(shown, openings, exceptions);

  if (exceptions.length > 0) {
    const settledCount = (doorsPart ? 1 : 0) + rest.length;
    // "and locked" only when the remaining doors really carry lock readings.
    const subline =
      settledCount === 0
        ? null
        : doorsPart === "Doors locked"
          ? "Everything else closed and locked"
          : "Everything else closed";
    if (exceptions.length === 1) {
      const only = exceptions[0];
      return {
        kind: "attention",
        headline: only.headline,
        subline,
        symbol: only.symbol,
        exceptions: [],
      };
    }
    // The headline states facts, not a verdict — "2 open, 1 unlocked" rather
    // than an alarm like "needs attention": an open window in the garage may
    // be entirely intentional.
    const unlocked = exceptions.filter((e) => e.label.endsWith("unlocked")).length;
    const open = exceptions.length - unlocked;
    const headline =
      unlocked === 0
        ? `${open} open`
        : open === 0
          ? `${unlocked} doors unlocked`
          : `${open} open, ${unlocked} unlocked`;
    return {
      kind: "attention",
      headline,
      subline,
      // All-unlocked wears the open lock; a mix of kinds has no single glyph.
      symbol: open === 0 ? "lock-open" : "warning",
      exceptions,
    };
  }

  // All clear. "All secure" only when every shown door is confirmed locked;
  // position-only data honestly claims closed, not locked.
  const secure = doorsPart === "Doors locked";
  const subline = [doorsPart, restSubline(rest)].filter(Boolean).join(" · ") || null;
  return {
    kind: "secure",
    headline: secure ? "All secure" : "All closed",
    subline,
    symbol: secure ? "shield-check" : "check-circle",
    exceptions: [],
  };
}

// The settled tail of a subline. With full data it collapses to "Everything
// else closed"; with partial data it names exactly what was read, and claims
// nothing more.
function restSubline(rest: string[]): string | null {
  if (rest.length === 0) {
    return null;
  }
  return rest.length >= 3 ? "Everything else closed" : `${capitalize(humanList(rest))} closed`;
}

function collectExceptions(shown: Shown, openings: Closure[]): SummaryException[] {
  const exceptions: SummaryException[] = [];
  for (const { corner, door } of shown.doors) {
    const status = doorStatus(door);
    if (status.tone === "attention") {
      exceptions.push({
        key: `door:${corner.key}`,
        label: status.text,
        where: corner.title,
        headline: `${corner.title} ${status.text.toLowerCase()}`,
        symbol: status.symbol,
      });
    }
  }
  for (const { corner, window } of shown.windows) {
    const status = windowStatus(window, corner.side);
    if (status.tone === "attention") {
      exceptions.push({
        key: `window:${corner.key}`,
        label: status.text,
        where: corner.title,
        headline: `${corner.title} ${status.text.toLowerCase()}`,
        symbol: status.symbol,
      });
    }
  }
  for (const opening of openings) {
    const status = openingStatus(opening);
    if (status.tone === "attention") {
      exceptions.push({
        key: `opening:${opening.label}`,
        label: status.text,
        headline: status.text,
        symbol: status.symbol,
      });
    }
  }
  return exceptions;
}
