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

Body: a typed command plus optional auto-fix metadata:

```json
{ "command": "door-unlock", "autoFixPopup": false }
```

The response carries a `returnCode` (`000000` = accepted) — **acceptance, not
completion**. Confirm by polling `GET /v1/remote/route/status` until the closure
state changes and `occurrenceDate` advances.

Other REST command routes: `POST /oneapi/v1/legacy/remote/command`,
`POST /oneapi/v2/electric/command` (EV), `GET|PUT /v1/remote/route/climate-settings`,
and the `/v1/remote/route/ac-reservation` set.

### GraphQL — `SendRemoteCommand(command, autoFixCommands)`

Returns `{ requestNo, correlationId, returnCode }`. Track to completion with the
`ReceiveRemoteCommandStatus(vin)` subscription, whose callback includes
`appRequestNo`, `remoteCommandType`, `command`, `status`, `message`, and
`commandEnded`. Wake first with `SendPreWakeCommand(guid)` when needed.

### Command codes

The `command` value differs by generation (the app keeps parallel enums; suffix
`_1`/`_2` = legacy CY paths, `_17` = 17MM):

| Action              | Legacy value(s)          | 17MM   |
| ------------------- | ------------------------ | ------ |
| Door lock           | `door-lock`, `DLock`     | `DL`   |
| Engine start        | `engine-start`, `EStart` | `RES`  |
| Engine-start status | —                        | `RES1` |

Only lock and engine-start codes were recovered here; unlock, hazard, horn,
trunk, moonroof, and window codes follow the same per-generation pattern and
should be confirmed against the official command schema before use.

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
