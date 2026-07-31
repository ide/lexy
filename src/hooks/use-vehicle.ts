import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/auth-context';
import { NoVehicleError } from '@/data/vehicle';
import { loadVehicle } from '@/data/vehicle-load';
import { overrideVehicleResult } from '@/debug/data-state';
import { useDataStateOverride } from '@/debug/debug-overrides';

export function useVehicle() {
  const { session } = useAuth();
  const override = useDataStateOverride();
  const query = useQuery({
    queryKey: ['vehicle'],
    enabled: session !== null,
    // A settled "no vehicle on this account" is a definitive empty state, not a
    // transient failure — don't burn retries on it. Everything else keeps the
    // default two retries.
    retry: (failureCount, error) =>
      !(error instanceof NoVehicleError) && failureCount < 2,
    queryFn: ({ signal }) => {
      if (!session) {
        throw new Error('Sign in to load your vehicle');
      }
      return loadVehicle(session, signal);
    },
  });
  // In dev/preview, a Data State override rewrites the result so the screens can
  // preview each state; in production it is always 'live' and returns as-is.
  return overrideVehicleResult(query, override);
}
