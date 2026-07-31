# Vehicle status & remote control

How the app reads a vehicle's state and sends remote commands. There are **two
planes**, chosen by telematics generation:

- **REST** (`/v1/remote/route/*`) — used by older generations including **21MM**.
- **GraphQL** (`oa-api.telematicsct.com/graphql` + realtime WebSocket) — used by **24MM**.

A client should hide the split behind one interface (`getStatus`, `refreshStatus`,
`submit`, `observe`) and route by the vehicle's `X-GENERATION`.

## Reading status

### REST — `GET /v1/remote/route/status`

Returns a snapshot with three parts:

- **`telemetry`** — `fugage` (fuel %), `range`, `odo`, each `{ value, unit }`.
- **`vehicleStatus`** — sectioned list of closures: each door, window, hood,
  moonroof, and trunk with `position` (Open/Closed) and, for doors, `lock`
  (Locked/Unlocked). Also `driverPosition`, `cautionOverallCount`, and trip
  details.
- **`location`** — `latitude`, `longitude`, `locationAcquisitionDatetime`.
- **`occurrenceDate`** — when the state was captured; compare across reads to
  confirm a command landed.

Companion reads:

| Method | Path                                | Returns                              |
| ------ | ----------------------------------- | ------------------------------------ |
| `GET`  | `/v1/remote/route/engine-status`    | Engine running/stopped               |
| `GET`  | `/v1/remote/route/climate-settings` | Setpoint, min/max, defrost options   |
| `POST` | `/v1/remote/route/refresh-status`   | Ask the vehicle to push fresh state  |
| `POST` | `/v1/remote/route/wake`             | Wake the telematics unit before work |
| `GET`  | `/oneapi/v2/legacy/remote/status`   | Legacy status                        |

### REST — `GET /v1/remote/route/engine-status`

Whether a remote start is currently running, and how much runtime is left.
Headers are the usual vehicle-scoped set (`x-brand`, `X-GENERATION`, `vin`).
Response is the standard `{ payload, status, timestamp }` envelope:

```json
{ "payload": { "vin": "…", "status": "1", "date": "2026-07-30T22:15:04Z", "timer": 20 } }
```

