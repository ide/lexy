import { describe, expect, it } from 'vitest';

import { formatStreetAddress } from '@/data/parking-address';

describe('formatStreetAddress', () => {
  it('formats only the street number and street name', () => {
    expect(
      formatStreetAddress({
        streetNumber: '1234',
        street: 'Example St',
        name: '1234 Example St',
      }),
    ).toBe('1234 Example St');
  });

  it('uses the placemark name when street components are unavailable', () => {
    expect(formatStreetAddress({ streetNumber: null, street: null, name: 'Apple Park' })).toBe(
      'Apple Park',
    );
  });

  it('does not duplicate a street number already present in the street name', () => {
    expect(
      formatStreetAddress({
        streetNumber: '1234',
        street: '1234 Example St',
        name: null,
      }),
    ).toBe('1234 Example St');
  });

  it('returns null when the placemark has no useful street-level label', () => {
    expect(formatStreetAddress({ streetNumber: null, street: null, name: null })).toBeNull();
  });
});
