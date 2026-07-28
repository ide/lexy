import { describe, expect, it } from 'vitest';

import { groupClosures } from './closures';
import type { Closure } from './vehicle';

describe('groupClosures', () => {
  it('places each door/window in its side + row corner', () => {
    const closures: Closure[] = [
      { label: 'Driver Door', state: 'Closed', locked: true },
      { label: 'Driver Window', state: 'Closed' },
      { label: 'Passenger Door', state: 'Closed', locked: true },
      { label: 'Rear Driver Window', state: 'Open' },
    ];
    const { corners } = groupClosures(closures);
    const frontDriver = corners.find((c) => c.key === 'frontDriver');
    const rearDriver = corners.find((c) => c.key === 'rearDriver');
    const frontPassenger = corners.find((c) => c.key === 'frontPassenger');

    expect(frontDriver?.door?.locked).toBe(true);
    expect(frontDriver?.window?.state).toBe('Closed');
    expect(rearDriver?.window?.state).toBe('Open');
    expect(rearDriver?.door).toBeUndefined();
    expect(frontPassenger?.door?.locked).toBe(true);
    // Corners with no door and no window are dropped.
    expect(corners.find((c) => c.key === 'rearPassenger')).toBeUndefined();
  });

  it('collects non-door/window closures as openings in moonroof, trunk, hood order', () => {
    const closures: Closure[] = [
      { label: 'Hood', state: 'Closed' },
      { label: 'Trunk', state: 'Open' },
      { label: 'Moonroof', state: 'Closed' },
      { label: 'Driver Door', state: 'Closed', locked: true },
    ];
    const { openings } = groupClosures(closures);
    expect(openings.map((o) => o.label)).toEqual(['Moonroof', 'Trunk', 'Hood']);
  });

  it('keeps unknown openings after the known ones', () => {
    const closures: Closure[] = [
      { label: 'Tailgate', state: 'Closed' },
      { label: 'Trunk', state: 'Closed' },
    ];
    const { openings } = groupClosures(closures);
    expect(openings.map((o) => o.label)).toEqual(['Trunk', 'Tailgate']);
  });
});