- **`status`** — a *string*, not a boolean. The official app treats **`"1"` as
  running** and nothing else; `"0"` (the field's default) and `"2"` are the
  other two values in its enum, both handled as not-running. What distinguishes
  `0` from `2` isn't expressed in the client.
- **`date`** — when the engine started, `yyyy-MM-dd'T'HH:mm:ss'Z'` in UTC.
- **`timer`** — runtime in minutes. When absent the app defaults to **20** for
  21MM and 24MM, 10 otherwise. Remaining runtime is `date + timer − now`.

After sending engine start or stop, the app polls this route **4 times at 20s
intervals** rather than trusting the command response.

On 24MM the same state comes from the GraphQL status tree instead, as
`vehicleState.engine { running, status, startTime, stopTime, lastUpdateBy }`.
There `status` is a word — `Pending` and `ExtendedRunning` are the two the
client matches — and `lastUpdateBy: "Remote"` distinguishes a remote start from
the driver having started the car with the key.

### REST — `GET|PUT /v1/remote/route/climate-settings`

The remote-start climate configuration (what a remote engine start runs — these
settings configure, they do not actuate). Captured live from a 21MM IS 350
(2026-07-29); the response envelope is `{ payload, status, timestamp }` where
`payload` is:

```json
{
  "temperature": 71,
  "temperatureUnit": "F",
  "minTemp": 65,
  "maxTemp": 85,
  "tempInterval": 1,
  "settingsOn": true,
  "extendedRuntime": { "available": false, "enabled": false },
  "acOperations": [
    {
      "categoryName": "defrost",
      "categoryDisplayName": "Defrost",
      "available": true,
      "acParameters": [
        {
          "name": "frontDefrost",
          "displayName": "Front Defrost",
          "iconUrl": "…",
          "available": true,
          "enabled": false
        },
        {
          "name": "rearDefrost",
          "displayName": "Rear Defrost",
          "iconUrl": "…",
          "available": true,
          "enabled": false
        }
      ]
    },
    { "categoryName": "seatHeat", "available": false },
    { "categoryName": "seatVent", "available": false },
    { "categoryName": "steeringHeaterCat", "available": false }
  ]
}
```

Writes are a `PUT` to the same route with the **bare settings object** as the
JSON body (no `payload` envelope) — round-trip exactly what the GET returned
with the `enabled` flags you want changed. Verified live: the PUT returns 200
and a subsequent GET reflects the new flags. Gate UI on the per-category and
per-parameter `available` flags (seat heat/vent/steering-wheel heat exist in
the schema but are unavailable on this vehicle).

### GraphQL — `GetVehicleStatus(vin)`

The 24MM plane returns a normalized, deeply-nested state tree in one query:
`vehicleState` (doors/windows/hatch/hood/moonroof/lamps/**tires** with
psi·kpa·bar/engine/sensors), `telemetry` (odo/fugage/range/consumption),
`tripdetails`, `location`, and `electric` (battery/charging/gasoline). The full
query — with every field — is in
[`data/lexus-3.4.0-graphql-operations.graphql`](./data/lexus-3.4.0-graphql-operations.graphql).

Refresh with `RefreshVehicleStatus(vin)`; stream updates with the
`ReceiveVehicleStatus(vin)` subscription.

## Sending commands

### REST — `POST /v1/remote/route/command`

Body: a typed command plus optional auto-fix metadata. `beepCount` is only sent
for `buzzer-warning`; `autoFixPopup` defaults to `false` in the app's own
request model.

```json
{ "command": "door-unlock", "autoFixPopup": false }
```

The response carries a `returnCode` (`000000` = accepted) — **acceptance, not
completion**. Confirm by polling `GET /v1/remote/route/status` until the closure
state changes and `occurrenceDate` advances, or — for engine start/stop —
`GET /v1/remote/route/engine-status`.

Other REST command routes: `POST /oneapi/v1/legacy/remote/command`,
`POST /oneapi/v2/electric/command` (EV), `GET|PUT /v1/remote/route/climate-settings`,
and the `/v1/remote/route/ac-reservation` set.

### GraphQL — `SendRemoteCommand(command, autoFixCommands)`

Returns `{ requestNo, correlationId, returnCode }`. Track to completion with the
`ReceiveRemoteCommandStatus(vin)` subscription, whose callback includes
`appRequestNo`, `remoteCommandType`, `command`, `status`, `message`, and
`commandEnded`. Wake first with `SendPreWakeCommand(guid)` when needed.

### Command codes

Recovered in full from the OneApp 3.4.0 Android build — the `RemoteCommand`
enum in `…/advanceremote/application/RemoteCommand.java`. These are the exact
strings the official app puts in the `command` field, on both the REST
(`POST /v1/remote/route/command`) and GraphQL (`SendRemoteCommand`) planes; the
enum is shared, so a code is not per-plane.

| Action         | `command`            | Notes                                |
| -------------- | -------------------- | ------------------------------------ |
| Engine start   | `engine-start`       | Remote start; see the safety copy    |
| Engine stop    | `engine-stop`        | Cancels a running remote start       |
| Extend runtime | `add-runtime`        | Gated on `extendedRuntime.available` |
| Door lock      | `door-lock`          |                                      |
| Door unlock    | `door-unlock`        |                                      |
| Trunk lock     | `trunk-lock`         |                                      |
| Trunk unlock   | `trunk-unlock`       |                                      |
| Hazards on     | `hazard-on`          |                                      |
| Hazards off    | `hazard-off`         |                                      |
| Horn           | `sound-horn`         |                                      |
| Headlights     | `headlight-on`       |                                      |
| Buzzer warning | `buzzer-warning`     | Sends `beepCount` (10 in the app)    |
| Moonroof open  | `sunroof-open`       | Gated on `isMoonRoofCapable`         |
| Moonroof close | `sunroof-close`      | Gated on `isMoonRoofCapable`         |
| Windows open   | `power-window-open`  | Gated on `isPowerWindowCapable`      |
| Windows close  | `power-window-close` | Gated on `isPowerWindowCapable`      |

Each enum entry also carries an on/off `value` (1 for the "on" half of a pair:
start, lock, hazard-on, sunroof-open, window-open; 0 for the other), but that
field is not part of the request body on this plane — only `command`,
`autoFixPopup`, and `beepCount` are sent.

**17MM** uses a different scheme — a shared code plus a numeric `value` that
selects the direction (`SeventeenRemoteCommand`):

| Action                   | `code` | `value` |
| ------------------------ | ------ | ------- |
| Engine start / stop      | `RES`  | 1 / 2   |
| Door lock / unlock       | `DL`   | 1 / 2   |
| Hazard on / off          | `HZ`   | 2 / 2   |

(The hazard pair really does carry `2` for both in the shipped enum — either an
upstream bug or the direction is conveyed elsewhere. Don't rely on it.)

**Not command codes.** Two other string sets look like commands and are not:

- `EStart`, `EStop`, `DLock`, `DUnlock`, `HZOn`, `HZOff`, `buzzer-on` —
  `RemoteCommandStatus`, the `remoteCommandType` values echoed *back* in the
  command-status callback and FCM push. Both spellings exist because the planes
  echo different forms; match against either when tracking a command.
- `RES1` — `RemoteFCMStatus.REMOTE_STATUS_ENGINE_START`, a push notification
  status, alongside `in_progress`, `completed`, `terminated`, `timeout`,
  `interrupted`, `error`, and `popup_required`.

### Auto-fix

`autoFixPopup: true` lets the server clear blocking preconditions itself.
Alongside it the app sends `autoFixCommands` — the remediation commands it
computed from current state — and it only ever contains closing/securing
actions: `door-lock` when the vehicle is unlocked, `power-window-close` when
windows are down and the vehicle is window-capable, `sunroof-close` when the
moonroof is open and the vehicle is moonroof-capable.

Sending `autoFixPopup: false` (what this app does) means preconditions surface
as failures instead of being silently fixed — nothing actuates that you didn't
ask for.

## Command lifecycle

Treat actuation as an async job, and surface these states distinctly — **a
timeout must never be shown as success**:

```
requested → delivered → executing → succeeded | failed | timed out | unknown
```

Guidance for a production client:

- Submit one command with a unique idempotency id; do not silently retry.
- Bind the command to server-verified VIN ownership; never trust a client-supplied VIN.
- Validate preconditions server-side (ignition, gear/park, door/hood, subscription, consent, reachability).
- Apply safety copy to engine start and climate (no remote start in an enclosed space or with a child inside).

## Capability gating

Capabilities are per-VIN and subscription-dependent. Always gate controls on the
current vehicle discovery and climate-settings responses, never on a model name.

## Endpoints in this area

See the [Remote Commands & Climate](./endpoints.md#remote-commands-climate) and
[Vehicle: Status & Health](./endpoints.md#vehicle-status-health) sections of the
endpoint reference for the complete list.
