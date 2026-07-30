// Rate-limit gate for `refresh-status` (the sender lives in
// refresh-status-sender.ts, split out so this stays free of the expo/fetch
// native import and unit-testable in Node).
//
// `refresh-status` wakes the car's telematics unit and asks every body module
// to report — expensive for the 12V battery and cellular link, so it is gated
// to an explicit user pull-to-refresh and rate-limited per vehicle. Between
// primes, the normal status GET (plus the materialized closure store) keeps the
// dashboard populated.
export const REFRESH_STATUS_MIN_INTERVAL_MS = 3 * 60 * 1000;

// Last prime time per VIN, in memory. A cold start resets it, which is fine —
// the first refresh of a session is exactly when a prime is most useful.
const lastPrimeByVin = new Map<string, number>();

/** Whether a prime is allowed for this VIN right now. */
export function canRefreshStatus(vin: string, now: number = Date.now()): boolean {
  const last = lastPrimeByVin.get(vin);
  return last === undefined || now - last >= REFRESH_STATUS_MIN_INTERVAL_MS;
}

/** Record that a prime was sent, starting the rate-limit window. */
export function recordPrime(vin: string, now: number = Date.now()): void {
  lastPrimeByVin.set(vin, now);
}

/** Undo a recorded prime — used when the request never landed, so a failed
 * attempt doesn't burn the interval. */
export function releasePrime(vin: string): void {
  lastPrimeByVin.delete(vin);
}

/** Test seam: clear the in-memory rate-limit state. */
export function resetRefreshStatusRateLimit(): void {
  lastPrimeByVin.clear();
}
