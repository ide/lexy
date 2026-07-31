import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetch } from "expo/fetch";

import { useAuth } from "@/auth/auth-context";
import {
  CLIMATE_SETTINGS_QUERY_KEY,
  defrostParameters,
  parseClimateSettings,
  withDefrost,
  withSettingsOn,
  withTemperature,
  type ClimateSettings,
  type DefrostName,
} from "@/data/climate-settings";
import { LexusApiError, VEHICLE_CLIMATE_ENDPOINT, vehicleHeaders } from "@/data/lexus-api";
import { PLACEHOLDER_CLIMATE_SETTINGS } from "@/data/placeholder-vehicle";
import { vehicleContext, type Vehicle } from "@/data/vehicle";

/**
 * Remote-start climate configuration (setpoint, master switch, defrost).
 * Reads and writes `/v1/remote/route/climate-settings`: each write PUTs the
 * exact settings object the GET returned with one field changed, then
 * re-reads to confirm the server actually stored it. Separate from the
 * vehicle query so a settings change doesn't refetch the whole dashboard —
 * the dashboard's pull-to-refresh refetches this key explicitly (settings can
 * change out from under us via the official Lexus app).
 */
export function useClimateSettings(
  vehicle: Vehicle,
  /**
   * Set while the caller is rendering `PLACEHOLDER_VEHICLE` as a redacted
   * skeleton: the read is skipped (its headers would carry a VIN that isn't a
   * car) and stand-in settings are returned so the card keeps its real shape.
   */
  { placeholder = false }: { placeholder?: boolean } = {},
) {
  const { session, runAuthorized } = useAuth();
  const queryClient = useQueryClient();
  const context = vehicleContext(vehicle);

  const query = useQuery({
    queryKey: CLIMATE_SETTINGS_QUERY_KEY,
    enabled: session !== null && !placeholder,
    // Refreshed alongside the vehicle status, by whoever refreshes it (see
    // vehicle-refresh.ts) — so React Query's own focus refetch would only
    // duplicate that read on every foreground.
    refetchOnWindowFocus: false,
    queryFn: ({ signal }): Promise<ClimateSettings> =>
      runAuthorized(async (session) => {
        const response = await fetch(VEHICLE_CLIMATE_ENDPOINT, {
          headers: vehicleHeaders(session, context),
          signal,
        });
        if (!response.ok) {
          throw new LexusApiError(
            `Climate settings request failed (${response.status})`,
            response.status,
          );
        }
        const settings = parseClimateSettings(await response.json());
        if (!settings) {
          throw new Error("Unrecognized climate settings response");
        }
        return settings;
      }),
  });

  // Writes are optimistic: the cache takes the new settings immediately (the
  // controls never lock up or snap back while the PUT is in flight) and rolls
  // back only if the server rejects the change.
  const mutation = useMutation({
    mutationKey: CLIMATE_SETTINGS_QUERY_KEY,
    mutationFn: (updated: ClimateSettings) =>
      runAuthorized(async (session) => {
        const response = await fetch(VEHICLE_CLIMATE_ENDPOINT, {
          method: "PUT",
          headers: {
            ...vehicleHeaders(session, context),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updated),
        });
        if (!response.ok) {
          throw new LexusApiError(
            `Saving climate settings failed (${response.status})`,
            response.status,
          );
        }
        // The PUT response echoes the settings, but re-read to confirm the
        // server stored them rather than trusting the echo.
        const confirm = await fetch(VEHICLE_CLIMATE_ENDPOINT, {
          headers: vehicleHeaders(session, context),
        });
        const confirmed = confirm.ok ? parseClimateSettings(await confirm.json()) : null;
        return confirmed ?? updated;
      }),
    onMutate: async (updated: ClimateSettings) => {
      await queryClient.cancelQueries({ queryKey: CLIMATE_SETTINGS_QUERY_KEY });
      const previous = queryClient.getQueryData<ClimateSettings>(CLIMATE_SETTINGS_QUERY_KEY);
      queryClient.setQueryData(CLIMATE_SETTINGS_QUERY_KEY, updated);
      return { previous };
    },
    onError: (_error, _updated, onMutateResult) => {
      if (onMutateResult?.previous) {
        queryClient.setQueryData(CLIMATE_SETTINGS_QUERY_KEY, onMutateResult.previous);
      }
    },
    onSuccess: (settings) => {
      // Reconcile with the server-confirmed state — but only when this is the
      // last write in flight, so a slow confirm can't clobber a newer
      // optimistic change.
      if (queryClient.isMutating({ mutationKey: CLIMATE_SETTINGS_QUERY_KEY }) === 1) {
        queryClient.setQueryData(CLIMATE_SETTINGS_QUERY_KEY, settings);
      }
    },
  });

  // Writes read from `query.data`, never the placeholder, so a control that
  // somehow fires while redacted can't PUT stand-in settings to a real car.
  const change = (update: (settings: ClimateSettings) => ClimateSettings) => {
    if (query.data) {
      mutation.mutate(update(query.data));
    }
  };

  // Standing in for a skeleton still prefers a real reading when the cache
  // already holds one: the query is off, but the persisted cache is the honest
  // answer, so the card can show its true state (a climate switch that is off,
  // and the dimmed rows that go with it) instead of the stand-in's defaults.
  const settings = placeholder ? (query.data ?? PLACEHOLDER_CLIMATE_SETTINGS) : query.data;

  return {
    settings,
    defrost: settings ? defrostParameters(settings) : {},
    setDefrost: (name: DefrostName, enabled: boolean) =>
      change((settings) => withDefrost(settings, name, enabled)),
    setTemperature: (value: number) => change((settings) => withTemperature(settings, value)),
    setSettingsOn: (enabled: boolean) => change((settings) => withSettingsOn(settings, enabled)),
    saving: mutation.isPending,
    error: mutation.error,
  };
}
