import type { UseQueryResult } from '@tanstack/react-query';

import { PLACEHOLDER_VEHICLE } from '@/data/placeholder-vehicle';
import { NoVehicleError, type Vehicle } from '@/data/vehicle';

/**
 * A developer-forced data state for the vehicle screens. `live` is the real
 * data (no override); the rest each pin one of the states the UI is designed to
 * handle so they can be exercised on demand from Settings > Dev Tools > Data
 * State, without having to disable Wi-Fi, sign into an empty account, or wait
 * for a failure to happen on its own.
 */
export type DataStateOverride =
  | 'live'
  | 'skeleton'
  | 'offline-cached'
  | 'offline-empty'
  | 'error'
  | 'no-vehicle';

type VehicleResult = UseQueryResult<Vehicle, Error>;

/**
 * Rewrite the `useVehicle` result so the real screens render `state` as if it
 * had come from the network. We keep everything else the hook returns
 * (`refetch`, etc.) and only swap the fields the screens branch on — `data`,
 * `error`, and the loading/settled flags — so each state drives the exact same
 * code path production does. `live` is returned untouched.
 */
export function overrideVehicleResult(query: VehicleResult, state: DataStateOverride): VehicleResult {
  if (state === 'live') {
    return query;
  }
  switch (state) {
    // First-load: no data yet, still loading. The screens show the skeleton /
    // redacted layout.
    case 'skeleton':
    case 'offline-empty':
      return {
        ...query,
        data: undefined,
        error: null,
        // `offline-empty` is settled (nothing will load while offline);
        // `skeleton` is mid-flight. Either way there is no data — the offline
        // banner is what tells them apart, driven by the online override below.
        isLoading: state === 'skeleton',
        isPending: true,
        isFetching: state === 'skeleton',
        isError: false,
        isSuccess: false,
        status: 'pending',
      } as VehicleResult;
    // Settled with data — paired with a forced-offline online state so the
    // screens show the cached dashboard behind the offline banner.
    case 'offline-cached':
      return {
        ...query,
        data: PLACEHOLDER_VEHICLE,
        error: null,
        isLoading: false,
        isPending: false,
        isFetching: false,
        isError: false,
        isSuccess: true,
        status: 'success',
        dataUpdatedAt: query.dataUpdatedAt || Date.now(),
      } as VehicleResult;
    // Settled failure (online), so the screens show the "Vehicle unavailable"
    // error rather than the offline skeleton.
    case 'error':
      return failed(query, new Error('Forced fetch error (dev override)'));
    // A settled NoVehicleError, which the screens render as the distinct
    // "No vehicle found" empty state.
    case 'no-vehicle':
      return failed(query, new NoVehicleError());
  }
}

function failed(query: VehicleResult, error: Error): VehicleResult {
  return {
    ...query,
    data: undefined,
    error,
    isLoading: false,
    isPending: false,
    isFetching: false,
    isError: true,
    isSuccess: false,
    status: 'error',
  } as VehicleResult;
}

/**
 * The online state the vehicle screens should see for `state`. The offline
 * states force `false` (that is what the override is for); the error and empty
 * states force `true` so the screens reach the error/empty branches instead of
 * the offline skeleton; `live` passes the device's real connectivity through.
 */
export function overrideIsOnline(real: boolean, state: DataStateOverride): boolean {
  switch (state) {
    case 'offline-cached':
    case 'offline-empty':
      return false;
    case 'skeleton':
    case 'error':
    case 'no-vehicle':
      return true;
    case 'live':
      return real;
  }
}
