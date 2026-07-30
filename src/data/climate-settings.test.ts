import { describe, expect, it } from 'vitest';

import {
  defrostParameters,
  parseClimateSettings,
  withDefrost,
  withSettingsOn,
  withTemperature,
  type ClimateSettings,
} from './climate-settings';

// Trimmed from the live 21MM IS 350 response (2026-07-29).
const settings: ClimateSettings = {
  temperature: 71,
  temperatureUnit: 'F',
  minTemp: 65,
  maxTemp: 85,
  tempInterval: 1,
  settingsOn: true,
  extendedRuntime: { available: false, enabled: false },
  acOperations: [
    {
      categoryName: 'defrost',
      categoryDisplayName: 'Defrost',
      available: true,
      acParameters: [
        { name: 'frontDefrost', displayName: 'Front Defrost', iconUrl: null, available: true, enabled: false },
        { name: 'rearDefrost', displayName: 'Rear Defrost', iconUrl: null, available: true, enabled: true },
      ],
    },
    {
      categoryName: 'seatHeat',
      categoryDisplayName: 'Seat Heat',
      available: false,
      acParameters: [
        { name: 'frontDriver', displayName: 'Front, Driver', iconUrl: null, available: false, enabled: false },
      ],
    },
  ],
};

describe('parseClimateSettings', () => {
  it('unwraps the { payload } envelope', () => {
    expect(parseClimateSettings({ payload: settings, status: {} })).toEqual(settings);
  });

  it('accepts a bare settings object', () => {
    expect(parseClimateSettings(settings)).toEqual(settings);
  });

  it('returns null for unrecognized shapes', () => {
    expect(parseClimateSettings(null)).toBeNull();
    expect(parseClimateSettings({ payload: { temperature: 71 } })).toBeNull();
  });
});

describe('defrostParameters', () => {
  it('returns available front and rear defrost parameters', () => {
    const { front, rear } = defrostParameters(settings);
    expect(front?.enabled).toBe(false);
    expect(rear?.enabled).toBe(true);
  });

  it('omits parameters when the defrost category is unavailable', () => {
    const unavailable = withDefrost(settings, 'frontDefrost', false);
    unavailable.acOperations![0].available = false;
    expect(defrostParameters(unavailable)).toEqual({});
  });

  it('omits an individual parameter marked unavailable', () => {
    const copy = structuredClone(settings);
    copy.acOperations![0].acParameters[1].available = false;
    expect(defrostParameters(copy).rear).toBeUndefined();
    expect(defrostParameters(copy).front).toBeDefined();
  });
});

describe('withTemperature / withSettingsOn', () => {
  it('changes one field and preserves the rest for the PUT round-trip', () => {
    const warmer = withTemperature(settings, 74);
    expect(warmer.temperature).toBe(74);
    expect(warmer.acOperations).toEqual(settings.acOperations);

    const off = withSettingsOn(settings, false);
    expect(off.settingsOn).toBe(false);
    expect(off.temperature).toBe(71);

    // Source untouched.
    expect(settings.temperature).toBe(71);
    expect(settings.settingsOn).toBe(true);
  });
});

describe('withDefrost', () => {
  it('flips only the named parameter and preserves everything else', () => {
    const updated = withDefrost(settings, 'frontDefrost', true);
    const { front, rear } = defrostParameters(updated);
    expect(front?.enabled).toBe(true);
    expect(rear?.enabled).toBe(true);
    expect(updated.temperature).toBe(71);
    expect(updated.acOperations![1]).toEqual(settings.acOperations![1]);
    // The source object is untouched.
    expect(defrostParameters(settings).front?.enabled).toBe(false);
  });
});
