# Subscriptions & connected-services state

How the Lexus OneApp client reads a vehicle's connected-services subscription
state — the "all available services" list (Remote Connect, Safety Connect,
Service Connect, Drive Connect, Wi-Fi Connect) plus the separate SiriusXM / XM
radio card. Recovered from the OneApp 3.4.0 client (a Flutter app; the request
plane lives in the Java/Kotlin Retrofit interfaces inside the APK) and then
**verified against the live production API** with a real 21MM vehicle.

Host is `onecdn.telematicsct.com` and requests carry the standard headers from
[README](./README.md#request-conventions) unless noted. All reads here are
`GET`; the state-changing `PUT`/`POST` calls are documented in
[§ Managing a subscription](#managing-a-subscription) but were **not** exercised
against the live account.

## The endpoints at a glance

| Purpose | Method | Path |
|---|---|---|
| All connected-services subscriptions (primary) | `GET` | `/oneapi/v3/vehicle-subscriptions` |
| SiriusXM / XM radio card | `GET` | `/oneapi/v1/radio` |
| Music/streaming entitlements (head unit) | `GET` | `/oa24mm/v1/svc/subscriptions?userProfileID={guid}` |
| Subscriber / account record | `GET` | `/oneapi/v4/account` |
| Purchasable-offer tax preview | `POST` | `/oneapi/v1/preview` |
| Refund preview (pre-cancel) | `POST` | `/oneapi/v1/previewrefund` |
| Toggle auto-renew | `PUT` | `/oneapi/v1/subscription/autorenew` |
| Cancel | `PUT` | `/oneapi/v1/subscription/cancel` |
| Update data consent | `PUT` | `/oneapi/v1/subscription/dataconsent` |
| Create / waive (purchase) | `POST` | `/oneapi/v1/vehicle-subscriptions` |

---

## GET `/oneapi/v3/vehicle-subscriptions` — the "all services" list

The one call that returns every connected-services subscription for a vehicle,
bucketed into paid / trial / complimentary / available-to-buy, plus the
connectivity/data-consent block.

### Request headers

Beyond the standard business set (`Authorization`, `X-API-KEY`, `X-GUID`,
`X-APPBRAND`, `X-CHANNEL`, `X-LOCALE`, `X-OSNAME`, `X-OSVERSION`, `X-APPVERSION`,
`X-CORRELATIONID`), this call **requires** the following per-vehicle headers.
Omitting them returns `HTTP 400` with an empty body:

| Header | Example | Source |
|---|---|---|
| `VIN` | `JTHGZ1B25T5100335` | discovery |
| `X-BRAND` | `L` | discovery `brand` |
| `GENERATION` | `21MM` | discovery `generation` |
| `REGION` | `US` | discovery `region` |
| `ASI-CODE` | `JG` | discovery `asiCode` |
| `HW-TYPE` | `211` | discovery `hwType` |
| `DATETIME` | `1785311760000` | current epoch millis |
| `entryPoint` | `SUBSCRIPTIONS` | one of `ADDVEHICLE`, `DASHBOARD`, `PRIVACYPORTAL`, `SUBSCRIPTIONS` |

> **On `att-token`.** The APK's `TokenInterceptor` adds an `att-token` header
> (a distinct ForgeRock "limited" access token from `idpHelper.n()`) to this
> path. In practice the **server does not require it for this GET** — the call
> returns `200` with only the standard bearer token, and sending the bearer as
> `att-token` produces an identical response. The earlier `400`s were the
> missing headers above, not a missing `att-token`. (The write calls may still
> validate it; those were not tested.)

No query parameters.

### Response — `payload`

| Field | Type | Notes |
|---|---|---|
| `paidSubscriptions` | `Subscription[]` | active paid services |
| `trialSubscriptions` | `Subscription[]` | trial services |
| `complimentarySubscriptions` | `Subscription[]` | complimentary services |
| `availableSubscriptions` | `AvailableSubscription[]` | purchasable offers/bundles |
| `connectivity` | `object` | data-consent / connectivity block (`status`, `serviceGroups`, `productDetails`, `sosStatus`, `wifiStatus`, `consentOptions`, …) |
| `isPaidEnabled`, `isTrialEligible`, `isBundlingEnabled`, `isCPOEligible`, `isPPOEligible`, `isAppUpdateRequired` | `boolean` | capability/eligibility flags |
| `autoRenewDisclaimer`, `bundlingDisclaimer`, `remoteConnectDisclaimer`, `taxDisclaimer`, `complimentaryDisclaimer` | `string` | HTML disclaimers |

**`Subscription`** (each paid/trial/complimentary item — fields present in a live
21MM trial response):

| Field | Type | Example |
|---|---|---|
| `subscriptionID` | `string` | `JTHGZ1B25T5100335-6991937484` |
| `productName` / `displayProductName` | `string` | `Remote Connect` |
| `productCode` / `productLine` | `string` | `PROD_REMOTEV2` |
| `status` | `string` | `ACTIVE` / `INACTIVE` |
| `type` | `string` | `Trial` / `Paid` |
| `term` | `int` | `36` |
| `termUnit` | `string` | `MTH` |
| `renewable` | `bool` | `false` |
| `subscriptionStartDate` / `subscriptionEndDate` | `string` (`YYYY-MM-DD`) | `2026-04-23` / `2029-04-23` |
| `subscriptionRemainingDays` | `int` | `1000` |
| `subscriptionTerm`, `displayTerm`, `productDescription`, `productLongDesc`, `formattedProductDesc`, `productImageUrl`, `productIconUrl` | `string` | copy/imagery |
| `isExpiringSoon`, `futureCancel`, `hideSubscriptionStatus`, `externalProduct` | `bool` | |
| `consolidatedProductIds`, `consolidatedGoodwillIds` | `string[]` | |
| `dataShared` | `object` | `{ title, description, categories: [{ title, items: string[] }] }` |
| `negativeButtonText` | `string` | |

Paid items additionally carry `productType`, `productID`, `ratePlanID`,
`autoRenew`, `price`, `currency`, `packageID`, `category` (see the recovered
model in `scratchpad/apk/.../SUBSCRIPTION-API-RECOVERED.md`); they are absent on
trial items.

**`AvailableSubscription`** (each purchasable offer): `productName`,
`displayProductName`, `category` (e.g. `BUNDLE`), `description`, `productLongDesc`,
`formattedProductDesc`, `productLine`, `available`, `renewable`, `productImageUrl`,
`productIconUrl`, `components[]`, `dataShared`, and `packages[]`. Each
**package**: `packageID`, `productID`, `productCode`, `ratePlanID`, `price`
(number), `discount`, `currency`, `term`, `termUnit`, `subscriptionTerm`,
`displaySubscriptionTerm`, `type`, `subscriptionStartDate`, `subscriptionEndDate`.

### Live example (2026 IS 350, 21MM) — abridged

```jsonc
{
  "payload": {
    "paidSubscriptions": [],
    "complimentarySubscriptions": [],
    "trialSubscriptions": [
      { "productName": "Safety Connect",  "productCode": "PROD_SAFETYCONNECT", "status": "ACTIVE",   "type": "Trial", "subscriptionEndDate": "2036-04-23" },
      { "productName": "Service Connect", "productCode": "PROD_SERVICECONNECT","status": "ACTIVE",   "type": "Trial", "subscriptionEndDate": "2036-04-23" },
      { "productName": "Drive Connect",   "productCode": "PROD_NAVPKG",        "status": "ACTIVE",   "type": "Trial", "subscriptionEndDate": "2029-04-23" },
      { "productName": "Remote Connect",  "productCode": "PROD_REMOTEV2",      "status": "ACTIVE",   "type": "Trial", "subscriptionEndDate": "2029-04-23" },
      { "productName": "Wi-Fi Connect",   "productCode": "WIFI-CONNECT",       "status": "INACTIVE", "type": "Trial", "subscriptionEndDate": "2026-08-28" }
    ],
    "availableSubscriptions": [
      { "productName": "Go Anywhere", "category": "BUNDLE", "packages": [ { "price": 15.0, "currency": "USD", "termUnit": "MTH", "displaySubscriptionTerm": "Monthly Subscription" } ] },
      { "productName": "Premium",     "category": "BUNDLE" },
      { "productName": "Music Lover", "category": "BUNDLE" }
    ],
    "connectivity": { "status": "ACTIVE", "serviceGroups": ["Trial Services","Services Available in Shop","Paid Services","Complimentary Services"] },
    "isPaidEnabled": true, "isTrialEligible": true, "isBundlingEnabled": true
  }
}
```

### Status vocabulary

`status`: `ACTIVE`, `INACTIVE` (also `PENDING`, `CANCELLED`, `EXPIRED`,
`AVAILABLE` seen in the client). `type`: `Trial`, `Paid`, complimentary. Casing
is mixed across the codebase — **compare case-insensitively.** Treat a service as
usable when `status` is `ACTIVE`.

---

## GET `/oneapi/v1/radio` — SiriusXM / XM radio

SiriusXM is **not** part of the `vehicle-subscriptions` list; it has its own card
endpoint. Extra headers: `vin` and `brand` (lowercase). No query params.

Response `SiriusXmResponse`:

```jsonc
{
  "status": { "messages": [ { "responseCode": "OVRS-0001", "description": "Request Processed Successfully" } ] },
  "vehicleRadio": {
    "radioID": "S73937697645",
    "status": "Inactive",
    "expiredDate": "07/23/2026",
    "cardTitle": "Your SiriusXM® Trial Ended",
    "cardDescription": "Subscribe to SiriusXM® today for $5/month for 12 month.",
    "cardImage": "https://sxm-radio-images.telematicsct.com/SXM_Lexus.png",
    "detailTitle": "Your SiriusXM® Trial Ended",
    "detailDescription": "Your SiriusXM trial subscription ended…",
    "detailImage": "https://sxm-radio-images.telematicsct.com/SXM_Lexus.png",
    "buttonDescription": "Subscribe Now",
    "linkOutUrl": "https://care.siriusxm.com/subscribe/checkout/flepz?programcode=…&RadioID=S73937697645",
    "deepLinkUrl": "https://sxm.app.link/…",
    "deepLinkButtonDesc": "Download the SXM App"
  }
}
```

`vehicleRadio` keys: `radioID`, `status`, `trialEndDate`, `expiredDate`,
`cardTitle`, `cardDescription`, `cardImage`, `detailTitle`, `detailDescription`,
`detailImage`, `buttonDescription`, `deepLinkUrl`, `deepLinkButtonDesc`,
`linkOutUrl`. `status` here is `Active` / `Inactive`.

---

## GET `/oa24mm/v1/svc/subscriptions` — head-unit music entitlements

The list of streaming/music service entitlements provisioned to the head unit
(SiriusXM, Amazon Music, …). Requires query param `userProfileID` (the customer
GUID) — omitting it returns `SVC-0000` "failed user profile id validation". The
`/oa24mm` prefix auto-adds `X-APIVERSION: v1`.

Response: `{ status: {...}, payload: string[] }` — a bare list of entitlement
name/id strings. Empty (`payload: []`) on the test vehicle because SiriusXM is
inactive.

---

## GET `/oneapi/v4/account` — subscriber record

Extra headers: `X-BRAND`, `GUID`. Returns the customer/subscriber block:
`payload.customer` with `guid`, `forgerockId`, `customerType`, `firstName`,
`lastName`, `emails[]`, `phoneNumbers[]`, `accountStatus`, `uiLanguage`,
`preferredLanguage`, `signupType`, `appGen`, timestamps. Used by the billing /
subscriber view.

---

## Managing a subscription

Recovered from the APK but **not** run against the live account (they mutate
billing state). Full request/response models are in the recovered spec under
`scratchpad/apk/lexus-3.4.0/SUBSCRIPTION-API-RECOVERED.md`.

- **`PUT /oneapi/v1/subscription/autorenew`** — body
  `{ vin, subscriberGuid, generation, subscriptions: [{ subscriptionId, autoRenew }] }`;
  headers `X-BRAND`, `DATETIME`.
- **`PUT /oneapi/v1/subscription/cancel`** — body `CancelSubscriptionPlusRequest`
  (`vin`, `subscriberGuid`, `generation`, `subscription.subscriptionIds[]`,
  `canceledReason`, refund fields); headers `X-BRAND`, `GUID`, `DATETIME`, `VIN`,
  and `att-token`. Returns a `refundResponse`.
- **`PUT /oneapi/v1/subscription/dataconsent`** — `UpdateDataConsentRequest`;
  headers `VIN`, `X-BRAND`, `X-REGION`, `X-GENERATION`, `DATETIME`.
- **`POST /oneapi/v1/vehicle-subscriptions`** — create/waive a purchase; body
  `SubscriptionPreviewDetailV2` (echoes the `accessToken` from the GET payload,
  a package/product line item, payment method, consents).
- **`POST /oneapi/v1/preview`** / **`/oneapi/v1/previewrefund`** — tax and refund
  previews (safe reads but require a constructed body; not exercised).

---

## Reproducing the live capture

`src/data/subscription-probe.tsx` (dev-only, removed after this recovery) replayed
these reads from a signed-in dev build using the on-device session and POSTed the
raw responses to a local collector (`scratchpad/collector.py`). The verbatim
captures live in `scratchpad/probe-logs/` (gitignored — they contain the VIN and
account PII). The typed client is `src/data/subscriptions.ts`.
