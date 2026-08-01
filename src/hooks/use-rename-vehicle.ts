import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetch } from "expo/fetch";

import { useAuth } from "@/auth/auth-context";
import type { VehicleContext } from "@/data/lexus-api";
import { VEHICLE_PROFILE_QUERY_KEY } from "@/data/vehicle-keys";
import { renameVehicle } from "@/data/vehicle-nickname";

/**
 * Rename the vehicle on the Lexus account. Not optimistic, unlike the climate
 * writes: a rename is a deliberate one-shot edit whose screen is dismissed the
 * moment it lands, so there is no control to keep responsive while it flies —
 * and showing the new name before the server has taken it would be a guess the
 * user has no way to notice was wrong.
 *
 * On success the profile query is invalidated rather than patched. The name
 * every screen renders comes from discovery (`nickName`), so re-reading it is
 * what makes the widget, the hero card, and this field agree.
 */
export function useRenameVehicle(context: VehicleContext | undefined) {
  const { runAuthorized } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (nickname: string) => {
      if (!context) {
        // The screen gates its form on a loaded profile, so this is the
        // "signed in, no vehicle" case rather than a race.
        throw new Error("No vehicle to rename.");
      }
      return runAuthorized((session) => renameVehicle(session, context, nickname, fetch));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VEHICLE_PROFILE_QUERY_KEY }),
  });

  return {
    rename: mutation.mutateAsync,
    saving: mutation.isPending,
    error: mutation.error,
  };
}
