import { useQuery } from "@tanstack/react-query";
import { fetch } from "expo/fetch";

import { useAuth } from "@/auth/auth-context";
import {
  ENGINE_STATUS_QUERY_KEY,
  parseEngineStatus,
  type EngineStatus,
} from "@/data/engine-status";
import { VEHICLE_ENGINE_STATUS_ENDPOINT, vehicleHeaders } from "@/data/lexus-api";
import type { Vehicle } from "@/data/vehicle";

/**
 * Whether a remote start is running. Its own query rather than part of the
 * vehicle load: the 21MM status snapshot carries no engine state at all, so
 * this is a separate GET — and it is re-read on its own cadence after an
 * engine command (see remote-command-effects.ts) without refetching the whole
 * dashboard.
 */
export function useEngineStatus(
  vehicle: Vehicle,
  /** Set while rendering the redacted skeleton, which has no real VIN to ask about. */
  { placeholder = false }: { placeholder?: boolean } = {},
) {
  const { session } = useAuth();
  const context = { vin: vehicle.vin, brand: vehicle.brand, generation: vehicle.generation };

  const query = useQuery({
    queryKey: ENGINE_STATUS_QUERY_KEY,
    enabled: session !== null && !placeholder,
    queryFn: async ({ signal }): Promise<EngineStatus> => {
      const response = await fetch(VEHICLE_ENGINE_STATUS_ENDPOINT, {
        headers: vehicleHeaders(session!, context),
        signal,
      });
      if (!response.ok) {
        throw new Error(`Engine status request failed (${response.status})`);
      }
      const status = parseEngineStatus(await response.json());
      if (!status) {
        throw new Error("Unrecognized engine status response");
      }
      return status;
    },
  });

  return query.data ?? null;
}
