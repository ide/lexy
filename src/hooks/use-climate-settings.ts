import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetch } from 'expo/fetch';

import { useAuth } from '@/auth/auth-context';
import {
  defrostParameters,
  parseClimateSettings,
  withDefrost,
  withSettingsOn,
  withTemperature,
  type ClimateSettings,
  type DefrostName,
} from '@/data/climate-settings';
import { VEHICLE_CLIMATE_ENDPOINT, vehicleHeaders } from '@/data/lexus-api';
import type { Vehicle } from '@/data/vehicle';

export const CLIMATE_SETTINGS_QUERY_KEY = ['climate-settings'] as const;

/**
 * Remote-start climate configuration (setpoint, master switch, defrost).
 * Reads and writes `/v1/remote/route/climate-settings`: each write PUTs the
 * exact settings object the GET returned with one field changed, then
 * re-reads to confirm the server actually stored it. Separate from the
 * vehicle query so a settings change doesn't refetch the whole dashboard —
 * the dashboard's pull-to-refresh refetches this key explicitly (settings can
 * change out from under us via the official Lexus app).
 */
export function useClimateSettings(vehicle: Vehicle) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  // The vehicle-scoped headers need VIN + brand + generation, all of which the
  // loaded vehicle carries.
  const context = { vin: vehicle.vin, brand: vehicle.brand, generation: vehicle.generation };

  const query = useQuery({
    queryKey: CLIMATE_SETTINGS_QUERY_KEY,
    enabled: session !== null,
    queryFn: async ({ signal }): Promise<ClimateSettings> => {
      const response = await fetch(VEHICLE_CLIMATE_ENDPOINT, {
        headers: vehicleHeaders(session!, context),
        signal,
      });
      if (!response.ok) {
        throw new Error(`Climate settings request failed (${response.status})`);
      }
      const settings = parseClimateSettings(await response.json());
      if (!settings) {
        throw new Error('Unrecognized climate settings response');
      }
      return settings;
    },
  });

  const mutation = useMutation({
    mutationFn: async (updated: ClimateSettings) => {
      if (!session) {
        throw new Error('Sign in to change climate settings');
      }
      const response = await fetch(VEHICLE_CLIMATE_ENDPOINT, {
        method: 'PUT',
        headers: {
          ...vehicleHeaders(session, context),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updated),
      });
      if (!response.ok) {
        throw new Error(`Saving climate settings failed (${response.status})`);
      }
      // The PUT response echoes the settings, but re-read to confirm the
      // server stored them rather than trusting the echo.
      const confirm = await fetch(VEHICLE_CLIMATE_ENDPOINT, {
        headers: vehicleHeaders(session, context),
      });
      const confirmed = confirm.ok ? parseClimateSettings(await confirm.json()) : null;
      return confirmed ?? updated;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(CLIMATE_SETTINGS_QUERY_KEY, settings);
    },
  });

  const change = (update: (settings: ClimateSettings) => ClimateSettings) => {
    if (query.data) {
      mutation.mutate(update(query.data));
    }
  };

  return {
    settings: query.data,
    defrost: query.data ? defrostParameters(query.data) : {},
    setDefrost: (name: DefrostName, enabled: boolean) =>
      change((settings) => withDefrost(settings, name, enabled)),
    setTemperature: (value: number) => change((settings) => withTemperature(settings, value)),
    setSettingsOn: (enabled: boolean) => change((settings) => withSettingsOn(settings, enabled)),
    saving: mutation.isPending,
    error: mutation.error,
  };
}
