import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetch } from 'expo/fetch';

import { useAuth } from '@/auth/auth-context';
import {
  defrostParameters,
  parseClimateSettings,
  withDefrost,
  type ClimateSettings,
  type DefrostName,
} from '@/data/climate-settings';
import { VEHICLE_CLIMATE_ENDPOINT, vehicleHeaders } from '@/data/lexus-api';
import type { Vehicle } from '@/data/vehicle';

/**
 * Remote-start climate configuration (defrost toggles). Reads and writes
 * `/v1/remote/route/climate-settings`: the PUT round-trips the exact settings
 * object the GET returned with one `enabled` flag flipped, then re-reads to
 * confirm the server actually stored it. Separate from the vehicle query so a
 * toggle doesn't refetch the whole dashboard.
 */
export function useClimateSettings(vehicle: Vehicle) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  // The vehicle-scoped headers need VIN + brand + generation, all of which the
  // loaded vehicle carries.
  const context = { vin: vehicle.vin, brand: vehicle.brand, generation: vehicle.generation };

  const query = useQuery({
    queryKey: ['climate-settings'],
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
    mutationFn: async ({ name, enabled }: { name: DefrostName; enabled: boolean }) => {
      if (!session || !query.data) {
        throw new Error('Climate settings are not loaded yet');
      }
      const updated = withDefrost(query.data, name, enabled);
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
      queryClient.setQueryData(['climate-settings'], settings);
    },
  });

  return {
    defrost: query.data ? defrostParameters(query.data) : {},
    setDefrost: (name: DefrostName, enabled: boolean) => mutation.mutate({ name, enabled }),
    saving: mutation.isPending,
    error: mutation.error,
  };
}
