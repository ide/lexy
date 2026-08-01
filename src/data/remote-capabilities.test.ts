import { describe, expect, it } from "vitest";

import { parseRemoteCapabilities } from "./remote-capabilities";

// The block as a 2026 IS 350 reports it: only the true flags are present.
const IS350 = {
  extendedCapabilities: {
    buzzerCapable: true,
    climateCapable: true,
    doorLockUnlockCapable: true,
    hazardCapable: true,
    hornCapable: true,
    lightsCapable: true,
    moonroof: true,
    remoteEngineStartStop: true,
    trunkLockUnlockCapable: true,
  },
  // Deliberately contradicts the block above, exactly as the real record does.
  remoteServiceCapabilities: {
    trunkCapable: false,
    trunkCommandCapable: false,
    hornCommandCapable: false,
    moonRoofCapable: true,
  },
};

describe("parseRemoteCapabilities", () => {
  it("reads the capabilities the app gates on", () => {
    expect(parseRemoteCapabilities(IS350).sort()).toEqual([
      "buzzer",
      "doors",
      "engine",
      "hazards",
      "headlights",
      "horn",
      "trunk",
    ]);
  });

  it("trusts extendedCapabilities over the block that contradicts it", () => {
    // remoteServiceCapabilities calls both of these unsupported; the car
    // does them.
    expect(parseRemoteCapabilities(IS350)).toContain("trunk");
    expect(parseRemoteCapabilities(IS350)).toContain("horn");
  });

  it("does not take a bare `moonroof` flag for the command capability", () => {
    // `isMoonRoofCapable()` reads moonroofCloseCapable, which this car omits.
    expect(parseRemoteCapabilities(IS350)).not.toContain("moonroof");

    const withClose = { extendedCapabilities: { moonroofCloseCapable: true } };
    expect(parseRemoteCapabilities(withClose)).toContain("moonroof");
  });

  it("counts windows when the car can open or close them", () => {
    expect(
      parseRemoteCapabilities({ extendedCapabilities: { powerWindowsOpenCapable: true } }),
    ).toContain("windows");
    expect(
      parseRemoteCapabilities({ extendedCapabilities: { powerWindowsCloseCapable: true } }),
    ).toContain("windows");
    expect(parseRemoteCapabilities({ extendedCapabilities: {} })).not.toContain("windows");
  });

  it("assumes nothing from a shape it doesn't recognize", () => {
    expect(parseRemoteCapabilities(undefined)).toEqual([]);
    expect(parseRemoteCapabilities({})).toEqual([]);
    expect(parseRemoteCapabilities({ extendedCapabilities: null })).toEqual([]);
    // A flag has to be exactly `true` — a truthy string is a shape we don't
    // understand, not a yes.
    expect(parseRemoteCapabilities({ extendedCapabilities: { hornCapable: "Y" } })).toEqual([]);
  });
});
