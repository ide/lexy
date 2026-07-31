import type { SFSymbol } from "sf-symbols-typescript";

import type { Corner, Side } from "@/data/closures";
import type { Closure } from "@/data/vehicle";

// How a closure reading is displayed: the sentence, the glyph, and a tone the
// component maps to a color ("attention" draws the warning orange, "settled"
// the reassuring green). Kept color-free so this module stays pure and
// testable — the theme palette pulls in native modules.
export type ClosureTone = "attention" | "settled";

export type ClosureStatus = { text: string; tone: ClosureTone; symbol: SFSymbol };

export function doorStatus(door: Closure): ClosureStatus {
  if (door.state === "Open") {
    return { text: "Door open", tone: "attention", symbol: "lock.open.fill" };
  }
  if (door.locked === false) {
    return {
      text: door.lockedOptimistic ? "Unlocking…" : "Door unlocked",
      tone: "attention",
      symbol: "lock.open.fill",
    };
  }
  if (door.locked === true) {
    return {
      text: door.lockedOptimistic ? "Locking…" : "Door locked",
      tone: "settled",
      symbol: "lock.fill",
    };
  }
  // Position known (closed) but no lock reading.
  return { text: "Door closed", tone: "settled", symbol: "checkmark.circle.fill" };
}

// Windows carry only a position, so one without a state has nothing to say —
// callers skip it rather than render a guess.
export function windowStatus(window: Closure, side: Side): ClosureStatus {
  // The `car.window.left`/`right` glyphs read reversed against our driver-left /
  // passenger-right columns, so the sides are intentionally swapped here.
  const symbol: SFSymbol = side === "driver" ? "car.window.right" : "car.window.left";
  return window.state === "Open"
    ? { text: "Window open", tone: "attention", symbol }
    : { text: "Window closed", tone: "settled", symbol };
}

// Non-door/window closures (moonroof, trunk, hood). Each carries its own
// identity glyph; open/closed is conveyed by color + the written word rather
// than a checkmark, keeping them visually consistent with doors and windows.
const OPENING_SYMBOLS: { match: RegExp; open: SFSymbol; closed: SFSymbol }[] = [
  { match: /moonroof|sunroof/i, open: "window.ceiling", closed: "window.ceiling.closed" },
  {
    match: /trunk|hatch|tailgate/i,
    open: "car.side.rear.crop.trunk.partition.fill",
    closed: "car.side.rear.crop.trunk.partition.fill",
  },
  { match: /hood/i, open: "engine.combustion.fill", closed: "engine.combustion.fill" },
];

export function openingStatus(opening: Closure): ClosureStatus {
  const isOpen = opening.state === "Open";
  const match = OPENING_SYMBOLS.find((o) => o.match.test(opening.label));
  const symbol: SFSymbol = match
    ? isOpen
      ? match.open
      : match.closed
    : isOpen
      ? "exclamationmark.triangle.fill"
      : "checkmark.circle.fill";
  return {
    text: `${opening.label} ${isOpen ? "open" : "closed"}`,
    tone: isOpen ? "attention" : "settled",
    symbol,
  };
}

// Which of a corner's readings are actually shown. Written once so the card
// and the staleness note below it cannot disagree about what is on screen.
export function cornerVisibility(corner: Corner): {
  showDoor: boolean;
  showWindow: boolean;
} {
  return {
    showDoor: Boolean(corner.door && (corner.door.state || corner.door.locked !== undefined)),
    // A window with no position reading has nothing to report.
    showWindow: Boolean(corner.window?.state),
  };
}

// The field timestamps a corner actually displays — fed to the section's
// single staleness note rather than one note per card.
export function cornerShownAts(corner: Corner): (string | undefined)[] {
  const { showDoor, showWindow } = cornerVisibility(corner);
  return [
    showDoor ? corner.door?.stateAt : undefined,
    showDoor ? corner.door?.lockedAt : undefined,
    showWindow ? corner.window?.stateAt : undefined,
  ];
}

// Of the given field timestamps, the oldest one that predates the latest
// snapshot (`freshAt`) — i.e. a reading the most recent status didn't refresh.
// Null when everything shown is as fresh as the latest snapshot.
export function oldestStale(freshAt: string, ats: (string | undefined)[]): string | null {
  const fresh = new Date(freshAt).getTime();
  if (!Number.isFinite(fresh)) {
    return null;
  }
  let oldest: string | null = null;
  for (const at of ats) {
    if (!at) {
      continue;
    }
    const time = new Date(at).getTime();
    if (Number.isFinite(time) && time < fresh) {
      if (oldest === null || time < new Date(oldest).getTime()) {
        oldest = at;
      }
    }
  }
  return oldest;
}
