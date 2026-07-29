import { useQuery } from '@tanstack/react-query';
import { Observe } from 'expo-observe';
import { fetch } from 'expo/fetch';

import { useAuth } from '@/auth/auth-context';
import {
  VEHICLE_CLIMATE_ENDPOINT,
  VEHICLE_DISCOVERY_ENDPOINT,
  VEHICLE_SPEC_ENDPOINT,
  VEHICLE_STATUS_ENDPOINT,
  VEHICLE_TIRES_ENDPOINT,
  businessHeaders,
  vehicleHeaders,
} from '@/data/lexus-api';
import { mapVehicle, NoVehicleError, parseVehicle, parseVehicleContexts } from '@/data/vehicle';

async function getJson(url: string, headers: Record<string, string>, signal?: AbortSignal) {
  const response = await fetch(url, { headers, signal });
  if (!response.ok) {
    throw new Error(`Lexus request failed (${response.status})`);
  }
  return response.json();
}

export function useVehicle() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['vehicle'],
    enabled: session !== null,
    // A settled "no vehicle on this account" is a definitive empty state, not a
    // transient failure — don't burn retries on it. Everything else keeps the
    // default two retries.
    retry: (failureCount, error) =>
      !(error instanceof NoVehicleError) && failureCount < 2,
    queryFn: async ({ signal }) => {
      if (!session) {
        throw new Error('Sign in to load your vehicle');
      }
      const startedAt = performance.now();
      try {
        // Discover the car (VIN + brand + generation), then read status,
        // climate, spec, and tires with vehicle-scoped headers and map into the
        // UI shape.
        const discovery = await getJson(VEHICLE_DISCOVERY_ENDPOINT, businessHeaders(session), signal);
        const contexts = parseVehicleContexts(discovery);
        if (contexts.length === 0) {
          throw new NoVehicleError();
        }
        // The first vehicle is the primary until a switcher exists; a 2+ car
        // account still loads and works, it just shows this one for now.
        const scoped = vehicleHeaders(session, contexts[0]);
        const [status, climate, spec, tires] = await Promise.all([
          getJson(VEHICLE_STATUS_ENDPOINT, scoped, signal),
          getJson(VEHICLE_CLIMATE_ENDPOINT, scoped, signal),
          getJson(VEHICLE_SPEC_ENDPOINT, scoped, signal),
          getJson(VEHICLE_TIRES_ENDPOINT, scoped, signal).catch(() => null),
        ]);
        const vehicle = parseVehicle(mapVehicle(discovery, status, climate, spec, tires));
        Observe.logEvent('vehicle.load.completed', {
          attributes: { source: 'lexus', durationMs: Math.round(performance.now() - startedAt) },
        });
        return vehicle;
      } catch (error) {
        // Aborts happen when the screen unmounts or a refetch supersedes this
        // request; they are lifecycle noise, not load failures.
        if (!signal.aborted) {
          Observe.logEvent('vehicle.load.failed', {
            severity: 'error',
            body: error instanceof Error ? error.message : 'Unknown error loading vehicle data',
            attributes: { source: 'lexus', durationMs: Math.round(performance.now() - startedAt) },
          });
        }
        throw error;
      }
    },
  });
}
