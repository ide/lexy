# Vehicle identity & naming

Where the name a client shows for a car comes from, and how to change it. The
name is **account data, not vehicle data**: no telematics unit is involved, the
write is synchronous, and there is nothing to poll afterwards.

## Where the name comes from

Discovery is the source of truth. `GET /oneapi/v2/vehicle/guid` returns one
record per associated vehicle, and the name lives on it as **`nickName`**:

```json
{
  "payload": [
    {
      "vin": "…",
      "modelName": "IS 350 4-DOOR SEDAN",
      "nickName": "2026 IS 350",
      "brand": "L",
      "generation": "21MM"
    }
  ]
}
```

`nickName` is set at registration (the default is model-year + model) and is
freely editable afterwards. It is the string the official app renders in its
vehicle switcher, its garage list, and its header — so a client that renames a
car and then re-reads discovery is guaranteed to agree with the Lexus app.

## Renaming

There are **two rename endpoints**, chosen by telematics generation. Both take
the same body; they differ only in path and in how the request is addressed.

| Generation             | Method | Path                                     |
| ---------------------- | ------ | ---------------------------------------- |
| `17CY`, `PRE17CY`      | `PUT`  | `/oneapi/v1/legacy/oneaccount/vehicles`  |
| everything else (21MM, 17CYPLUS, 24MM…) | `PUT` | `/oneapi/v1/vehicle-association/vehicle` |

The official app picks between them with `VehicleInfo.isCY17()`, which is true
only for the two legacy generation strings above. Route by generation, never by
model or model year.

### Body (both endpoints)

```json
{ "nickName": "Lexy", "guid": "<customer GUID>", "vin": "<VIN>" }
```

`guid` is the **customer** GUID — the same value that rides as `X-GUID`, read
from the ID token's `extension_tmsguid` claim (see
[authentication.md](./authentication.md)). It is *not* the discovery record's
`subscriberGuid`; those match on a single-driver account and diverge on a
shared one.

### Headers — `PUT /oneapi/v1/vehicle-association/vehicle`

The usual business headers (`Authorization`, `X-API-KEY`, `X-GUID`, …) plus:

| Header       | Value                                     |
| ------------ | ----------------------------------------- |
| `X-BRAND`    | the vehicle's brand, e.g. `L`             |
| `DATETIME`   | request time in **epoch milliseconds**    |

Note what is *absent*: this call sends **no `VIN` and no `X-GENERATION` header**,
unlike every other vehicle-scoped request. The VIN travels in the body instead.
`Content-Type: application/json`; the app also sends `Accept-Encoding: deflate`.

### Headers — `PUT /oneapi/v1/legacy/oneaccount/vehicles`

Business headers plus `X-BRAND` and **`VIN`** — the legacy path addresses the
car by header and takes no `DATETIME`.

### Response

The standard business envelope. Confirmed against the live API on a 21MM
vehicle — success is `ORCH-6000`:

```json
{
  "status": {
    "messages": [
      {
        "responseCode": "ORCH-6000",
        "description": "Request Processed Successfully",
        "detailedDescription": "Request Processed Successfully"
      }
    ]
  }
}
```

The official client doesn't inspect `responseCode` at all: it treats **any 2xx
with a non-empty body as success**, and an empty body as failure. Worth knowing
the code anyway, since it's the only thing in the response that carries meaning.

Nothing about the write is asynchronous — unlike a remote command, there is no
request id to follow up on. Re-read discovery to confirm.

## Which capability block to trust

Discovery carries two, and they disagree. On a 2026 IS 350,
`remoteServiceCapabilities` reports `trunkCapable: false`,
`trunkCommandCapable: false`, and `hornCommandCapable: false` for a car whose
trunk and horn both work. `extendedCapabilities` reports
`trunkLockUnlockCapable: true`, `hornCapable: true`, `buzzerCapable: true`.

**Gate on `extendedCapabilities`.** Every accessor in the official app reads it
— `isTrunkLockUnlockCapable`, `isHornCapable`, `isBuzzerCapable`,
`isHazardCapable`, `isLightsCapable`, `isMoonRoofCapable`,
`isPowerWindowCapable` — and none read `remoteServiceCapabilities`.

Two traps in that block:

- It lists only what a car **can** do. A missing key is a "no", not a default.
- `moonroof` and `moonroofCloseCapable` are different flags, and
  `isMoonRoofCapable()` reads the **second**. A car can advertise
  `moonroof: true`, omit `moonroofCloseCapable`, and reject the command — which
  is exactly what this one does.

## Field notes

- **No client-side validation.** The official app's rename screen enables its
  Save button on `nickname.trim().isNotEmpty()` and nothing else: no maximum
  length, no character restrictions, no uniqueness check. Whatever the server
  enforces is not expressed in the client.
- **The app trusts the write.** On success it copies the new name into its
  in-memory `selectedVehicle` and pops the screen; it does not re-read
  discovery. A client that caches discovery should invalidate it instead, which
  is what Lexy does (`src/hooks/use-rename-vehicle.ts`).
- **One name per vehicle, per account.** The rename is scoped by `guid` + `vin`,
  so it changes the name for that customer's association — not a global label on
  the VIN.

## In this repo

`src/data/vehicle-nickname.ts` implements the modern path only, for the same
reason `remote-command.ts` implements four of the sixteen command codes: it is
the one this app's vehicle (21MM) uses. The legacy path is documented above but
not coded.
