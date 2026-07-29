// The remote climate configuration read/written at
// `GET|PUT /v1/remote/route/climate-settings`. These settings describe what a
// remote engine start runs (setpoint, defrost, seat heat…) — they configure,
// they do not actuate. Schema captured live from a 21MM IS 350 on 2026-07-29
// (see docs/vehicle-status-and-control.md):
//
//   { payload: { temperature, temperatureUnit, minTemp, maxTemp, tempInterval,
//       settingsOn, extendedRuntime: { available, enabled },
//       acOperations: [{ categoryName, categoryDisplayName, available,
//         acParameters: [{ name, displayName, iconUrl, available, enabled }] }] },
//     status: { messages: [{ responseCode, description, ... }] } }
//
// Categories observed: defrost (frontDefrost/rearDefrost), seatHeat, seatVent,
// steeringHeaterCat — each gated by its own `available` flag per vehicle.

export type AcParameter = {
  name: string;
  displayName: string | null;
  iconUrl: string | null;
  available: boolean;
  enabled: boolean;
};

export type AcOperation = {
  categoryName: string;
  categoryDisplayName: string | null;
  available: boolean;
  acParameters: AcParameter[];
};

// The full settings object is round-tripped on PUT, so keep every field the
// server sent (index signature) rather than only the ones the UI reads.
export type ClimateSettings = {
  temperature: number;
  settingsOn: boolean;
  acOperations?: AcOperation[];
  [key: string]: unknown;
};

export type DefrostName = 'frontDefrost' | 'rearDefrost';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Unwrap a climate-settings response (`{ payload: {...} }` envelope or a bare
 * settings object) into the settings, or null when the shape is unrecognized.
 */
export function parseClimateSettings(value: unknown): ClimateSettings | null {
  const payload = isRecord(value) && isRecord(value.payload) ? value.payload : value;
  if (!isRecord(payload) || typeof payload.settingsOn !== 'boolean') {
    return null;
  }
  return payload as ClimateSettings;
}

/**
 * The front/rear defrost parameters, present only when the defrost category
 * and the individual parameter are marked available for this vehicle.
 */
export function defrostParameters(settings: ClimateSettings): {
  front?: AcParameter;
  rear?: AcParameter;
} {
  const category = (settings.acOperations ?? []).find(
    (operation) => operation.categoryName === 'defrost' && operation.available,
  );
  const parameter = (name: DefrostName) => {
    const match = category?.acParameters.find((p) => p.name === name);
    return match?.available ? match : undefined;
  };
  return { front: parameter('frontDefrost'), rear: parameter('rearDefrost') };
}

/**
 * A copy of the settings with one defrost parameter's `enabled` flag set — the
 * whole object is PUT back, so everything else is preserved verbatim.
 */
export function withDefrost(
  settings: ClimateSettings,
  name: DefrostName,
  enabled: boolean,
): ClimateSettings {
  return {
    ...settings,
    acOperations: (settings.acOperations ?? []).map((operation) =>
      operation.categoryName === 'defrost'
        ? {
            ...operation,
            acParameters: operation.acParameters.map((parameter) =>
              parameter.name === name ? { ...parameter, enabled } : parameter,
            ),
          }
        : operation,
    ),
  };
}
