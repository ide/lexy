import { useQuery } from '@tanstack/react-query';
import { Observe } from 'expo-observe';
import { fetch } from 'expo/fetch';

import { loadVehicle } from '@/data/vehicle';

const apiUrl = process.env.EXPO_PUBLIC_LEXY_API_URL;
const source = apiUrl ? 'api' : 'stub';

export function useVehicle() {
  return useQuery({
    queryKey: ['vehicle', apiUrl ?? 'stub'],
    queryFn: async ({ signal }) => {
      const startedAt = performance.now();
      try {
        const vehicle = await loadVehicle(apiUrl, fetch, signal);
        Observe.logEvent('vehicle.load.completed', {
          attributes: {
            source,
            durationMs: Math.round(performance.now() - startedAt),
          },
        });
        return vehicle;
      } catch (error) {
        // Aborts happen when the screen unmounts or a refetch supersedes this
        // request; they are lifecycle noise, not load failures.
        if (!signal.aborted) {
          Observe.logEvent('vehicle.load.failed', {
            severity: 'error',
            body:
              error instanceof Error
                ? error.message
                : 'Unknown error loading vehicle data',
            attributes: {
              source,
              durationMs: Math.round(performance.now() - startedAt),
            },
          });
        }
        throw error;
      }
    },
  });
}
