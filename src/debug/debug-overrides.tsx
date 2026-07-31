import { createContext, useContext, useMemo, useState } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { SHOW_DEV_TOOLS } from '@/constants/build-channel';
import { colors } from '@/constants/theme';
import type { DataStateOverride } from '@/debug/data-state';

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
    key: 'live',
    title: 'Live',
    subtitle: 'Use the real Lexus data — no override.',
    icon: 'antenna.radiowaves.left.and.right',
    tint: colors.systemBlue,
  },
  {
    key: 'skeleton',
    title: 'Loading skeleton',
    subtitle: 'Hold the first-load skeleton / redacted layout.',
    icon: 'rectangle.dashed',
    tint: colors.systemBlue,
  },
  {
    key: 'offline-cached',
    title: 'Offline — cached data',
    subtitle: 'Show the last-seen dashboard behind the offline banner.',
    icon: 'wifi.slash',
    tint: colors.systemOrange,
  },
  {
    key: 'offline-empty',
    title: 'Offline — no cache',
    subtitle: 'Offline before anything was ever loaded.',
    icon: 'wifi.exclamationmark',
    tint: colors.systemOrange,
  },
  {
    key: 'error',
    title: 'Fetch error',
    subtitle: 'Force the "Vehicle unavailable" error screen.',
    icon: 'exclamationmark.triangle.fill',
    tint: colors.systemRed,
  },
  {
    key: 'no-vehicle',
    title: 'No vehicle on account',
    subtitle: 'Force the "No vehicle found" empty state.',
    icon: 'car.2',
    tint: colors.secondaryLabel,
  },
];

type DebugContextValue = {
  dataState: DataStateOverride;
  setDataState: (state: DataStateOverride) => void;
};

const DebugContext = createContext<DebugContextValue | null>(null);

/**
 * Holds the developer data-state override. Mounted at the root in every build,
 * but `useDataStateOverride` gates reads behind `SHOW_DEV_TOOLS`, so the state
 * can never affect a production build even if it were somehow set. In-memory
 * only: the override resets to `live` on reload, which is the safe default.
 */
export function DebugOverrideProvider({ children }: { children: React.ReactNode }) {
  const [dataState, setDataState] = useState<DataStateOverride>('live');
  const value = useMemo(() => ({ dataState, setDataState }), [dataState]);
  return <DebugContext.Provider value={value}>{children}</DebugContext.Provider>;
}

// Controls for the dev screen. Falls back to a no-op when the provider is absent
// so it can never crash a screen that renders it outside the tree.
export function useDebugOverrides(): DebugContextValue {
  return useContext(DebugContext) ?? { dataState: 'live', setDataState: () => {} };
}

/**
 * The active data-state override for the data hooks to apply. Always `live` in
 * production (dev tools are gated) and whenever the provider is missing, so
 * callers can apply it unconditionally.
 */
export function useDataStateOverride(): DataStateOverride {
  const { dataState } = useDebugOverrides();
  return SHOW_DEV_TOOLS ? dataState : 'live';
}
