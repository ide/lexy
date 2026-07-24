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

The app uses OAuth **Authorization Code + PKCE** through the platform browser /
authentication session — the password is entered on the hosted Lexus page, not in
app UI.

```text
app ──► hosted Lexus sign-in (login.lexusdriverslogin.com)
        password, then phone OTP / MFA
     ◄── authorization code (to app redirect)
app ──► token exchange (PKCE verifier)
     ◄── access token + refresh token + ID token + expiry
```

- The **ID token** carries the customer GUID (`extension_tmsguid`), used as the
  `X-GUID` header and in GUID-scoped paths.
- The **access token** is sent as `Authorization: Bearer <token>` on business
  calls.
- The **refresh token** obtains a new access token when it expires; refresh-token
  rotation applies.

## Token endpoints

| Method | Path | Host | Role |
|---|---|---|---|
| `POST` | `/oauth2/realms/root/realms/tmna-native/access_token` | login.lexusdriverslogin.com | Token issuance / refresh |
| `POST` | `/json/realms/root/realms/tmna-native/authenticate` | login.lexusdriverslogin.com | Authentication tree |
| `POST` | `/json/realms/tmna-native/sessions` | login.lexusdriverslogin.com | Session |
| `POST` | `/oauth2/realms/root/realms/tmna-native/device/user` | login.lexusdriverslogin.com | Device/user binding |
| `GET` | `/connect/endSession` | onecdn.telematicsct.com | Logout / end session |
| `POST` | `/oneapi/v1/logout` | onecdn.telematicsct.com | App logout |
| `POST` | `/oneapi/v1/notification/apptoken` | onecdn.telematicsct.com | Register push token |

Refreshing an access token (form-encoded):

```
POST https://login.lexusdriverslogin.com/oauth2/realms/root/realms/tmna-native/access_token
grant_type=refresh_token
client_id=oneappsdkclient
refresh_token=<refresh token>
```

The response includes a new `access_token` and `id_token` (and may rotate the
`refresh_token`).

## PIN service

A separate PIN service (`openidm.lexusdriverslogin.com`, `POST
/openidm/endpoint/pinService`) supports PIN registration and verification. Whether
a given remote command requires a PIN step-up is a backend policy detail, not
fixed in the client.

## Per-request context

After sign-in, business requests carry the bearer token plus the context headers
listed in [README → request conventions](./README.md#request-conventions):
`X-API-KEY`, `X-GUID`, `X-APPBRAND` (`L`), `X-CHANNEL` (`ONEAPP`), locale, client
build, a unique `X-CORRELATIONID`, and — for vehicle-scoped calls — `VIN`,
`X-BRAND`, and `X-GENERATION`.

## Other identity surfaces

The financial-services and SiriusXM features use their own OAuth realms
(`authconsumer.lexusfinancial.com`, `am.cv000-telematics.net`); Digital Key uses
its own token set (`/oactp/v1/digital-key/{owner,luk,rotate}token`). These are
independent of the main app session — see [endpoints.md](./endpoints.md).
