# Authentication & identity

The OneApp signs customers in through Lexus' hosted identity service and attaches
the resulting bearer token to every business API call.

## Identity provider

- Authorization host: `https://login.lexusdriverslogin.com/`
- Identity management (PIN, profile): `https://openidm.lexusdriverslogin.com/`
- Platform: ForgeRock
- Realm: `tmna-native`
- Scopes: OpenID + profile access

Separate identity trees exist for sign-in, sign-up, password reset, and phone
update.

## Sign-in flow

Sign-in answers ForgeRock's authentication tree from the app's own screens, then
completes OAuth's Authorization Code flow with PKCE
([RFC 7636](https://www.rfc-editor.org/rfc/rfc7636)) using the session the tree
issued:

```text
app ──► POST /json/realms/root/realms/tmna-native/authenticate
        (authIndexValue=signin_2.0): email, password, delivery method, code
     ◄── SSO token (`tokenId`)
app ──► POST /oauth2/realms/root/realms/tmna-native/authorize
        SSO token as the iPlanetDirectoryPro header and `csrf`, decision=allow,
        PKCE challenge, redirect_uri=com.toyota.oneapp:/oauth2Callback
     ◄── 302 to the redirect URI with the authorization code
app ──► POST …/access_token (grant_type=authorization_code, PKCE verifier)
     ◄── access token + refresh token + ID token + expiry
```

Each tree step is a node of callbacks (`NameCallback`, `PasswordCallback`,
`ChoiceCallback` for the delivery method, then the code, which Lexus sends as a
`TextInputCallback` or a `PasswordCallback`); the app fills the active
callback's input and posts the node back. The tree keeps server affinity with a
cookie, so a sign-in sends its later steps with the cookies its first step set.

- The **ID token** carries the customer GUID (`extension_tmsguid`), used as the
  `X-GUID` header and in GUID-scoped paths.
- The **access token** is sent as `Authorization: Bearer <token>` on business
  calls.
- The **refresh token** obtains a new access token when it expires. Each
  refresh returns a new refresh token and spends the one sent, so a client
  keeps the newest; a refresh whose reply is lost leaves the client holding a
  spent token, and the next refresh fails.

## Token endpoints

| Method | Path                                                  | Host                        | Role                     |
| ------ | ----------------------------------------------------- | --------------------------- | ------------------------ |
| `POST` | `/oauth2/realms/root/realms/tmna-native/access_token` | login.lexusdriverslogin.com | Token issuance / refresh |
| `POST` | `/json/realms/root/realms/tmna-native/authenticate`   | login.lexusdriverslogin.com | Authentication tree      |
| `POST` | `/json/realms/tmna-native/sessions`                   | login.lexusdriverslogin.com | Session                  |
| `POST` | `/oauth2/realms/root/realms/tmna-native/device/user`  | login.lexusdriverslogin.com | Device/user binding      |
| `GET`  | `/connect/endSession`                                 | onecdn.telematicsct.com     | Logout / end session     |
| `POST` | `/oneapi/v1/logout`                                   | onecdn.telematicsct.com     | App logout               |
| `POST` | `/oneapi/v1/notification/apptoken`                    | onecdn.telematicsct.com     | Register push token      |

Refreshing an access token (form-encoded):

```
POST https://login.lexusdriverslogin.com/oauth2/realms/root/realms/tmna-native/access_token
grant_type=refresh_token
client_id=oneappsdkclient
refresh_token=<refresh token>
```

The response includes a new `access_token`, `id_token` and `refresh_token`, and
the refresh token sent is spent.

## PIN service

A separate PIN service (`openidm.lexusdriverslogin.com`, `POST
/openidm/endpoint/pinService`) supports PIN registration and verification. Whether
a given remote command requires a PIN step-up is a backend policy detail, not
fixed in the client.

## Per-request context

After sign-in, every business request to `onecdn.telematicsct.com` carries the
bearer token and context headers. These are the headers Lexy sends
(`src/data/lexus-api.ts`), with their production values. Lexy's Expo, Exact and
SwiftUI apps report themselves as the OneApp's iOS client on every platform.

### Base headers (every authenticated call)

| Header              | Value                                      | Notes                                                                                                                                            |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Authorization`     | `Bearer <access token>`                    | Per-user; from the token exchange/refresh.                                                                                                       |
| `X-API-KEY`         | `pypIHG015k4ABHWbcI4G0a94F7cC0JDo1OynpAsG` | **App-wide, public client key** — the same value ships in the OneApp store binary for all users. Identifies the app, not the user. Not a secret. |
| `X-GUID`            | `<extension_tmsguid>`                      | Per-user customer GUID, decoded from the ID token.                                                                                               |
| `X-APPBRAND`        | `L`                                        | `L` = Lexus (Toyota uses `T`).                                                                                                                   |
| `X-CHANNEL`         | `ONEAPP`                                   |                                                                                                                                                  |
| `X-LOCALE`          | `en-US`                                    |                                                                                                                                                  |
| `X-OSNAME`          | `iOS`                                      | Reported client platform.                                                                                                                        |
| `X-OSVERSION`       | `18.5`                                     | Reported iOS version.                                                                                                                            |
| `X-APPVERSION`      | `3.4.0`                                    | Mirrors the shipped OneApp client version.                                                                                                       |
| `X-DEVICE-TIMEZONE` | `PST`                                      |                                                                                                                                                  |
| `X-CORRELATIONID`   | `<uuid v4>`                                | Unique per request.                                                                                                                              |
| `Content-Type`      | `application/json`                         |                                                                                                                                                  |
| `Accept`            | `application/json`                         |                                                                                                                                                  |

The gateway validates the `X-API-KEY` and bearer token; the `X-OSNAME` /
`X-OSVERSION` / `X-APPVERSION` fields are client-reported context and are accepted
as `iOS` (verified: discovery returns `200` with the iOS values above).

### Vehicle-scoped headers (status, commands, per-VIN reads)

Added on top of the base headers, sourced from the discovery record
(`GET /oneapi/v2/vehicle/guid`):

| Header         | Value       | Notes                                                                                         |
| -------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `VIN`          | `<vin>`     | The customer's vehicle. Never client-supplied for writes — bind to server-verified ownership. |
| `X-GENERATION` | e.g. `21MM` | Telematics generation; selects the REST vs GraphQL command plane.                             |
| `X-BRAND`      | e.g. `L`    | Per-vehicle brand from discovery.                                                             |

## Other identity surfaces

The financial-services and SiriusXM features use their own OAuth realms
(`authconsumer.lexusfinancial.com`, `am.cv000-telematics.net`); Digital Key uses
its own token set (`/oactp/v1/digital-key/{owner,luk,rotate}token`). These are
independent of the main app session — see [endpoints.md](./endpoints.md).
