import type { IconName } from "@/components/ui/icon-registry";
import type { Corner, Side } from "@/data/closures";
import type { Closure } from "@/data/vehicle";

// How a closure reading is displayed: the sentence, the glyph, and a tone the
// component maps to a color ("attention" draws the warning orange, "settled"
// the reassuring green). Kept color-free so this module stays pure and
// testable — the theme palette pulls in native modules.
export type ClosureTone = "attention" | "settled";

export type ClosureStatus = { text: string; tone: ClosureTone; symbol: IconName };

export function doorStatus(door: Closure): ClosureStatus {
  if (door.state === "Open") {
    return { text: "Door open", tone: "attention", symbol: "lock-open" };
  }
  if (door.locked === false) {
    return {
      text: door.lockedOptimistic ? "Unlocking…" : "Door unlocked",
      tone: "attention",
      symbol: "lock-open",
    };
  }
  if (door.locked === true) {
    return {
      text: door.lockedOptimistic ? "Locking…" : "Door locked",
      tone: "settled",
      symbol: "lock",
    };
  }
  // Position known (closed) but no lock reading.
  return { text: "Door closed", tone: "settled", symbol: "check-circle" };
}

// Windows carry only a position, so one without a state has nothing to say —
// callers skip it rather than render a guess.
export function windowStatus(window: Closure, side: Side): ClosureStatus {
  // The left/right window glyphs read reversed against our driver-left /
  // passenger-right columns, so the sides are intentionally swapped here.
  const symbol: IconName = side === "driver" ? "car-window-right" : "car-window-left";
  return window.state === "Open"
    ? { text: "Window open", tone: "attention", symbol }
    : { text: "Window closed", tone: "settled", symbol };
}

// Non-door/window closures (moonroof, trunk, hood). Each carries its own
// identity glyph; open/closed is conveyed by color + the written word rather
// than a checkmark, keeping them visually consistent with doors and windows.
const OPENING_SYMBOLS: { match: RegExp; open: IconName; closed: IconName }[] = [
  // A moon, for the roof named after one. The literal depiction (SF's
  // `window.ceiling`) reads as a vent at 17pt; the moon is the thing the panel
  // is called, so it identifies the row at a glance the way the trunk and
  // engine glyphs do. Filled, matching them — and one glyph for both positions,
  // since open/closed is already carried by the color and the word.
  { match: /moonroof|sunroof/i, open: "moonroof", closed: "moonroof" },
  { match: /trunk|hatch|tailgate/i, open: "trunk", closed: "trunk" },
  { match: /hood/i, open: "hood", closed: "hood" },
];

export function openingStatus(opening: Closure): ClosureStatus {
  const isOpen = opening.state === "Open";
  const match = OPENING_SYMBOLS.find((o) => o.match.test(opening.label));
  const symbol: IconName = match
    ? isOpen
      ? match.open
      : match.closed
    : isOpen
      ? "warning"
      : "check-circle";
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
