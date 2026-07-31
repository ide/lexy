import { describe, expect, it } from "vitest";

import {
  absoluteLocalTime,
  composeVehicle,
  mapVehicleProfile,
  mapVehicleStatus,
  observedAt,
  parseSubscriptionVehicle,
  parseVehicleContexts,
  parseVehicleProfile,
  parseVehicleStatus,
  relativeTime,
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
  capabilities: [{ label: "Lock & Unlock", symbol: "lock.fill" }],
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

describe("parseVehicleContexts", () => {
  it("pulls VIN, brand, and generation from the single discovery entry", () => {
    const body = { payload: [{ vin: "TESTVIN1234567890", brand: "L", generation: "21MM" }] };
    expect(parseVehicleContexts(body)).toEqual([
      { vin: "TESTVIN1234567890", brand: "L", generation: "21MM" },
    ]);
  });

  it("returns every enrolled vehicle in order for a multi-car account", () => {
    const body = {
      payload: [
        { vin: "VIN_A", brand: "L", generation: "21MM" },
        { vin: "VIN_B", brand: "L", generation: "24MM" },
      ],
    };
    expect(parseVehicleContexts(body).map((c) => c.vin)).toEqual(["VIN_A", "VIN_B"]);
  });

  it("returns an empty list when the account has no vehicle", () => {
    expect(parseVehicleContexts({ payload: [] })).toEqual([]);
    expect(parseVehicleContexts({})).toEqual([]);
  });

  it("skips entries missing VIN, brand, or generation", () => {
    const body = {
      payload: [{ vin: "V1" }, { vin: "V2", brand: "L", generation: "21MM" }],
    };
    expect(parseVehicleContexts(body).map((c) => c.vin)).toEqual(["V2"]);
  });
});

describe("mapVehicleProfile / mapVehicleStatus", () => {
  // Fixtures captured from live production responses for the account's IS 350.
  const VIN = "JTHGZ1B20M5000000";
  const discovery = {
    payload: [
      {
        vin: "JTHGZ1B20M5000000",
        nickName: "2026 IS 350",
        displayModelDescription: "2026 Lexus IS 350 4-DOOR SEDAN",
        modelName: "IS 350 4-DOOR SEDAN",
        modelYear: "2026",
        modelCode: "9510",
        color: "Cloudburst Grey",
        region: "US",
        generation: "21MM",
        brand: "L",
        asiCode: "JG",
        hwType: "211",
        fuelType: "G",
        image: "https://img.example/is350.png",
      },
    ],
  };
  const status = {
    payload: {
      status: {
        driverPosition: "LEFT",
        vehicleStatus: [
          {
            category: "Driver Side",
            sections: [
              {
                section: "Door",
                values: [
                  { value: "Closed", status: 0 },
                  { value: "Locked", status: 0 },
                ],
              },
              { section: "Window", values: [{ value: "Closed", status: 0 }] },
            ],
          },
          {
            category: "Other",
            sections: [{ section: "Trunk", values: [{ value: "Open", status: 1 }] }],
          },
          {
            category: "Trip Details",
            sections: [
              { section: "Trip A", values: [{ value: "272.1 miles", status: 0 }] },
              { section: "Trip B", values: [{ value: "735.1 miles", status: 0 }] },
            ],
          },
        ],
        telemetry: {
          fugage: { value: 100, unit: "%" },
          rage: { value: 281, unit: "Mile" },
          odo: { value: 735, unit: "Mile" },
        },
        occurrenceDate: "2026-07-28T01:23:50Z",
        cautionOverallCount: 0,
        latitude: 37.41144,
        longitude: -122.12686,
      },
    },
  };
  const spec = {
    payload: {
      vehicleSpecifications: {
        dataItems: [
          { dataName: "Drive Type", dataValue: "2WD" },
          { dataName: "Grade", dataValue: "F SPORT" },
          { dataName: "Transmission", dataValue: "8AT-F" },
          { dataName: "Date of First Use", dataValue: "April 23, 2026" },
        ],
      },
      additionalDetails: { dataItems: [{ dataName: "Order Date", dataValue: "03/2026" }] },
    },
  };

  const tires = {
    payload: {
      vin: "JTHGZ1B20M5000000",
      tirePressureStatus: "Good",
      flTirePressure: { value: 39, unit: "psi", displayLowTirePressureWarning: false },
      frTirePressure: { value: 39, unit: "psi", displayLowTirePressureWarning: false },
      rlTirePressure: { value: 40, unit: "psi", displayLowTirePressureWarning: false },
      rrTirePressure: { value: 33, unit: "psi", displayLowTirePressureWarning: true },
    },
  };

  // Unwrapped v3 vehicle-subscriptions payload (as fetchVehicleSubscriptions returns it).
  const subscriptions = {
    paidSubscriptions: [
      {
        productName: "Remote Connect",
        status: "ACTIVE",
        type: "Paid",
        subscriptionEndDate: "2028-04-23",
      },
    ],
    trialSubscriptions: [
      {
        displayProductName: "Service Connect",
        status: "active",
        type: "Trial",
        subscriptionEndDate: "2036-04-23",
      },
      {
        productName: "Wi-Fi Connect",
        status: "INACTIVE",
        type: "Trial",
        subscriptionEndDate: "2026-08-28",
      },
    ],
    // A complimentary service with no end date — the expiry line is omitted.
    complimentarySubscriptions: [
      { productName: "Safety Connect", status: "ACTIVE", type: "Complimentary" },
    ],
    availableSubscriptions: [{ productName: "Music Lover", category: "BUNDLE" }],
  };

  it("maps discovery and the spec sheet into the profile", () => {
    expect(mapVehicleProfile(discovery, spec, subscriptions)).toMatchObject({
      nickname: "2026 IS 350",
      fullName: "2026 Lexus IS 350 4-DOOR SEDAN",
      model: "IS 350 4-DOOR SEDAN",
      color: "Cloudburst Grey",
      vin: VIN,
      modelCode: "9510",
      generation: "21MM",
      fuelType: "Gasoline",
      transmission: "8AT-F",
      drivetrain: "2WD",
      trim: "F SPORT",
      headUnit: "Lexus Multimedia (21MM)",
      inServiceDate: "April 23, 2026",
    });
  });

  it("maps the status and tire responses into the snapshot", () => {
    const mapped = mapVehicleStatus(VIN, status, tires);
    expect(mapped.tires).toEqual({
      status: "Good",
      unit: "psi",
      positions: [
        { label: "Front left", value: 39, low: false },
        { label: "Front right", value: 39, low: false },
        { label: "Rear left", value: 40, low: false },
        { label: "Rear right", value: 33, low: true },
      ],
    });
    expect(mapped).toMatchObject({
      vin: VIN,
      updatedAt: "2026-07-28T01:23:50Z",
      fuelPercent: 100,
      distanceUnit: "mi",
      range: 281,
      odometer: 735,
      tripA: 272.1,
      tripB: 735.1,
      location: { latitude: 37.41144, longitude: -122.12686 },
    });
    expect(mapped.closures).toEqual([
      { label: "Driver Door", state: "Closed", locked: true },
      { label: "Driver Window", state: "Closed" },
      { label: "Trunk", state: "Open" },
    ]);
  });

  // The snapshot is stamped with the car that was *asked*, not with anything the
  // payload echoes — that stamp is what composeVehicle checks.
  it("stamps the snapshot with the requested VIN", () => {
    expect(mapVehicleStatus("OTHERVIN000000000", status, tires).vin).toBe("OTHERVIN000000000");
  });

  it("flattens paid/trial/complimentary subscriptions with status, trial, and expiry", () => {
    const mapped = mapVehicleProfile(discovery, spec, subscriptions);
    expect(mapped.subscriptions).toEqual([
      {
        name: "Remote Connect",
        status: "Active",
        active: true,
        trial: false,
        expires: "April 2028",
      },
      {
        name: "Service Connect",
        status: "Active",
        active: true,
        trial: true,
        expires: "April 2036",
      },
      {
        name: "Wi-Fi Connect",
        status: "Inactive",
        active: false,
        trial: true,
        expires: "August 2026",
      },
      // No end date → no `expires` key at all.
      { name: "Safety Connect", status: "Active", active: true, trial: false },
    ]);
  });

  it("leaves subscriptions empty when the read is missing or failed", () => {
    expect(mapVehicleProfile(discovery, spec, null).subscriptions).toEqual([]);
    expect(mapVehicleProfile(discovery, spec).subscriptions).toEqual([]);
  });

  it("produces halves that pass their own validation, and join", () => {
    const mappedProfile = parseVehicleProfile(mapVehicleProfile(discovery, spec));
    const mappedStatus = parseVehicleStatus(mapVehicleStatus(VIN, status));
    expect(composeVehicle(mappedProfile, mappedStatus)).not.toBeNull();
  });

  it("keeps lock-only closures from sparse status snapshots", () => {
    // Captured live 2026-07-29: after driving, most sections report only the
    // lock with no Open/Closed position (and windows vanish entirely).
    const sparse = structuredClone(status);
    sparse.payload.status.vehicleStatus = [
      {
        category: "Driver Side",
        sections: [
          {
            section: "Door",
            values: [
              { value: "Closed", status: 0 },
              { value: "Locked", status: 0 },
            ],
          },
          { section: "Rear Door", values: [{ value: "Locked", status: 0 }] },
        ],
      },
      {
        category: "Passenger Side",
        sections: [{ section: "Door", values: [{ value: "Locked", status: 0 }] }],
      },
      { category: "Other", sections: [{ section: "Trunk", values: [] }] },
    ] as typeof status.payload.status.vehicleStatus;
    expect(mapVehicleStatus(VIN, sparse).closures).toEqual([
      { label: "Driver Door", state: "Closed", locked: true },
      { label: "Driver Rear Door", locked: true },
      { label: "Passenger Door", locked: true },
    ]);
  });

  it("takes the distance unit from telemetry, defaulting to miles", () => {
    const metricStatus = structuredClone(status);
    metricStatus.payload.status.telemetry.rage.unit = "Kilometer";
    expect(mapVehicleStatus(VIN, metricStatus).distanceUnit).toBe("km");

    const unitless = structuredClone(status);
    // @ts-expect-error -- exercise telemetry that omits the unit entirely
    delete unitless.payload.status.telemetry.rage.unit;
    // @ts-expect-error
    delete unitless.payload.status.telemetry.odo.unit;
    expect(mapVehicleStatus(VIN, unitless).distanceUnit).toBe("mi");
  });
});

describe("parseSubscriptionVehicle", () => {
  const record = {
    vin: "JTHGZ1B20M5000000",
    brand: "L",
    generation: "21MM",
    region: "US",
    asiCode: "JG",
    hwType: "211",
  };

  it("pulls the region/ASI/hardware context the v3 list requires", () => {
    expect(parseSubscriptionVehicle({ payload: [record] })).toEqual(record);
  });

  it("returns null when a required discovery field is absent", () => {
    expect(parseSubscriptionVehicle({ payload: [{ ...record, hwType: undefined }] })).toBeNull();
    expect(parseSubscriptionVehicle({ payload: [] })).toBeNull();
  });
});

describe("observedAt", () => {
  const fetchedAt = Date.parse("2026-07-28T12:00:00Z");

  it("passes a stamp older than the read through untouched", () => {
    const at = "2026-07-28T11:30:00Z";
    expect(observedAt(at, fetchedAt)).toBe(Date.parse(at));
  });

  // The bug this exists for. The car's clock ran three minutes ahead of the
  // phone's, so its snapshot claimed to be newer than the fetch that carried
  // it, and the footer contradicted itself: "Lexy has data from 2 hours 35
  // minutes ago" directly under "Vehicle last synced with Lexus 2 hours 32
  // minutes ago".
  it("never reports a vehicle stamp as newer than the read that carried it", () => {
    const ahead = "2026-07-28T12:03:00Z";
    expect(observedAt(ahead, fetchedAt)).toBe(fetchedAt);
  });

  // The property that matters, stated directly: whatever the two clocks are
  // doing, the car's last word can never read as more recent than our own data.
  it("keeps the sync line no more recent than the data line", () => {
    const now = fetchedAt + 60_000;
    for (const skewMinutes of [-90, -5, 0, 3, 45]) {
      const at = new Date(fetchedAt + skewMinutes * 60_000).toISOString();
      const syncAge = now - observedAt(at, fetchedAt);
      const dataAge = now - fetchedAt;
      expect(syncAge).toBeGreaterThanOrEqual(dataAge);
    }
  });

  it("leaves the stamp alone when there is no read to bound it by", () => {
    const at = "2026-07-28T12:03:00Z";
    expect(observedAt(at, 0)).toBe(Date.parse(at));
  });

  it("returns NaN for a missing or unparseable stamp, which reads as unknown", () => {
    expect(observedAt(undefined, fetchedAt)).toBeNaN();
    expect(observedAt("not a date", fetchedAt)).toBeNaN();
    expect(relativeTime(observedAt("not a date", fetchedAt))).toBe("unknown");
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-07-28T12:00:00Z");
  const ago = (ms: number) => relativeTime(now - ms, now);
  const sec = 1000;
  const min = 60 * sec;
  const hour = 60 * min;
  const day = 24 * hour;

  it('says "just now" for the last few seconds', () => {
    expect(ago(0)).toBe("just now");
    expect(ago(4 * sec)).toBe("just now");
  });

  it("counts seconds", () => {
    expect(ago(5 * sec)).toBe("5 seconds ago");
    expect(ago(59 * sec)).toBe("59 seconds ago");
  });

  it("counts minutes", () => {
    expect(ago(1 * min)).toBe("1 minute ago");
    expect(ago(59 * min + 59 * sec)).toBe("59 minutes ago");
  });

  it("pairs hours with leftover minutes", () => {
    expect(ago(2 * hour)).toBe("2 hours ago");
    expect(ago(1 * hour)).toBe("1 hour ago");
    expect(ago(2 * hour + 5 * min)).toBe("2 hours 5 minutes ago");
    expect(ago(1 * hour + 1 * min)).toBe("1 hour 1 minute ago");
  });

  it("pairs days with leftover hours", () => {
    expect(ago(1 * day)).toBe("1 day ago");
    expect(ago(3 * day + 2 * hour)).toBe("3 days 2 hours ago");
  });

  it('returns "unknown" for unparseable input', () => {
    expect(relativeTime("not a date", now)).toBe("unknown");
  });
});

describe("absoluteLocalTime", () => {
  it("formats a timestamp and rejects garbage", () => {
    expect(absoluteLocalTime(Date.parse("2026-07-28T12:00:00Z"))).toMatch(/2026/);
    expect(absoluteLocalTime("not a date")).toBe("Unknown time");
  });
});
