import type { Closure } from '@/data/vehicle';

// The dashboard arranges closures spatially: the driver's side (front + rear) on
// the left, the passenger's side on the right, with each corner showing its door
// and window together. Everything that isn't a side door/window — moonroof,
// trunk, hood — is collected separately and shown in that order below the grid.

export type Side = 'driver' | 'passenger';
export type Row = 'front' | 'rear';

export type Corner = {
  key: string;
  title: string;
  side: Side;
  row: Row;
  door?: Closure;
  window?: Closure;
};

export type ClosureLayout = {
  corners: Corner[];
  openings: Closure[];
};

// Openings that aren't doors/windows, in the order the user asked for.
const OPENING_ORDER = ['moonroof', 'trunk', 'hood'];

const CORNERS: { key: string; title: string; side: Side; row: Row }[] = [
  { key: 'frontDriver', title: 'Front driver', side: 'driver', row: 'front' },
  { key: 'rearDriver', title: 'Rear driver', side: 'driver', row: 'rear' },
  { key: 'frontPassenger', title: 'Front passenger', side: 'passenger', row: 'front' },
  { key: 'rearPassenger', title: 'Rear passenger', side: 'passenger', row: 'rear' },
];

function classify(label: string): { side?: Side; row: Row; type?: 'door' | 'window' } {
  const l = label.toLowerCase();
  const side: Side | undefined = l.includes('passenger')
    ? 'passenger'
    : l.includes('driver')
      ? 'driver'
      : undefined;
  const row: Row = l.includes('rear') ? 'rear' : 'front';
  const type = l.includes('window') ? 'window' : l.includes('door') ? 'door' : undefined;
  return { side, row, type };
}

function openingRank(label: string): number {
  const l = label.toLowerCase();
  const index = OPENING_ORDER.findIndex((name) => l.includes(name));
  // Unknown openings sort after the known ones but keep their relative order.
  return index === -1 ? OPENING_ORDER.length : index;
}

export function groupClosures(closures: Closure[]): ClosureLayout {
  const corners: Corner[] = CORNERS.map((c) => ({ ...c }));
  const byKey = new Map(corners.map((c) => [c.key, c]));
  const openings: Closure[] = [];

  for (const closure of closures) {
    const { side, row, type } = classify(closure.label);
    if (side && type) {
      const key = `${row}${side === 'driver' ? 'Driver' : 'Passenger'}`;
      const corner = byKey.get(key);
      if (corner) {
        corner[type] = closure;
        continue;
      }
    }
    openings.push(closure);
  }

  openings.sort((a, b) => {
    const rank = openingRank(a.label) - openingRank(b.label);
    return rank !== 0 ? rank : closures.indexOf(a) - closures.indexOf(b);
  });

  return {
    corners: corners.filter((c) => c.door || c.window),
    openings,
  };
}
