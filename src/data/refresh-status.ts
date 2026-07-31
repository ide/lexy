// Rate-limit gate for `refresh-status` (the sender lives in
// refresh-status-sender.ts, split out so this stays free of the expo/fetch
// native import and unit-testable in Node).
//
// `refresh-status` wakes the car's telematics unit and asks every body module
// to report — expensive for the 12V battery and cellular link, so it is
// rate-limited per vehicle. Between primes, the normal status GET (plus the
// materialized closure store) keeps the dashboard populated.
//
// Three things prime, and this one window bounds all of them: a pull-to-
// refresh, an app open onto data old enough that the plain GET would likely
// return the same stale snapshot (resume-refresh.ts), and a lock command whose
// outcome plain re-reads can't settle (lock-reconcile.ts). Only the first is a
// deliberate gesture, so the window is what keeps the other two from spending
// the user's battery on their own initiative — and a prime that the limiter
// declines is recorded (vehicle.prime, with its trigger) so how often the
// automatic ones take the window from a later pull is measurable rather than
// assumed.
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
