import type { SFSymbol } from "sf-symbols-typescript";

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
  symbol: SFSymbol;
};

export type ClosuresSummary = {
  /** secure = green, attention = orange, busy = a lock command in flight. */
  kind: "secure" | "attention" | "busy";
  headline: string;
  subline: string | null;
  symbol: SFSymbol;
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
      subline: rest.length > 0 ? `${capitalize(humanList(rest))} closed` : null,
      symbol: locking ? "lock.fill" : "lock.open.fill",
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
    return {
      kind: "attention",
      headline: `${exceptions.length} need attention`,
      subline,
      symbol: "exclamationmark.triangle.fill",
      exceptions,
    };
  }

  // All clear. "All secure" only when every shown door is confirmed locked;
  // position-only data honestly claims closed, not locked.
  const secure = doorsPart === "Doors locked";
  // With full data the tail collapses to "everything else closed"; with
  // partial data it names exactly what was read, and claims nothing more.
  const restPart =
    rest.length === 0
      ? null
      : doorsPart && rest.length >= 3
        ? "everything else closed"
        : `${humanList(rest)} closed`;
  const parts = doorsPart ? [doorsPart, restPart] : [restPart ? capitalize(restPart) : null];
  const subline = parts.filter(Boolean).join(" · ") || null;
  return {
    kind: "secure",
    headline: secure ? "All secure" : "All closed",
    subline,
    symbol: secure ? "checkmark.shield.fill" : "checkmark.circle.fill",
    exceptions: [],
  };
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
