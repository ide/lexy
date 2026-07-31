import { useObserve } from "expo-observe";
import { useEffect, useState } from "react";

import { DevSkeletonToggle } from "@/components/dev-skeleton-toggle";
import type { RedactionReason } from "@/components/redactable";
import { StatusBanner } from "@/components/status-banner";
import { NoVehicleState, VehicleError } from "@/components/vehicle-state";
import { SHOW_DEV_TOOLS } from "@/constants/build-channel";
import { describeFailure } from "@/data/load-error";
import { PLACEHOLDER_VEHICLE } from "@/data/placeholder-vehicle";
import { NoVehicleError } from "@/data/vehicle";
import { useIsOnline } from "@/hooks/use-is-online";
import { useVehicle } from "@/hooks/use-vehicle";

/**
 * The scaffolding every vehicle screen (Status, Specs) shares: the vehicle
 * query, the redaction policy, the status banner, the error screen,
 * and the dev-build skeleton toggle. The screens keep only their content tree.
 *
 * Both ways a load can go wrong — offline and a failed fetch — split on the
 * same question: is there cached data to fall back on? With cache, the screen
 * renders that data under a banner explaining why it may be stale. Without it,
 * offline shows a still redacted tree (the data can still arrive on its own,
 * once the network returns) and a failure shows the full-screen error with
 * its retry (nothing will change until the user asks again).
 *
 * Keeping the data fresh is deliberately *not* this hook's job — the tabs
 * layout owns that (see use-vehicle-auto-refresh.ts), so the policy runs once
 * for the app rather than once per mounted screen.
 */
export function useVehicleScreen() {
  const query = useVehicle();
  const { vehicle: data, dataUpdatedAt, error, isLoading, refetch } = query;
  const { markInteractive } = useObserve();
  const isOnline = useIsOnline();
  const [forceSkeleton, setForceSkeleton] = useState(false);

  useEffect(() => {
    // TTI marks the UI shell becoming interactive; data readiness is tracked
    // separately by the vehicle load events.
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

  // Every "no vehicle to show yet" case in one value: why the content tree is
  // standing in for data it doesn't have, or null when it has the real thing.
  // A fetch in flight is `loading` (the dev toggle included — it exists to
  // inspect that exact skeleton); offline before anything was cached is
  // `unavailable`, because React Query has paused the fetch and nothing is on
  // its way. Anything else is real data, or falls through to `errorScreen`.
  const redaction: RedactionReason =
    forceSkeleton || isLoading ? "loading" : !data && !isOnline ? "unavailable" : null;

  // Why the load failed, in words a person can act on ("a permission problem",
  // "a server error", "the network connection failed"…), for both the
  // full-screen error and the couldn't-refresh banner.
  const failure = error ? describeFailure(error) : null;

  // Non-null exactly when there is nothing to render at all — the caller
  // returns it (under its own Stack.Screen title) instead of the content tree.
  const errorScreen =
    !redaction && !data ? (
      error instanceof NoVehicleError ? (
        <NoVehicleState retry={refetch} />
      ) : (
        <VehicleError retry={refetch} detail={failure?.advice} />
      )
    ) : null;

  // While redacted, the real content tree renders placeholder data drawn as
  // neutral bars (see `Redactable`). One tree, one scroll container: the
  // layout cannot drift from itself, sizes are identical in both states, and
  // toggling reconciles in place so the scroll offset is preserved. (The
  // placeholder fallback on the right is unreachable when errorScreen is
  // null; it just spares callers a non-null assertion.)
  const vehicle = redaction ? PLACEHOLDER_VEHICLE : (data ?? PLACEHOLDER_VEHICLE);

  // Offline outranks a stale error: the network being down is the more
  // actionable explanation, and a paused query's last error is stale anyway.
  const statusBanner = !isOnline ? (
    <StatusBanner
      symbol="wifi.slash"
      title="You're offline"
      detail={data ? "Showing the latest data we saved." : "Reconnect to see your vehicle."}
    />
  ) : failure && data ? (
    // Online, the fetch failed, but there is cached data to keep showing. The
    // data-less version of this is `errorScreen` above.
    <StatusBanner
      symbol="exclamationmark.triangle.fill"
      title="Couldn't refresh"
      detail={`${failure.summary} Showing the latest data we saved.`}
    />
  ) : null;

  return {
    /** The underlying vehicle query, for screens that need more than `vehicle`. */
    query,
    vehicle,
    /** When the status on screen was written — the freshness the footer shows. */
    dataUpdatedAt,
    /** Why the content tree is redacted, or null when it shows real data. */
    redaction,
    isOnline,
    headerRight,
    errorScreen,
    statusBanner,
  };
}
