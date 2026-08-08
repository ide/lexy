import { describe, expect, it } from "vitest";

import {
  composeVehicle,
  parseVehicleProfile,
  parseVehicleStatus,
  type VehicleProfile,
  type VehicleStatus,
} from "./vehicle";

const profile: VehicleProfile = {
  nickname: "Daily driver",
  fullName: "2025 Lexus Example",
  model: "Example sedan",
  brand: "L",
  color: "Silver",
  vin: "TESTVIN1234567890",
  modelCode: "0000",
  region: "US",
  generation: "21MM",
  fuelType: "Gasoline",
  transmission: "Automatic",
  drivetrain: "RWD",
  headUnit: "Premium",
  trim: "Premium",
  imageUrl: "https://example.com/vehicle.png",
  inServiceDate: "2025-01-02",
  manufacturedDate: "2024-12-01",
  capabilities: [{ label: "Lock & Unlock", symbol: "lock" }],
  remoteCapabilities: ["doors", "engine"],
  subscriptions: [
    {
      name: "Remote Connect",
      status: "Active",
      active: true,
      trial: false,
      expires: "Jan 2, 2028",
    },
  ],
};

const snapshot: VehicleStatus = {
  vin: "TESTVIN1234567890",
  updatedAt: "2026-07-24T17:03:10Z",
  fuelPercent: 75,
  distanceUnit: "mi",
  range: 250,
  odometer: 12_345,
  cautionCount: 0,
  tripA: 10.2,
  tripB: 20.4,
  location: { latitude: 37.5, longitude: -122.2 },
  closures: [{ label: "Driver Door", state: "Closed", locked: true }],
};

describe("parseVehicleProfile", () => {
  it("accepts a normalized profile", () => {
    expect(parseVehicleProfile(profile)).toEqual(profile);
  });

  it("rejects malformed profiles instead of caching them", () => {
    expect(() => parseVehicleProfile({ ...profile, subscriptions: null })).toThrow(
      "Invalid vehicle profile",
    );
  });
});

describe("parseVehicleStatus", () => {
  it("accepts a normalized status snapshot", () => {
    expect(parseVehicleStatus(snapshot)).toEqual(snapshot);
  });

  it("rejects malformed snapshots instead of caching them", () => {
    expect(() => parseVehicleStatus({ ...snapshot, location: null })).toThrow(
      "Invalid vehicle status",
    );
  });

  it("rejects a distance unit outside mi/km", () => {
    expect(() => parseVehicleStatus({ ...snapshot, distanceUnit: "Mile" })).toThrow(
      "Invalid vehicle status",
    );
  });

  // The stamp is what lets composeVehicle refuse a mismatched join, so a
  // snapshot without one is not a snapshot.
  it("rejects a snapshot with no VIN", () => {
    const { vin: _vin, ...withoutVin } = snapshot;
    expect(() => parseVehicleStatus(withoutVin)).toThrow("Invalid vehicle status");
  });
});

describe("composeVehicle", () => {
  it("joins the two halves into the view the screens render", () => {
    expect(composeVehicle(profile, snapshot)).toEqual({ ...profile, ...snapshot });
  });

  // Cached halves outlive each other — a vehicle switch, or a status blob
  // persisted before an account change. Rendering identity from one car beside
  // live state from another would be worse than rendering nothing.
  it("refuses to join a status snapshot from a different car", () => {
    expect(composeVehicle(profile, { ...snapshot, vin: "OTHERVIN000000000" })).toBeNull();
  });
});
