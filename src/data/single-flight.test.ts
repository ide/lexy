import { describe, expect, it, vi } from "vitest";

import { createSingleFlight } from "./single-flight";

// A promise whose settling this test controls.
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createSingleFlight", () => {
  it("is not running until something runs", () => {
    expect(createSingleFlight().isRunning()).toBe(false);
  });

  it("joins a second call to the run already in progress", async () => {
    const flight = createSingleFlight();
    const first = deferred();
    const operation = vi.fn(() => first.promise);
    const second = vi.fn(async () => {});

    const a = flight.run(operation);
    const b = flight.run(second);
    // The joiner's operation is never started — it is the same refresh.
    expect(second).not.toHaveBeenCalled();
    expect(a).toBe(b);

    first.resolve();
    await Promise.all([a, b]);
    expect(operation).toHaveBeenCalledOnce();
  });

  it("runs again once the previous run settles", async () => {
    const flight = createSingleFlight();
    await flight.run(async () => {});
    const operation = vi.fn(async () => {});
    await flight.run(operation);
    expect(operation).toHaveBeenCalledOnce();
  });

  it("reports running for exactly the operation's duration", async () => {
    const flight = createSingleFlight();
    const gate = deferred();
    const running = flight.run(() => gate.promise);
    expect(flight.isRunning()).toBe(true);
    gate.resolve();
    await running;
    expect(flight.isRunning()).toBe(false);
  });

  // A failure that left the slot latched would block every later refresh and
  // pin the on-screen indicator forever — the exact shape of the bug this
  // module is meant to make impossible.
  it("clears after a failed run, and reports the failure", async () => {
    const flight = createSingleFlight();
    const failing = flight.run(async () => {
      throw new Error("network");
    });
    await expect(failing).rejects.toThrow("network");
    expect(flight.isRunning()).toBe(false);

    const operation = vi.fn(async () => {});
    await flight.run(operation);
    expect(operation).toHaveBeenCalledOnce();
  });

  it("notifies subscribers when a run starts and when it settles", async () => {
    const flight = createSingleFlight();
    const seen: boolean[] = [];
    flight.subscribe(() => seen.push(flight.isRunning()));

    const gate = deferred();
    const running = flight.run(() => gate.promise);
    gate.resolve();
    await running;

    expect(seen).toEqual([true, false]);
  });

  it("stops notifying an unsubscribed listener", async () => {
    const flight = createSingleFlight();
    const listener = vi.fn();
    flight.subscribe(listener)();
    await flight.run(async () => {});
    expect(listener).not.toHaveBeenCalled();
  });
});
