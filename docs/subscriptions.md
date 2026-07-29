# Subscriptions & connected-services state

How the Lexus OneApp client reads a vehicle's connected-services subscription
state: the "all services" list (Remote Connect, Safety Connect, Service Connect,
Drive Connect, Wi-Fi Connect) and the separate SiriusXM / XM radio card.

Source: the OneApp 3.4.0 client (a Flutter app whose request plane lives in the
Java/Kotlin Retrofit interfaces inside the APK). The `GET` reads on this page are
confirmed against the live production API on a 21MM vehicle. The state-changing
`PUT`/`POST` calls in [§ Managing a subscription](#managing-a-subscription) are
documented from the client only; they mutate billing state and are not confirmed
against a live account.

Host is `onecdn.telematicsct.com`, and requests carry the standard headers from
[README](./README.md#request-conventions) unless noted.

### Where request values come from

Every non-constant value on this page comes from one of three sources:

| Source | Provides | Obtained from |
|---|---|---|
| **Session tokens** | `Authorization` bearer, customer GUID | The OAuth token exchange at sign-in. The customer GUID is the `extension_tmsguid` claim decoded from the ID token (the same value sent as the `X-GUID` header). See [authentication.md](./authentication.md#per-request-context). |
| **Discovery record** | Per-vehicle `VIN`, `brand`, `generation`, `region`, `asiCode`, `hwType` | `GET /oneapi/v2/vehicle/guid`, the per-vehicle discovery call. Each header below names the discovery field it maps to. |
| **The client** | `DATETIME`, `X-CORRELATIONID`, `entryPoint` | Generated per request (current time, a fresh UUID, the originating screen). |

Response payloads are server-generated. Where one call's response feeds another
call's request (for example the `accessToken` echoed into a purchase), the field
notes say so.

> **Placeholders.** Every VIN, radio ID, and subscription ID in the examples
> below is a masked placeholder (for example `JTHXXXXXXXXXXXXXX`), not a real
> value. Substitute the vehicle's actual discovery values at call time.

## Endpoints at a glance

| Purpose | Method | Path |
|---|---|---|
| All connected-services subscriptions (primary) | `GET` | `/oneapi/v3/vehicle-subscriptions` |
| SiriusXM / XM radio card | `GET` | `/oneapi/v1/radio` |
| Music / streaming entitlements (head unit) | `GET` | `/oa24mm/v1/svc/subscriptions?userProfileID={guid}` |
| Subscriber / account record | `GET` | `/oneapi/v4/account` |
| Purchasable-offer tax preview | `POST` | `/oneapi/v1/preview` |
| Refund preview (pre-cancel) | `POST` | `/oneapi/v1/previewrefund` |
| Toggle auto-renew | `PUT` | `/oneapi/v1/subscription/autorenew` |
| Cancel | `PUT` | `/oneapi/v1/subscription/cancel` |
| Update data consent | `PUT` | `/oneapi/v1/subscription/dataconsent` |
| Create / waive (purchase) | `POST` | `/oneapi/v1/vehicle-subscriptions` |

---

## GET `/oneapi/v3/vehicle-subscriptions` — the "all services" list

The single call that returns every connected-services subscription for a
vehicle. The response buckets subscriptions into paid, trial, complimentary, and
available-to-buy, and includes the connectivity / data-consent block.

### Request headers

Beyond the standard business set (`Authorization`, `X-API-KEY`, `X-GUID`,
`X-APPBRAND`, `X-CHANNEL`, `X-LOCALE`, `X-OSNAME`, `X-OSVERSION`, `X-APPVERSION`,
`X-CORRELATIONID`), this call **requires** the per-vehicle headers below. Each
value comes from the vehicle's discovery record. Omitting any of them returns
`HTTP 400` with an empty body.

| Header | Example | Source |
|---|---|---|
| `VIN` | `JTHXXXXXXXXXXXXXX` | discovery |
| `X-BRAND` | `L` | discovery `brand` |
| `GENERATION` | `21MM` | discovery `generation` |
| `REGION` | `US` | discovery `region` |
| `ASI-CODE` | `JG` | discovery `asiCode` |
| `HW-TYPE` | `211` | discovery `hwType` |
| `DATETIME` | `1785311760000` | current epoch milliseconds |
| `entryPoint` | `SUBSCRIPTIONS` | one of `ADDVEHICLE`, `DASHBOARD`, `PRIVACYPORTAL`, `SUBSCRIPTIONS` |

This call takes no query parameters.

#### The `att-token` header

The client's `TokenInterceptor` attaches an `att-token` header — a separate
ForgeRock limited-scope access token — to this path. The server does not require
it for this `GET`: the standard bearer token alone returns `200`, and sending the
bearer as `att-token` returns an identical response. The write calls in
[§ Managing a subscription](#managing-a-subscription) may still validate it.

### Response — `payload`

| Field | Type | Notes |
|---|---|---|
| `paidSubscriptions` | `Subscription[]` | active paid services |
| `trialSubscriptions` | `Subscription[]` | trial services |
| `complimentarySubscriptions` | `Subscription[]` | complimentary services |
| `availableSubscriptions` | `AvailableSubscription[]` | purchasable offers / bundles |
| `connectivity` | `object` | data-consent / connectivity block (`status`, `serviceGroups`, `productDetails`, `sosStatus`, `wifiStatus`, `consentOptions`, …) |
| `isPaidEnabled`, `isTrialEligible`, `isBundlingEnabled`, `isCPOEligible`, `isPPOEligible`, `isAppUpdateRequired` | `boolean` | capability / eligibility flags |
| `autoRenewDisclaimer`, `bundlingDisclaimer`, `remoteConnectDisclaimer`, `taxDisclaimer`, `complimentaryDisclaimer` | `string` | HTML disclaimers |

**`Subscription`** — one paid, trial, or complimentary item. The fields below
are present on every item:

| Field | Type | Example |
|---|---|---|
| `subscriptionID` | `string` | `JTHXXXXXXXXXXXXXX-XXXXXXXXXX` (VIN, then a per-subscription id) |
| `productName` / `displayProductName` | `string` | `Remote Connect` |
| `productCode` / `productLine` | `string` | `PROD_REMOTEV2` |
| `status` | `string` | `ACTIVE` / `INACTIVE` |
| `type` | `string` | `Trial` / `Paid` |
| `term` | `int` | `36` |
| `termUnit` | `string` | `MTH` |
| `renewable` | `bool` | `false` |
| `subscriptionStartDate` / `subscriptionEndDate` | `string` (`YYYY-MM-DD`) | `2026-04-23` / `2029-04-23` |
| `subscriptionRemainingDays` | `int` | `1000` |
| `subscriptionTerm`, `displayTerm`, `productDescription`, `productLongDesc`, `formattedProductDesc`, `productImageUrl`, `productIconUrl` | `string` | copy / imagery |
| `isExpiringSoon`, `futureCancel`, `hideSubscriptionStatus`, `externalProduct` | `bool` | |
| `consolidatedProductIds`, `consolidatedGoodwillIds` | `string[]` | |
| `dataShared` | `object` | `{ title, description, categories: [{ title, items: string[] }] }` |
| `negativeButtonText` | `string` | |

Paid items additionally carry `productType`, `productID`, `ratePlanID`,
`autoRenew`, `price`, `currency`, `packageID`, and `category`. These billing
fields are absent on trial items.

**`AvailableSubscription`** — one purchasable offer. Fields: `productName`,
`displayProductName`, `category` (for example `BUNDLE`), `description`,
`productLongDesc`, `formattedProductDesc`, `productLine`, `available`,
`renewable`, `productImageUrl`, `productIconUrl`, `components[]`, `dataShared`,
and `packages[]`.

Each entry in `packages[]` describes one purchasable term: `packageID`,
`productID`, `productCode`, `ratePlanID`, `price` (number), `discount`,
`currency`, `term`, `termUnit`, `subscriptionTerm`, `displaySubscriptionTerm`,
`type`, `subscriptionStartDate`, `subscriptionEndDate`.

### Live example (21MM vehicle, abridged)

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

`status` takes `ACTIVE` or `INACTIVE` here; the client also handles `PENDING`,
`CANCELLED`, `EXPIRED`, and `AVAILABLE`. `type` takes `Trial`, `Paid`, or
complimentary. Casing is inconsistent across the API, so **compare
case-insensitively.** Treat a service as usable only when `status` is `ACTIVE`.

---

## GET `/oneapi/v1/radio` — SiriusXM / XM radio

SiriusXM is not part of the `vehicle-subscriptions` list; it has its own card
endpoint. This call adds two lowercase per-vehicle headers, `vin` and `brand`
(both from the discovery record), and takes no query parameters.

The response is a `SiriusXmResponse`:

```jsonc
{
  "status": { "messages": [ { "responseCode": "OVRS-0001", "description": "Request Processed Successfully" } ] },
  "vehicleRadio": {
    "radioID": "SXXXXXXXXXXX",
    "status": "Inactive",
    "expiredDate": "07/23/2026",
    "cardTitle": "Your SiriusXM® Trial Ended",
    "cardDescription": "Subscribe to SiriusXM® today for $5/month for 12 month.",
    "cardImage": "https://sxm-radio-images.telematicsct.com/SXM_Lexus.png",
    "detailTitle": "Your SiriusXM® Trial Ended",
    "detailDescription": "Your SiriusXM trial subscription ended…",
    "detailImage": "https://sxm-radio-images.telematicsct.com/SXM_Lexus.png",
    "buttonDescription": "Subscribe Now",
    "linkOutUrl": "https://care.siriusxm.com/subscribe/checkout/flepz?programcode=…&RadioID=SXXXXXXXXXXX",
    "deepLinkUrl": "https://sxm.app.link/…",
    "deepLinkButtonDesc": "Download the SXM App"
  }
}
```

The `vehicleRadio` object carries `radioID`, `status`, `trialEndDate`,
`expiredDate`, `cardTitle`, `cardDescription`, `cardImage`, `detailTitle`,
`detailDescription`, `detailImage`, `buttonDescription`, `deepLinkUrl`,
`deepLinkButtonDesc`, and `linkOutUrl`. Here `status` is `Active` or `Inactive`.

---

## GET `/oa24mm/v1/svc/subscriptions` — head-unit music entitlements

The list of streaming / music entitlements provisioned to the vehicle's head unit
(for example SiriusXM or Amazon Music). This is separate from the two calls
above: it reflects what the head unit itself can play, not the account's
connected-services subscriptions.

This call requires the query parameter `userProfileID`, set to the customer GUID
(the `extension_tmsguid` claim from the ID token — the same value used for
`X-GUID`). Omitting it returns `SVC-0000` ("failed user profile id validation").
The `/oa24mm` prefix automatically adds the header `X-APIVERSION: v1`.

The response is `{ status: {...}, payload: string[] }` — a bare list of
entitlement name/id strings. On a vehicle with no active head-unit entitlements
(for example, when SiriusXM is inactive) `payload` is an empty array.

---

## GET `/oneapi/v4/account` — subscriber record

The customer / subscriber record backing the billing and subscriber views. This
call adds the headers `X-BRAND` (per-vehicle brand from discovery) and `GUID`
(the customer GUID from the ID token).

The response `payload.customer` object carries:

- **Identity:** `guid`, `forgerockId`, `customerType`.
- **Name and contact:** `firstName`, `lastName`, `emails[]`, `phoneNumbers[]`.
- **Account:** `accountStatus`, `signupType`, `appGen`, and create/update
  timestamps.
- **Locale:** `uiLanguage`, `preferredLanguage`.

---

## Managing a subscription

The calls below are documented from the client but are **not** confirmed against
a live account, because they mutate billing state. Treat the request shapes as
recovered contracts, not verified behavior. In every body, `vin` is the
discovery VIN, `subscriberGuid` is the customer GUID from the ID token,
`generation` is the discovery generation, and `subscriptionId` values come from
the `GET /oneapi/v3/vehicle-subscriptions` response.

- **`PUT /oneapi/v1/subscription/autorenew`** — toggle auto-renew. Body
  `{ vin, subscriberGuid, generation, subscriptions: [{ subscriptionId, autoRenew }] }`;
  extra headers `X-BRAND` (discovery brand), `DATETIME` (client epoch millis).
- **`PUT /oneapi/v1/subscription/cancel`** — cancel one or more subscriptions.
  Body `CancelSubscriptionPlusRequest` (`vin`, `subscriberGuid`, `generation`,
  `subscription.subscriptionIds[]`, `canceledReason`, and refund fields); extra
  headers `X-BRAND`, `GUID` (customer GUID), `DATETIME`, `VIN`, and `att-token`.
  Returns a `refundResponse`.
- **`PUT /oneapi/v1/subscription/dataconsent`** — update data consent. Body
  `UpdateDataConsentRequest`; extra headers `VIN`, `X-BRAND`, `X-REGION` and
  `X-GENERATION` (discovery region / generation), `DATETIME`.
- **`POST /oneapi/v1/vehicle-subscriptions`** — create or waive a purchase. Body
  `SubscriptionPreviewDetailV2`, which echoes the `accessToken` returned in the
  `GET /oneapi/v3/vehicle-subscriptions` payload, plus a package / product line
  item, a payment method, and consents.
- **`POST /oneapi/v1/preview`** and **`POST /oneapi/v1/previewrefund`** — tax and
  refund previews. These are reads, but each requires a constructed request body.
