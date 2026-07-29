import type { LexusSession, RequestLike } from '@/auth/lexus-auth';
import {
  LEXUS_HOSTS,
  businessHeaders,
  guidFromIdToken,
  type VehicleContext,
} from './lexus-api';

// Connected-services subscription state for a vehicle: the "all services" list
// (Remote/Safety/Service/Drive/Wi-Fi Connect) and the separate SiriusXM radio
// card. Endpoints, headers, and response shapes recovered from the OneApp 3.4.0
// client and verified against the live 21MM API. See docs/subscriptions.md.

export const SUBSCRIPTIONS_ENDPOINT = `${LEXUS_HOSTS.rest}/oneapi/v3/vehicle-subscriptions`;
export const SIRIUSXM_RADIO_ENDPOINT = `${LEXUS_HOSTS.rest}/oneapi/v1/radio`;
export const MUSIC_ENTITLEMENTS_ENDPOINT = `${LEXUS_HOSTS.rest}/oa24mm/v1/svc/subscriptions`;

// The v3 list needs more per-vehicle context than a plain vehicle-scoped call:
// region, the ASI (dealer/market) code, and the head-unit hardware type. These
// come from the same discovery record as vin/brand/generation.
export type SubscriptionVehicle = VehicleContext & {
  region: string;
  asiCode: string;
  hwType: string;
};

// Where in the app the request originates. The server accepts any of these; the
// subscriptions screen uses SUBSCRIPTIONS.
export type SubscriptionEntryPoint =
  | 'ADDVEHICLE'
  | 'DASHBOARD'
  | 'PRIVACYPORTAL'
  | 'SUBSCRIPTIONS';

export type Subscription = {
  subscriptionID?: string;
  productName?: string;
  displayProductName?: string;
  productCode?: string;
  productLine?: string;
  status?: string;
  type?: string;
  term?: number;
  termUnit?: string;
  renewable?: boolean;
  autoRenew?: boolean;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  subscriptionRemainingDays?: number;
  isExpiringSoon?: boolean;
};

export type SubscriptionPackage = {
  packageID?: string;
  productCode?: string;
  ratePlanID?: string;
  price?: number;
  discount?: number;
  currency?: string;
  term?: number;
  termUnit?: string;
  displaySubscriptionTerm?: string;
};

export type AvailableSubscription = {
  productName?: string;
  displayProductName?: string;
  category?: string;
  available?: boolean;
  renewable?: boolean;
  packages?: SubscriptionPackage[];
};

export type VehicleSubscriptionsPayload = {
  paidSubscriptions?: Subscription[];
  trialSubscriptions?: Subscription[];
  complimentarySubscriptions?: Subscription[];
  availableSubscriptions?: AvailableSubscription[];
  connectivity?: { status?: string; serviceGroups?: string[] } & Record<string, unknown>;
  isPaidEnabled?: boolean;
  isTrialEligible?: boolean;
  isBundlingEnabled?: boolean;
};

export type SiriusXmRadio = {
  radioID?: string;
  status?: string;
  trialEndDate?: string;
  expiredDate?: string;
  cardTitle?: string;
  cardDescription?: string;
  detailTitle?: string;
  detailDescription?: string;
  linkOutUrl?: string;
  deepLinkUrl?: string;
};

// A flattened, source-agnostic view of one service's current state.
export type ServiceState = {
  name: string;
  productCode?: string;
  status: string;
  bucket: 'paid' | 'trial' | 'complimentary';
  active: boolean;
  endDate?: string;
};

// A subscription is usable when the server reports it ACTIVE (casing varies).
export function isActiveStatus(status: string | undefined): boolean {
  return (status ?? '').trim().toUpperCase() === 'ACTIVE';
}

