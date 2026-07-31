# Lexus OneApp API

Reference for the API surface of the Lexus OneApp client (`com.lexus.oneapp`,
version 3.4.0) — the endpoints, request conventions, login flow, and vehicle
status/command model. Scoped to the North American Lexus app; most of it is
shared Toyota/Lexus telematics infrastructure.

## Documents

| Doc                                                              | What's in it                                                                                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [endpoints.md](./endpoints.md)                                   | All 285 REST endpoints, grouped by function                                                                                   |
| [authentication.md](./authentication.md)                         | Identity provider, OAuth + PKCE, tokens, PIN, session headers                                                                 |
| [vehicle-status-and-control.md](./vehicle-status-and-control.md) | Vehicle status model (REST + GraphQL), remote commands, command codes, climate, capability matrix                             |
| [subscriptions.md](./subscriptions.md)                           | Connected-services subscription state — the all-services list, SiriusXM/XM radio, music entitlements, and manage/cancel calls |

Source data (machine-readable) lives in the `data/` folder:
`lexus-3.4.0-rest-endpoints.csv`, `lexus-3.4.0-graphql-operations.csv`,
`lexus-3.4.0-graphql-operations.graphql`.

## Hosts

| Host                                                               | Role                                                                                                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onecdn.telematicsct.com`                                          | Primary REST API — vehicle, remote control, status, subscriptions, charging, service, account, notifications, OTA, digital-key orchestration. Default host for every endpoint unless noted. |
| `oa-api.telematicsct.com/graphql`                                  | GraphQL — vehicle-state queries and remote commands (24MM generation)                                                                                                                       |
| `oa-api.telematicsct.com/graphql/realtime` (`wss://`)              | GraphQL subscriptions — live status and command-status streams                                                                                                                              |
| `login.lexusdriverslogin.com`                                      | Identity: sign-in, sign-up, password reset, token issuance                                                                                                                                  |
| `openidm.lexusdriverslogin.com`                                    | PIN service / identity management                                                                                                                                                           |
| `device-api-proxy.prod.digitalkey.toyota.com`                      | Digital Key device runtime API                                                                                                                                                              |
| `apigateway.lexusfinancial.com` / `apigateway.toyotafinancial.com` | Financial services                                                                                                                                                                          |
| `am.cv000-telematics.net`                                          | SiriusXM token exchange                                                                                                                                                                     |
| `maps.googleapis.com`                                              | Google Directions                                                                                                                                                                           |

## Telematics generations

The app talks to a vehicle through one of several telematics generations, and the
route prefix usually signals which backend a call targets. A vehicle's generation
comes from its discovery record (`X-GENERATION`).

| Prefix                   | Generation / role                                                           |
| ------------------------ | --------------------------------------------------------------------------- |
| `/oneapi/*`              | Cross-generation app services (account, subscriptions, service, most reads) |
| `/v1/remote/route/*`     | Remote status + commands, REST command plane used by 21MM vehicles          |
| `/oa21mm/*`, `/oa24mm/*` | Generation-specific services (21MM / 24MM)                                  |
| `/oactp/*`               | Connected-tech platform: Digital Key, drive recorder, tire preferences      |
| `/charging/*`            | EV charging                                                                 |
| GraphQL                  | 24MM command + status plane (see the control doc)                           |

The discovery response determines which command plane to use. Route by the
vehicle's generation rather than its model name.

## Request conventions

**Headers.** Authenticated business requests carry a bearer token plus context
headers:

| Header                                    | Value                                 |
| ----------------------------------------- | ------------------------------------- |
| `Authorization`                           | `Bearer <access token>`               |
| `X-API-KEY`                               | app API key                           |
| `X-GUID`                                  | customer GUID (from the ID token)     |
| `X-APPBRAND`                              | `L` (Lexus)                           |
| `X-BRAND`, `X-GENERATION`                 | per-vehicle, for vehicle-scoped calls |
| `VIN`                                     | per-vehicle, for vehicle-scoped calls |
| `X-CHANNEL`                               | `ONEAPP`                              |
| `X-APPVERSION`, `X-OSNAME`, `X-OSVERSION` | client build/platform                 |
| `X-LOCALE`                                | e.g. `en-US`                          |
| `X-CORRELATIONID`                         | unique per request                    |

**Versioning.** Paths are explicitly versioned (`/oneapi/v1…v5`, `/oa24mm/v1|v2`,
`/charging/v2|v3`). Multiple versions of the same resource often coexist; the app
picks one by feature flag and generation.

**Path templates.** Braces (`{guid}`, `{vin}`, `{dealerId}`, `{appointmentId}`,
`{keyId}`, …) are templates filled at call time, not literal paths.

**Response envelope.** Business responses wrap data in a `payload` object with a
`status.messages[]` block carrying a `responseCode` (and `description`). A
`responseCode` of `000000` / `ONE-*-10000`-style success codes indicate success;
callers check that rather than relying on HTTP status alone.

**Remote commands are asynchronous.** Submitting a command returns a
request/correlation id, not a final result. Completion arrives via a follow-up
status read or a realtime subscription. A timeout is not a success. See
[vehicle-status-and-control.md](./vehicle-status-and-control.md).

## Authentication in one line

Sign in through the hosted Lexus identity service (ForgeRock, realm
`tmna-native`) with OAuth Authorization Code + PKCE, exchange for access / refresh
/ ID tokens, and attach the bearer token to every business call. Full detail in
[authentication.md](./authentication.md).
