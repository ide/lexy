import { useObserve } from "expo-observe";
import { useEffect, useState } from "react";

import { DevSkeletonToggle } from "@/components/dev-skeleton-toggle";
import { OfflineBanner } from "@/components/offline-banner";
import { NoVehicleState, VehicleError } from "@/components/vehicle-state";
import { SHOW_DEV_TOOLS } from "@/constants/build-channel";
import { PLACEHOLDER_VEHICLE } from "@/data/placeholder-vehicle";
import { NoVehicleError } from "@/data/vehicle";
import { useIsOnline } from "@/hooks/use-is-online";
import { useVehicle } from "@/hooks/use-vehicle";

/**
 * The scaffolding every vehicle screen (Status, Specs) shares: the vehicle
 * query, the loading/redaction policy, the offline banner, the error screen,
 * and the dev-build skeleton toggle. The screens keep only their content tree.
 */
export function useVehicleScreen() {
  const query = useVehicle();
  const { data, error, isLoading, refetch } = query;
  const { markInteractive } = useObserve();
  const isOnline = useIsOnline();
  const [forceSkeleton, setForceSkeleton] = useState(false);

  useEffect(() => {
    // TTI marks the UI shell becoming interactive; data readiness is tracked
    // separately by the vehicle.load events.
    markInteractive();
  }, [markInteractive]);

  // Affordance to hold the real loading skeleton on the real screen. Available
  // in dev and preview builds (see SHOW_DEV_TOOLS); kept out of production.
  const headerRight = SHOW_DEV_TOOLS
    ? () => (
        <DevSkeletonToggle
          active={forceSkeleton}
          onToggle={() => setForceSkeleton((value) => !value)}
        />
      )
    : undefined;

  // A single redacted state covers every "no vehicle yet" case: the dev
  // override, the first-load fetch, and offline-before-anything-cached (with a
  // banner). Only a settled, online, data-less result is a real error.
  const loading = forceSkeleton || (!data && (isLoading || !isOnline));

  // Non-null exactly when there is nothing to render at all — the caller
  // returns it (under its own Stack.Screen title) instead of the content tree.
  const errorScreen =
    !loading && !data ? (
      error instanceof NoVehicleError ? (
        <NoVehicleState retry={() => refetch()} />
      ) : (
        <VehicleError retry={() => refetch()} />
      )
    ) : null;

  // While loading, the real content tree renders placeholder data redacted
  // into neutral bars (see `Redacted`). One tree, one scroll container: the
  // layout cannot drift from itself, sizes are identical in both states, and
  // toggling reconciles in place so the scroll offset is preserved. (The
  // placeholder fallback on the right is unreachable when errorScreen is
  // null; it just spares callers a non-null assertion.)
  const vehicle = loading ? PLACEHOLDER_VEHICLE : (data ?? PLACEHOLDER_VEHICLE);

  const offlineBanner = !isOnline ? (
    <OfflineBanner
      detail={
        data
          ? "Showing the latest data we saved."
          : "Reconnect to load your vehicle."
      }
    />
  ) : null;

  return {
    /** The underlying vehicle query, for screens that need more than `data`. */
    query,
    vehicle,
    loading,
    isOnline,
    headerRight,
    errorScreen,
    offlineBanner,
  };
}