// Collapse the paid/trial/complimentary buckets into one normalized list of the
// vehicle's current connected-services states.
export function summarizeSubscriptions(payload: VehicleSubscriptionsPayload): ServiceState[] {
  const buckets: [keyof VehicleSubscriptionsPayload, ServiceState['bucket']][] = [
    ['paidSubscriptions', 'paid'],
    ['trialSubscriptions', 'trial'],
    ['complimentarySubscriptions', 'complimentary'],
  ];
  const states: ServiceState[] = [];
  for (const [key, bucket] of buckets) {
    const list = payload[key];
    if (!Array.isArray(list)) {
      continue;
    }
    for (const sub of list as Subscription[]) {
      const name = sub.displayProductName ?? sub.productName;
      if (!name) {
        continue;
      }
      states.push({
        name,
        productCode: sub.productCode,
        status: sub.status ?? 'UNKNOWN',
        bucket,
        active: isActiveStatus(sub.status),
        endDate: sub.subscriptionEndDate,
      });
    }
  }
  return states;
}

// Headers the recovered getVehicleSubscriptions call adds on top of the standard
// business set. The per-vehicle REGION/ASI-CODE/HW-TYPE/GENERATION and a DATETIME
// are required — the server returns 400 without them. `att-token` is accepted but
// not required for this GET (docs/subscriptions.md).
function subscriptionHeaders(
  session: LexusSession,
  vehicle: SubscriptionVehicle,
  entryPoint: SubscriptionEntryPoint,
  now: () => number,
): Record<string, string> {
  return {
    ...businessHeaders(session),
    VIN: vehicle.vin,
    'X-BRAND': vehicle.brand,
    GENERATION: vehicle.generation,
    REGION: vehicle.region,
    'ASI-CODE': vehicle.asiCode,
    'HW-TYPE': vehicle.hwType,
    DATETIME: String(now()),
    entryPoint,
    'accept-encoding': 'deflate',
  };
}

async function readPayload<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Lexus subscriptions request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  return (JSON.parse(text) as { payload: T }).payload;
}

// GET /oneapi/v3/vehicle-subscriptions — every connected-services subscription
// for the vehicle, bucketed into paid/trial/complimentary/available.
export async function fetchVehicleSubscriptions(
  session: LexusSession,
  vehicle: SubscriptionVehicle,
  options: {
    entryPoint?: SubscriptionEntryPoint;
    request?: RequestLike;
    now?: () => number;
  } = {},
): Promise<VehicleSubscriptionsPayload> {
  const request = options.request ?? globalThis.fetch;
  const response = await request(SUBSCRIPTIONS_ENDPOINT, {
    method: 'GET',
    headers: subscriptionHeaders(
      session,
      vehicle,
      options.entryPoint ?? 'SUBSCRIPTIONS',
      options.now ?? Date.now,
    ),
  });
  return readPayload<VehicleSubscriptionsPayload>(response);
}

// GET /oneapi/v1/radio — the SiriusXM / XM radio card (separate from the list).
export async function fetchSiriusXmRadio(
  session: LexusSession,
  vehicle: Pick<VehicleContext, 'vin' | 'brand'>,
  request: RequestLike = globalThis.fetch,
): Promise<SiriusXmRadio | undefined> {
  const response = await request(SIRIUSXM_RADIO_ENDPOINT, {
    method: 'GET',
    headers: { ...businessHeaders(session), vin: vehicle.vin, brand: vehicle.brand },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Lexus radio request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  return (JSON.parse(text) as { vehicleRadio?: SiriusXmRadio }).vehicleRadio;
}

// GET /oa24mm/v1/svc/subscriptions — head-unit music/streaming entitlement
// strings for the signed-in customer. Requires the customer GUID as userProfileID.
export async function fetchMusicEntitlements(
  session: LexusSession,
  request: RequestLike = globalThis.fetch,
): Promise<string[]> {
  const guid = guidFromIdToken(session.idToken);
  if (!guid) {
    return [];
  }
  const url = `${MUSIC_ENTITLEMENTS_ENDPOINT}?userProfileID=${encodeURIComponent(guid)}`;
  const response = await request(url, {
    method: 'GET',
    headers: { ...businessHeaders(session), 'X-APIVERSION': 'v1' },
  });
  return readPayload<string[]>(response);
}
