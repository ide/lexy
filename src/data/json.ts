// The vocabulary every wire-parsing module in this layer reads JSON through.
// Lexus responses are `unknown` until proven otherwise, and each one arrives
// either bare or inside a `{ payload }` envelope, so narrowing and coercion are
// the two things every parser needs before it can say anything.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `isRecord` as a coercion: an unusable value becomes an empty record. */
export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

export function hasNumber(record: Record<string, unknown>, field: string): boolean {
  return typeof record[field] === "number" && Number.isFinite(record[field]);
}

/** The first key holding a non-empty string, or undefined when none does. */
export function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key]) {
      return record[key] as string;
    }
  }
  return undefined;
}
