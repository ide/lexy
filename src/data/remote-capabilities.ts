import { isRecord } from "@/data/json";

/**
 * What remote actions a vehicle will accept, read from its discovery record.
 *
 * Discovery carries *two* capability blocks that disagree. `extendedCapabilities`
 * is the one to trust: every gate in the official app — `isTrunkLockUnlockCapable`,
 * `isHornCapable`, `isBuzzerCapable`, `isHazardCapable`, `isLightsCapable`,
 * `isMoonRoofCapable`, `isPowerWindowCapable` — reads it, and none of them read
 * `remoteServiceCapabilities`. On a 2026 IS 350 the latter reports
 * `trunkCapable: false` and `hornCommandCapable: false` for a car whose trunk and
 * horn both work, so gating on it would hide controls that function.
 *
 * Absent means unsupported: the block only lists what a car *can* do, so a
 * missing key is a "no" rather than something to fall back on.
 */
export type RemoteCapability =
  | "doors"
  | "engine"
  | "trunk"
  | "horn"
  | "buzzer"
  | "hazards"
  | "headlights"
  | "moonroof"
  | "windows";

/**
 * The `extendedCapabilities` flag behind each capability, named exactly as the
 * app's own accessors read them.
 *
 * `moonroof` is the trap: the block carries both a bare `moonroof` flag and a
 * `moonroofCloseCapable` one, and `isMoonRoofCapable()` reads the *second*. A
 * car can advertise `moonroof: true` and still refuse the command, which is
 * exactly what this vehicle does.
 */
const FLAGS: Record<Exclude<RemoteCapability, "windows">, string> = {
  doors: "doorLockUnlockCapable",
  engine: "remoteEngineStartStop",
  trunk: "trunkLockUnlockCapable",
  horn: "hornCapable",
  buzzer: "buzzerCapable",
  hazards: "hazardCapable",
  headlights: "lightsCapable",
  moonroof: "moonroofCloseCapable",
};

/**
 * How each extra capability is named in the More Controls subtitle. Doors and
 * the engine are absent on purpose: they are the buttons already on screen
 * above the disclosure, so naming them here would advertise what isn't behind
 * it.
 */
const EXTRA_NAMES: { capability: RemoteCapability; name: string }[] = [
  { capability: "trunk", name: "trunk" },
  { capability: "headlights", name: "headlights" },
  { capability: "hazards", name: "hazards" },
  { capability: "horn", name: "horn" },
  { capability: "buzzer", name: "buzzer" },
  { capability: "moonroof", name: "moonroof" },
  { capability: "windows", name: "windows" },
];

/**
 * A sentence naming what the disclosure hides, e.g. "Trunk, headlights,
 * hazards, horn, and buzzer" — so the row says what opening it will offer
 * rather than making the reader open it to find out.
 *
 * Returns an empty string when there is nothing extra, which is also when the
 * disclosure itself shouldn't be rendered.
 */
export function describeExtraControls(capabilities: RemoteCapability[]): string {
  const names = EXTRA_NAMES.filter(({ capability }) => capabilities.includes(capability)).map(
    ({ name }) => name,
  );
  if (names.length === 0) {
    return "";
  }
  const sentence =
    names.length === 1
      ? names[0]
      : // Oxford comma, matching the rest of the app's copy.
        `${names.slice(0, -1).join(", ")}${names.length > 2 ? "," : ""} and ${names[names.length - 1]}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * Read the capability set from a discovery vehicle record. Anything
 * unrecognizable yields an empty set — no capability is assumed, so a shape we
 * don't understand hides controls rather than offering ones the car will
 * reject.
 */
export function parseRemoteCapabilities(vehicleRecord: unknown): RemoteCapability[] {
  if (!isRecord(vehicleRecord)) {
    return [];
  }
  const extended = vehicleRecord.extendedCapabilities;
  if (!isRecord(extended)) {
    return [];
  }

  const capabilities: RemoteCapability[] = (
    Object.keys(FLAGS) as Exclude<RemoteCapability, "windows">[]
  ).filter((capability) => extended[FLAGS[capability]] === true);

  // Windows are the one pair the app treats as either-or: `isPowerWindowCapable`
  // is true when the car can open *or* close them.
  if (extended.powerWindowsOpenCapable === true || extended.powerWindowsCloseCapable === true) {
    capabilities.push("windows");
  }
  return capabilities;
}
