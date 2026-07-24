# Lexus OneApp — REST endpoint reference

All 285 REST endpoints the OneApp client (3.4.0) is built to call, grouped by function. Unless noted, the host is `onecdn.telematicsct.com` and requests carry the standard headers described in [conventions](./README.md#request-conventions).

## Contents

- [Authentication & Identity](#authentication-identity) (25)
- [Vehicle: Discovery & Association](#vehicle-discovery-association) (18)
- [Vehicle: Specification & Manuals](#vehicle-specification-manuals) (4)
- [Vehicle: Status & Health](#vehicle-status-health) (9)
- [Vehicle: Software (OTA)](#vehicle-software-ota) (13)
- [Remote Commands & Climate](#remote-commands-climate) (23)
- [Charging & EV](#charging-ev) (34)
- [Subscriptions & Billing](#subscriptions-billing) (23)
- [Service, Dealer & Maintenance](#service-dealer-maintenance) (35)
- [Digital Key](#digital-key) (25)
- [Account, Consent & Notifications](#account-consent-notifications) (29)
- [Trips, Media & Preferences](#trips-media-preferences) (17)
- [Dealer/Fuel Locations & Navigation](#dealer-fuel-locations-navigation) (3)
- [Insurance, UBI & Rewards](#insurance-ubi-rewards) (10)
- [Fleet](#fleet) (2)
- [App: Config, Feedback & Misc](#app-config-feedback-misc) (15)


## Authentication & Identity

| Method | Path | Host |
|---|---|---|
| `POST` | `/auth/json/realms/root/realms/oneapp/authenticate` | authcwoneapp.lexusfinancial.com |
| `POST` | `/auth/oauth2/exchange/token` | am.cv000-telematics.net |
| `POST` | `/auth/oauth2/realms/root/realms/oneapp/access_token` | authconsumer.lexusfinancial.com |
| `POST` | `/auth/oauth2/realms/root/realms/oneapp/authorize` | authconsumer.lexusfinancial.com |
| `POST` | `/authenticate` | login.lexusdriverslogin.com |
| `GET` | `/connect/endSession` |  |
| `POST` | `/json/realms/root/realms/tmna-native/authenticate` | login.lexusdriverslogin.com |
| `POST` | `/json/realms/root/realms/{native}/authenticate` | login.lexusdriverslogin.com |
| `POST` | `/json/realms/tmna-native/sessions` | login.lexusdriverslogin.com |
| `POST` | `/json/realms/{native}/authenticate` | login.lexusdriverslogin.com |
| `POST` | `/oa24mm/v1/svc/token` |  |
| `DELETE` | `/oa24mm/v1/svc/token` |  |
| `POST` | `/oactp/v1/digital-key/luktoken` |  |
| `POST` | `/oactp/v1/digital-key/ownertoken` |  |
| `POST` | `/oactp/v1/digital-key/rotatetoken` |  |
| `DELETE` | `/oactp/v1/digital-key/token` |  |
| `POST` | `/oauth2/realms/root/device/user` | login.lexusdriverslogin.com |
| `POST` | `/oauth2/realms/root/realms/tmna-native/access_token` | login.lexusdriverslogin.com |
| `POST` | `/oauth2/realms/root/realms/tmna-native/device/user` | login.lexusdriverslogin.com |
| `PATCH` | `/oneapi/authcode/v1/remote/odo` |  |
| `POST` | `/oneapi/v1/logout` |  |
| `POST` | `/oneapi/v1/notification/apptoken` |  |
| `POST` | `/oneapi/v2/authcode/remote` |  |
| `PATCH` | `/oneapi/v2/authcode/remote` |  |
| `POST` | `/openidm/endpoint/pinService` | openidm.lexusdriverslogin.com |


## Vehicle: Discovery & Association

| Method | Path |
|---|---|
| `PUT` | `/oa24mm/v1/pending/vin` |
| `GET` | `/oa24mm/v1/pending/vins` |
| `POST` | `/oa24mm/v2/vehicle/deregistration/{guid}/{vin}` |
| `GET` | `/oa24mm/v2/vehicle/registrationstatus` |
| `GET` | `/oa24mm/v2/vehicle/restrictions` |
| `POST` | `/oa24mm/v2/vehicle/restrictions` |
| `PUT` | `/oneapi/v1/legacy/oneaccount/vehicles` |
| `GET` | `/oneapi/v1/one/vehicle` |
| `POST` | `/oneapi/v1/preferred/vehicle` |
| `POST` | `/oneapi/v1/vehicle-association/override` |
| `POST` | `/oneapi/v1/vehicle-association/vehicle` |
| `PUT` | `/oneapi/v1/vehicle-association/vehicle` |
| `PUT` | `/oneapi/v1/vehicle-association/vehicle/sold` |
| `GET` | `/oneapi/v1/vehicle/guidvins` |
| `GET` | `/oneapi/v2/one/vehicle` |
| `GET` | `/oneapi/v2/vehicle/guid` |
| `GET` | `/v1/one/vehicle` |
| `DELETE` | `/v1/pending/vin` |


## Vehicle: Specification & Manuals

| Method | Path |
|---|---|
| `GET` | `/oneapi/v1/dashboardlights` |
| `GET` | `/oneapi/v1/vehicle/vehicle-spec` |
| `GET` | `/oneapi/v2/manual/pdf/{documentId}` |
| `GET` | `/oneapi/v2/manuals` |


## Vehicle: Status & Health

| Method | Path |
|---|---|
| `GET` | `/oactp/v1/tire-pressure-preferences` |
| `POST` | `/oactp/v1/tire-pressure-preferences` |
| `GET` | `/oneapi/v1/telemetry/tires/pressure` |
| `GET` | `/oneapi/v1/vdr/history` |
| `GET` | `/oneapi/v1/vehicle-alerts` |
| `GET` | `/oneapi/v1/vehiclehealth/report` |
| `GET` | `/oneapi/v1/vehiclehealth/status` |
| `POST` | `/oneapi/v1/vhr/email` |
| `GET` | `/oneapi/v1/vhr/history` |


## Vehicle: Software (OTA)

| Method | Path | Host |
|---|---|---|
| `GET` | `/oa21mm/v1/ota/notification` |  |
| `POST` | `/oa21mm/v1/ota/update/authorize` |  |
| `GET` | `/oa21mm/v1/ota/update/check` |  |
| `GET` | `/oa24mm/v1/ota/notification` |  |
| `POST` | `/oa24mm/v1/ota/update/authorize` |  |
| `GET` | `/oa24mm/v1/ota/update/check` |  |
| `GET` | `/oa24mm/v1/ota/update/versions` |  |
| `PUT` | `/oneapi/v1/customer/ota` |  |
| `GET` | `/oneapi/v1/ota/update` |  |
| `GET` | `/oneapi/v1/ota/update/check` |  |
| `GET` | `/serviceshop/oneapi/v1/service-shop/oneapp/dealers/toyotaCode/{dealerId}` |  |
| `GET` | `/v1/ota4/swUpdate/availability` |  |
| `POST` | `enrolKeyRotation/{deviceId}` | Digital Key runtime basedevice-api-proxy.prod.digitalkey.toyota.com |


## Remote Commands & Climate

| Method | Path |
|---|---|
| `POST` | `/oneapi/v1/legacy/remote/command` |
| `PUT` | `/oneapi/v1/remote/ng86/profile/curfew` |
| `POST` | `/oneapi/v2/electric/command` |
| `GET` | `/oneapi/v2/legacy/remote/status` |
| `GET` | `/v1/remote/route/ac-reservation` |
| `POST` | `/v1/remote/route/ac-reservation` |
| `PUT` | `/v1/remote/route/ac-reservation` |
| `DELETE` | `/v1/remote/route/ac-reservation` |
| `POST` | `/v1/remote/route/charging` |
| `PUT` | `/v1/remote/route/charging` |
| `DELETE` | `/v1/remote/route/charging/{chargeScheduleId}` |
| `GET` | `/v1/remote/route/climate-settings` |
| `PUT` | `/v1/remote/route/climate-settings` |
| `POST` | `/v1/remote/route/command` |
| `GET` | `/v1/remote/route/engine-status` |
| `GET` | `/v1/remote/route/profile-settings` |
| `POST` | `/v1/remote/route/profile-settings` |
| `PUT` | `/v1/remote/route/profile-settings` |
| `POST` | `/v1/remote/route/refresh-status` |
| `GET` | `/v1/remote/route/status` |
| `POST` | `/v1/remote/route/wake` |
| `PUT` | `/v1/vehicle/remote/cdas/report` |
| `GET` | `/v1/vehicle/remote/cdas/status` |


## Charging & EV

| Method | Path |
|---|---|
| `POST` | `/charging/driver/enrollment` |
| `GET` | `/charging/driver/legal-content` |
| `POST` | `/charging/v2/charger/start` |
| `PUT` | `/charging/v2/charger/stop` |
| `POST` | `/charging/v2/driver/enrollment` |
| `GET` | `/charging/v2/driver/enrollment-check` |
| `POST` | `/charging/v2/driver/enrollment/toggle` |
| `POST` | `/charging/v2/driver/process-status` |
| `GET` | `/charging/v2/driver/program-availability` |
| `POST` | `/charging/v2/driver/unenroll` |
| `GET` | `/charging/v2/ev-education/config` |
| `GET` | `/charging/v2/locations` |
| `POST` | `/charging/v2/pnc/enroll` |
| `GET` | `/charging/v2/pnc/status` |
| `POST` | `/charging/v2/pnc/toggle` |
| `GET` | `/charging/v2/vehicle/charge-history` |
| `GET` | `/charging/v2/vehicle/charge-statistics` |
| `GET` | `/charging/v2/vehicle/eco-schedules` |
| `POST` | `/charging/v2/vehicle/mc-eco-enrollment` |
| `GET` | `/charging/v3/charger/session` |
| `DELETE` | `/oactp/v1/video/drive-recorder/event` |
| `GET` | `/oactp/v1/video/drive-recorder/event/{eventOccurrenceId}/{cameraType}` |
| `GET` | `/oactp/v1/video/drive-recorder/recording` |
| `GET` | `/oactp/v1/video/drive-recorder/recording/count` |
| `GET` | `/oneapi/v1/canbus/trip/events` |
| `POST` | `/oneapi/v1/electric/charging` |
| `PUT` | `/oneapi/v1/electric/charging` |
| `DELETE` | `/oneapi/v1/electric/charging/{scheduleId}` |
| `GET` | `/oneapi/v2/electric/nearest-fuel-stations` |
| `POST` | `/oneapi/v2/electric/realtime-status` |
| `GET` | `/oneapi/v3/canbus/score` |
| `GET` | `/oneapi/v3/canbus/trip` |
| `GET` | `/oneapi/v3/electric/status` |
| `GET` | `/oneapi/{apiVersion}/electric/status` |


## Subscriptions & Billing

| Method | Path | Host |
|---|---|---|
| `POST` | `/digital-self-services/expapi/v7/payments/paymenthub` | apigateway.toyotafinancial.com |
| `GET` | `/oa24mm/v1/svc/subscriptions` |  |
| `POST` | `/oneapi/v1/legacy/oneaccount/calculate-tax` |  |
| `GET` | `/oneapi/v1/payment/config` |  |
| `GET` | `/oneapi/v1/payment/wallet` |  |
| `POST` | `/oneapi/v1/payment/wallet/payment-method` |  |
| `DELETE` | `/oneapi/v1/payment/wallet/payment-method/{paymentMethodId}` |  |
| `POST` | `/oneapi/v1/payment/wallet/payment-method/{paymentMethodId}/default` |  |
| `GET` | `/oneapi/v1/payment/wallet/transactions` |  |
| `POST` | `/oneapi/v1/preview` |  |
| `POST` | `/oneapi/v1/previewrefund` |  |
| `PUT` | `/oneapi/v1/subscription/autorenew` |  |
| `PUT` | `/oneapi/v1/subscription/cancel` |  |
| `PUT` | `/oneapi/v1/subscription/dataconsent` |  |
| `PUT` | `/oneapi/v1/subscription/remoteguid` |  |
| `POST` | `/oneapi/v1/telemetry/product-registration` |  |
| `POST` | `/oneapi/v1/telemetry/product-unregistration` |  |
| `POST` | `/oneapi/v1/vehicle-subscriptions` |  |
| `GET` | `/oneapi/v1/zuora/payments` |  |
| `PUT` | `/oneapi/v1/zuora/payments` |  |
| `PUT` | `/oneapi/v1/zuora/payments/scrub` |  |
| `GET` | `/oneapi/v1/zuora/rsa-signature` |  |
| `GET` | `/oneapi/v3/vehicle-subscriptions` |  |


## Service, Dealer & Maintenance

| Method | Path |
|---|---|
| `GET` | `/oneapi/serviceshop/v2/dealer-service/appointments` |
| `GET` | `/oneapi/serviceshop/v2/dealer-service/{dealerId}/advisors` |
| `POST` | `/oneapi/serviceshop/v2/dealer-service/{dealerId}/appointment` |
| `GET` | `/oneapi/serviceshop/v2/dealer-service/{dealerId}/appointment/slots` |
| `POST` | `/oneapi/serviceshop/v2/dealer-service/{dealerId}/appointment/{appointmentId}` |
| `GET` | `/oneapi/serviceshop/v2/dealer-service/{dealerId}/services` |
| `GET` | `/oneapi/serviceshop/v2/dealer-service/{dealerId}/transportoptions` |
| `GET` | `/oneapi/v1/campaigns` |
| `PATCH` | `/oneapi/v1/campaigns` |
| `GET` | `/oneapi/v1/one/dealers` |
| `GET` | `/oneapi/v1/preferred-dealer` |
| `PUT` | `/oneapi/v1/preferred-dealer` |
| `PUT` | `/oneapi/v1/servicehistory/vehicle` |
| `DELETE` | `/oneapi/v1/servicehistory/vehicle` |
| `POST` | `/oneapi/v1/servicehistory/vehicle/createServiceHistory` |
| `GET` | `/oneapi/v1/servicehistory/vehicle/summary` |
| `GET` | `/oneapi/v1/vehicle/maintenance-schedule` |
| `GET` | `/oneapi/v2/service-campaign` |
| `GET` | `/oneapi/v2/vehicle/maintenance-schedule` |
| `GET` | `/oneapi/v4/dealers/{dealerCode}` |
| `GET` | `/serviceshop/oneapi/scheduler/v1/advisors` |
| `POST` | `/serviceshop/oneapi/scheduler/v1/appointment` |
| `GET` | `/serviceshop/oneapi/scheduler/v1/appointment/{appointmentId}` |
| `PUT` | `/serviceshop/oneapi/scheduler/v1/appointment/{appointmentId}` |
| `DELETE` | `/serviceshop/oneapi/scheduler/v1/appointment/{appointmentId}` |
| `GET` | `/serviceshop/oneapi/scheduler/v1/appointments` |
| `GET` | `/serviceshop/oneapi/scheduler/v1/dealerActivity` |
| `GET` | `/serviceshop/oneapi/scheduler/v1/filters` |
| `GET` | `/serviceshop/oneapi/scheduler/v1/services` |
| `GET` | `/serviceshop/oneapi/scheduler/v1/timeslots` |
| `GET` | `/serviceshop/oneapi/scheduler/v1/timeslots/availability` |
| `GET` | `/serviceshop/oneapi/scheduler/v1/transportations` |
| `GET` | `/serviceshop/oneapi/v1/service-shop/oneapp/dealers` |
| `GET` | `/serviceshop/oneapi/v1/service-shop/oneapp/dealers/map` |
| `GET` | `/serviceshop/oneapi/v1/service-shop/{region}/public/location/autocomplete/{query}` |


## Digital Key

| Method | Path | Host |
|---|---|---|
| `GET` | `/digital-self-services/expapi/v1/accounts/accountSummary` | apigateway.toyotafinancial.com |
| `POST` | `/digital-self-services/expapi/v1/accounts/agreement` | apigateway.toyotafinancial.com |
| `GET` | `/digital-self-services/expapi/v1/profile/accounts/getTimestamp` | apigateway.toyotafinancial.com |
| `POST` | `/oactp/v1/digital-key/gen2/calibration` |  |
| `GET` | `/oactp/v1/digital-key/gen2/keys` |  |
| `DELETE` | `/oactp/v1/digital-key/gen2/keys` |  |
| `DELETE` | `/oactp/v1/digital-key/gen2/keys/{keyId}` |  |
| `GET` | `/oactp/v1/digital-key/gen2/owner/pairing-password` |  |
| `POST` | `/oactp/v1/digital-key/gen2/owner/pairing-password/notification` |  |
| `GET` | `/oactp/v1/digital-key/gen2/status` |  |
| `GET` | `/oactp/v1/digital-key/hsmunlock` |  |
| `POST` | `/oactp/v1/digital-key/hsmunlock` |  |
| `POST` | `/oactp/v1/digital-key/invite` |  |
| `GET` | `/oactp/v1/digital-key/luks` |  |
| `GET` | `/oactp/v1/digital-key/pendinginvite` |  |
| `GET` | `/oactp/v1/digital-key/status` |  |
| `PUT` | `/oactp/v1/digital-key/status` |  |
| `POST` | `/oactp/v1/portal/savekey` |  |
| `POST` | `deactivateKey/{keyInfoId}` | Digital Key runtime basedevice-api-proxy.prod.digitalkey.toyota.com |
| `POST` | `enrolKey/{deviceId}` | Digital Key runtime basedevice-api-proxy.prod.digitalkey.toyota.com |
| `GET` | `getKeyInfo/{keyInfoId}` | Digital Key runtime basedevice-api-proxy.prod.digitalkey.toyota.com |
| `GET` | `listKeyInfo/{deviceId}` | Digital Key runtime basedevice-api-proxy.prod.digitalkey.toyota.com |
| `POST` | `mobile/initialise` | Digital Key runtime basedevice-api-proxy.prod.digitalkey.toyota.com |
| `POST` | `mobile/register` | Digital Key runtime basedevice-api-proxy.prod.digitalkey.toyota.com |
| `POST` | `synchronizeNotifications/{keyInfoId}` | Digital Key runtime basedevice-api-proxy.prod.digitalkey.toyota.com |


## Account, Consent & Notifications

| Method | Path |
|---|---|
| `DELETE` | `/oneapi/v1/account` |
| `GET` | `/oneapi/v1/account/emailsearch` |
| `GET` | `/oneapi/v1/account/personal-info-content` |
| `POST` | `/oneapi/v1/acknowledge/gps` |
| `PUT` | `/oneapi/v1/acknowledge/message` |
| `POST` | `/oneapi/v1/address` |
| `GET` | `/oneapi/v1/address/country/states` |
| `GET` | `/oneapi/v1/consent/account` |
| `POST` | `/oneapi/v1/consent/account` |
| `GET` | `/oneapi/v1/consent/privacySettings` |
| `POST` | `/oneapi/v1/customerconsent` |
| `POST` | `/oneapi/v1/notification/device/status` |
| `POST` | `/oneapi/v1/notification/history/markread` |
| `GET` | `/oneapi/v1/reconsent/eligibility` |
| `GET` | `/oneapi/v1/sms/consent` |
| `GET` | `/oneapi/v1/support/contacts` |
| `GET` | `/oneapi/v2/account/redact/search` |
| `GET` | `/oneapi/v2/marketing/banner` |
| `GET` | `/oneapi/v2/notification-preferences` |
| `PUT` | `/oneapi/v2/notification-preferences` |
| `GET` | `/oneapi/v2/notification/history` |
| `GET` | `/oneapi/v2/ubi/consentmessage/{TIMSOfferId}` |
| `GET` | `/oneapi/v3/account/secondaryUserName` |
| `GET` | `/oneapi/v3/dataconsent` |
| `GET` | `/oneapi/v4/account` |
| `PUT` | `/oneapi/v4/account` |
| `PUT` | `/oneapi/v4/account/verifyUpdate` |
| `PUT` | `/oneapi/v5/account` |
| `POST` | `/pull/v2/notification` |


## Trips, Media & Preferences

| Method | Path |
|---|---|
| `POST` | `/oa24mm/v1/location/share` |
| `GET` | `/oa24mm/v1/svc/getbaseprofile/{guid}` |
| `GET` | `/oa24mm/v1/svc/getprofile/{guid}` |
| `GET` | `/oa24mm/v1/svc/music_preference` |
| `POST` | `/oa24mm/v1/svc/music_preference` |
| `GET` | `/oa24mm/v1/svc/sync/vapreference` |
| `POST` | `/oa24mm/v1/svc/sync/vapreference` |
| `PUT` | `/oa24mm/v1/svc/updateuserprofile/{guid}` |
| `DELETE` | `/oa24mm/v1/trip` |
| `POST` | `/oa24mm/v1/trip/sendtocar` |
| `GET` | `/oa24mm/v1/trips` |
| `GET` | `/oa24mm/v2/profile/picture/{guid}` |
| `POST` | `/oa24mm/v2/profile/picture/{guid}` |
| `DELETE` | `/oa24mm/v2/profile/picture/{guid}` |
| `POST` | `/oneapi/v1/preference/clear-history` |
| `GET` | `/oneapi/v1/radio` |
| `GET` | `/oneapi/v1/videos` |


## Dealer/Fuel Locations & Navigation

| Method | Path | Host |
|---|---|---|
| `GET` | `/directions/json` | maps.googleapis.com |
| `GET` | `/oneapi/v1/ampol/fuelStation` |  |
| `GET` | `/oneapi/v1/ampol/rewards` |  |


## Insurance, UBI & Rewards

| Method | Path |
|---|---|
| `POST` | `/oneapi/v1/irf/grant` |
| `PUT` | `/oneapi/v1/irf/grant` |
| `GET` | `/oneapi/v1/irf/list` |
| `GET` | `/oneapi/v1/irf/search` |
| `GET` | `/oneapi/v1/tpcoNationalUrl` |
| `GET` | `/oneapi/v1/ubi/quote/{TIMSOfferId}/{ZC}` |
| `GET` | `/oneapi/v1/vgi/eligibility` |
| `GET` | `/oneapi/v1/vgi/lcfs/dashboard` |
| `GET` | `/oneapi/v2/ubi/offers` |
| `POST` | `/oneapi/v2/ubi/optdetails` |


## Fleet

| Method | Path |
|---|---|
| `GET` | `/fleet/v2/balance` |
| `GET` | `/fleet/v2/reservations` |


## App: Config, Feedback & Misc

| Method | Path | Host |
|---|---|---|
| `GET` | `/oneapi/v1/banners` |  |
| `POST` | `/oneapi/v1/feedback/survey` |  |
| `GET` | `/oneapi/v1/mobile-utilites/app-details/andriod` |  |
| `GET` | `/oneapi/v1/sds/cancel` |  |
| `GET` | `/oneapi/v1/svl/remoteImmobilizer/passcode` |  |
| `GET` | `/oneapi/v1/wifi/expiration-reminder` |  |
| `PUT` | `/oneapi/v1/wifi/reminder-ack` |  |
| `GET` | `/oneapi/v2/customer/eligibility` |  |
| `GET` | `/oneapi/v2/download/ssa` |  |
| `POST` | `/oneapi/v2/feedback` |  |
| `GET` | `/oneapi/v2/feedback/faqs/app` |  |
| `GET` | `/oneapi/v2/feedback/metadata` |  |
| `GET` | `/oneapi/v2/telemetry` |  |
| `POST` | `compromise` | Digital Key runtime basedevice-api-proxy.prod.digitalkey.toyota.com |
| `GET` | `deviceParameter` | Digital Key runtime basedevice-api-proxy.prod.digitalkey.toyota.com |
