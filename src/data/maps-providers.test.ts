import { describe, expect, it } from "vitest";

import {
  describeMapsProviderChoice,
  geoUri,
  getMapsProvider,
  isMapsProviderId,
  resolveMapsProvider,
  type MapsProviderId,
} from "./maps-providers";

const TARGET = { latitude: 37.3318, longitude: -122.0312, label: "My Vehicle" };

describe("buildDirectionsUrl", () => {
  it("builds an Apple Maps universal link with an encoded label", () => {
    expect(getMapsProvider("apple").buildDirectionsUrl(TARGET)).toBe(
      "https://maps.apple.com/?ll=37.3318,-122.0312&q=My%20Vehicle",
    );
  });

  it("drops a labeled pin for Google Maps", () => {
    expect(getMapsProvider("google").buildDirectionsUrl(TARGET)).toBe(
      "comgooglemaps://?q=37.3318,-122.0312(My%20Vehicle)&center=37.3318,-122.0312",
    );
  });

  it("navigates straight to the point for Waze", () => {
    expect(getMapsProvider("waze").buildDirectionsUrl(TARGET)).toBe(
      "waze://?ll=37.3318,-122.0312&navigate=yes",
    );
  });
});

describe("isMapsProviderId", () => {
  it("accepts known ids and rejects everything else", () => {
    expect(isMapsProviderId("apple")).toBe(true);
    expect(isMapsProviderId("waze")).toBe(true);
    expect(isMapsProviderId("bing")).toBe(false);
    expect(isMapsProviderId(null)).toBe(false);
    expect(isMapsProviderId(undefined)).toBe(false);
  });
});

describe("resolveMapsProvider", () => {
  it("disables with no installed apps", () => {
    expect(resolveMapsProvider(null, [])).toEqual({
      kind: "none",
      staleSaved: false,
    });
  });

  it("flags a stale saved provider when nothing is installed", () => {
    expect(resolveMapsProvider("google", [])).toEqual({
      kind: "none",
      staleSaved: true,
    });
  });

  it("auto-picks the only installed app without prompting or remembering", () => {
    expect(resolveMapsProvider(null, ["waze"])).toEqual({
      kind: "ready",
      provider: getMapsProvider("waze"),
      remembered: false,
      staleSaved: false,
    });
  });

  it("prompts when several are installed and nothing is saved", () => {
    const result = resolveMapsProvider(null, ["google", "apple", "waze"]);
    expect(result.kind).toBe("prompt");
    if (result.kind === "prompt") {
      // Options come back in canonical order regardless of detection order.
      expect(result.options.map((p) => p.id)).toEqual(["apple", "google", "waze"]);
      expect(result.staleSaved).toBe(false);
    }
  });

  it("uses a saved provider that is still installed", () => {
    expect(resolveMapsProvider("google", ["apple", "google"])).toEqual({
      kind: "ready",
      provider: getMapsProvider("google"),
      remembered: true,
      staleSaved: false,
    });
  });

  it("re-prompts and flags stale when the saved provider was uninstalled", () => {
    const result = resolveMapsProvider("waze", ["apple", "google"]);
    expect(result.kind).toBe("prompt");
    expect(result.staleSaved).toBe(true);
  });

  it("falls back to the single remaining app when the saved one is gone", () => {
    const result = resolveMapsProvider("waze", ["apple"]);
    expect(result).toEqual({
      kind: "ready",
      provider: getMapsProvider("apple"),
      remembered: false,
      staleSaved: true,
    });
  });

  it("ignores unrecognized installed ids", () => {
    const bogus = ["bing", "apple"] as unknown as MapsProviderId[];
    expect(resolveMapsProvider(null, bogus)).toEqual({
      kind: "ready",
      provider: getMapsProvider("apple"),
      remembered: false,
      staleSaved: false,
    });
  });
});

describe("describeMapsProviderChoice", () => {
  it("reads Unavailable when no maps app is installed", () => {
    expect(describeMapsProviderChoice({ kind: "none", staleSaved: false }, null)).toBe(
      "Unavailable",
    );
  });

  it("prefers the deliberate saved choice", () => {
    expect(
      describeMapsProviderChoice(
        resolveMapsProvider("waze", ["apple", "waze"]),
        getMapsProvider("waze"),
      ),
    ).toBe("Waze");
  });

  it("falls back to the auto-resolved single app", () => {
    expect(describeMapsProviderChoice(resolveMapsProvider(null, ["apple"]), null)).toBe(
      "Apple Maps",
    );
  });

  it("reads Not set with several apps and no saved choice", () => {
    expect(describeMapsProviderChoice(resolveMapsProvider(null, ["apple", "google"]), null)).toBe(
      "Not set",
    );
  });

  it("reads the saved name even before the first probe resolves", () => {
    expect(describeMapsProviderChoice(null, getMapsProvider("google"))).toBe("Google Maps");
  });
});

describe("geoUri", () => {
  it("carries the coordinates twice with the label parenthesized", () => {
    expect(geoUri({ latitude: 37.334606, longitude: -122.009102, label: "My IS 350" })).toBe(
      "geo:37.334606,-122.009102?q=37.334606,-122.009102(My%20IS%20350)",
    );
  });
});
