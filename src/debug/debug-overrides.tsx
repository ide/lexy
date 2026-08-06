import { createContext, useContext, useMemo, useState } from "react";
import type { SFSymbol } from "sf-symbols-typescript";

import { SHOW_DEV_TOOLS } from "@/constants/build-channel";
import { colors } from "@/constants/theme";
import type { DataStateOverride } from "@/debug/data-state";

export type DataStateOption = {
  key: DataStateOverride;
  title: string;
  subtitle: string;
  icon: SFSymbol;
  tint: string;
};

// The rows shown in the Data State dev screen, in display order.
export const DATA_STATE_OPTIONS: DataStateOption[] = [
  {
    key: "live",
    title: "Live",
    subtitle: "Use the real Lexus data — no override.",
    icon: "antenna.radiowaves.left.and.right",
    tint: colors.systemBlue,
  },
  {
    key: "skeleton",
    title: "Loading skeleton",
    subtitle: "Hold the first-load skeleton / redacted layout.",
    icon: "rectangle.dashed",
    tint: colors.systemBlue,
  },
  {
    key: "offline-cached",
    title: "Offline — cached data",
    subtitle: "Show the last-seen dashboard behind the offline banner.",
    icon: "wifi.slash",
    tint: colors.systemOrange,
  },
  {
    key: "offline-empty",
    title: "Offline — no cache",
    subtitle: "Offline before anything was ever loaded.",
    icon: "wifi.exclamationmark",
    tint: colors.systemOrange,
  },
  {
    key: "error-cached",
    title: "Fetch error — cached data",
    subtitle: "Show the last-seen dashboard behind the refresh-failed banner.",
    icon: "exclamationmark.triangle.fill",
    tint: colors.systemOrange,
  },
  {
    key: "error-empty",
    title: "Fetch error — no cache",
    subtitle: 'Force the full-screen "Vehicle data unavailable" error.',
    icon: "exclamationmark.octagon.fill",
    tint: colors.systemRed,
  },
  {
    key: "no-vehicle",
    title: "No vehicle on account",
    subtitle: 'Force the "No vehicle found" empty state.',
    icon: "car.2",
    tint: colors.secondaryLabel,
  },
];

/**
 * How a remote command asks before it actuates the car.
 *
 * - `alert` — a centered modal. The confirm message is a safety warning, and an
 *   alert makes it the primary content.
 * - `sheet` — a confirmation dialog anchored to the glass button that was
 *   pressed, so there is no doubt which control is being confirmed, at the cost
 *   of the warning rendering as subtext.
 *
 * Both are defensible; this exists to compare them on a real device.
 */
export type CommandConfirmStyle = "alert" | "sheet";

export const COMMAND_CONFIRM_OPTIONS: {
  key: CommandConfirmStyle;
  title: string;
  subtitle: string;
  icon: SFSymbol;
  tint: string;
}[] = [
  {
    key: "alert",
    title: "Alert",
    subtitle: "Centered modal. The safety warning reads as the main text.",
    icon: "exclamationmark.bubble.fill",
    tint: colors.systemBlue,
  },
  {
    key: "sheet",
    title: "Confirmation dialog",
    subtitle: "Anchored to the button pressed. The warning becomes subtext.",
    icon: "arrowshape.up.fill",
    tint: colors.systemGreen,
  },
];

type DebugContextValue = {
  dataState: DataStateOverride;
  setDataState: (state: DataStateOverride) => void;
  commandConfirm: CommandConfirmStyle;
  setCommandConfirm: (style: CommandConfirmStyle) => void;
};

const DebugContext = createContext<DebugContextValue | null>(null);

/**
 * Holds the developer data-state override. Mounted at the root in every build,
 * but `useDataStateOverride` gates reads behind `SHOW_DEV_TOOLS`, so the state
 * can never affect a production build even if it were somehow set. In-memory
 * only: the override resets to `live` on reload, which is the safe default.
 */
export function DebugOverrideProvider({ children }: { children: React.ReactNode }) {
  const [dataState, setDataState] = useState<DataStateOverride>("live");
  const [commandConfirm, setCommandConfirm] = useState<CommandConfirmStyle>("alert");
  const value = useMemo(
    () => ({ dataState, setDataState, commandConfirm, setCommandConfirm }),
    [dataState, commandConfirm],
  );
  return <DebugContext.Provider value={value}>{children}</DebugContext.Provider>;
}

// Controls for the dev screen. Falls back to a no-op when the provider is absent
// so it can never crash a screen that renders it outside the tree.
export function useDebugOverrides(): DebugContextValue {
  return (
    useContext(DebugContext) ?? {
      dataState: "live",
      setDataState: () => {},
      commandConfirm: "alert",
      setCommandConfirm: () => {},
    }
  );
}

/**
 * Which confirmation the remote controls should present. Production is always
 * `alert` — the comparison is a dev-tools affordance, and shipping a build
 * whose safety warning depends on an in-memory toggle is not a thing to allow.
 */
export function useCommandConfirmStyle(): CommandConfirmStyle {
  const { commandConfirm } = useDebugOverrides();
  return SHOW_DEV_TOOLS ? commandConfirm : "alert";
}

/**
 * The active data-state override for the data hooks to apply. Always `live` in
 * production (dev tools are gated) and whenever the provider is missing, so
 * callers can apply it unconditionally.
 */
export function useDataStateOverride(): DataStateOverride {
  const { dataState } = useDebugOverrides();
  return SHOW_DEV_TOOLS ? dataState : "live";
}
