import { describe, expect, it, vi } from 'vitest';

import type { LexusSession, RequestLike } from '@/auth/lexus-auth';
import {
  fetchVehicleSubscriptions,
  isActiveStatus,
  summarizeSubscriptions,
  type SubscriptionVehicle,
  type VehicleSubscriptionsPayload,
} from './subscriptions';

// Redacted shape of a real 21MM /oneapi/v3/vehicle-subscriptions payload.
const PAYLOAD: VehicleSubscriptionsPayload = {
  paidSubscriptions: [],
  complimentarySubscriptions: [],
  trialSubscriptions: [
    { productName: 'Safety Connect', productCode: 'PROD_SAFETYCONNECT', status: 'ACTIVE', type: 'Trial', subscriptionEndDate: '2036-04-23' },
    { productName: 'Remote Connect', productCode: 'PROD_REMOTEV2', status: 'active', type: 'Trial', subscriptionEndDate: '2029-04-23' },
    { productName: 'Wi-Fi Connect', productCode: 'WIFI-CONNECT', status: 'INACTIVE', type: 'Trial', subscriptionEndDate: '2026-08-28' },
  ],
  availableSubscriptions: [{ productName: 'Go Anywhere', category: 'BUNDLE' }],
};

function base64Url(value: object): string {
  // `atob`/`btoa` are globals in the test runtime; guidFromIdToken decodes with atob.
  return btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

// An ID token whose payload carries the GUID claim the client sends as X-GUID.
const SESSION: LexusSession = {
  accessToken: 'access',
  refreshToken: 'refresh',
  idToken: `header.${base64Url({ extension_tmsguid: 'guid-123' })}.sig`,
  expiresAt: Date.now() + 3_600_000,
  tokenType: 'Bearer',
};

const VEHICLE: SubscriptionVehicle = {
  vin: 'JTHGZ1B25T5100335',
  brand: 'L',
  generation: '21MM',
  region: 'US',
  asiCode: 'JG',
  hwType: '211',
};

// A minimal Response-like object: fetchVehicleSubscriptions only reads ok/status/text().
function jsonResponse(body: unknown, status = 200): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  } as unknown as Response;
}

describe('isActiveStatus', () => {
  it('is case-insensitive and trims', () => {
    expect(isActiveStatus('ACTIVE')).toBe(true);
    expect(isActiveStatus(' active ')).toBe(true);
    expect(isActiveStatus('INACTIVE')).toBe(false);
    expect(isActiveStatus(undefined)).toBe(false);
  });
});

describe('summarizeSubscriptions', () => {
  it('flattens the buckets and marks active state', () => {
    const states = summarizeSubscriptions(PAYLOAD);
    expect(states.map((s) => s.name)).toEqual([
      'Safety Connect',
      'Remote Connect',
      'Wi-Fi Connect',
    ]);
    expect(states.every((s) => s.bucket === 'trial')).toBe(true);
    expect(states.find((s) => s.name === 'Remote Connect')?.active).toBe(true);
    expect(states.find((s) => s.name === 'Wi-Fi Connect')?.active).toBe(false);
  });

  it('ignores unnamed entries and non-array buckets', () => {
    expect(
      summarizeSubscriptions({ trialSubscriptions: [{ status: 'ACTIVE' }] }),
    ).toEqual([]);
    expect(summarizeSubscriptions({})).toEqual([]);
  });
});

describe('fetchVehicleSubscriptions', () => {
  it('sends the required per-vehicle headers and returns the payload', async () => {
    let capturedHeaders: Record<string, string> = {};
    const request: RequestLike = vi.fn(async (_input, init) => {
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return jsonResponse({ payload: PAYLOAD });
    });

    const payload = await fetchVehicleSubscriptions(SESSION, VEHICLE, {
      request,
      now: () => 1785311760000,
    });

    expect(payload.trialSubscriptions).toHaveLength(3);
    expect(capturedHeaders.VIN).toBe('JTHGZ1B25T5100335');
    expect(capturedHeaders.REGION).toBe('US');
    expect(capturedHeaders['ASI-CODE']).toBe('JG');
    expect(capturedHeaders['HW-TYPE']).toBe('211');
    expect(capturedHeaders.GENERATION).toBe('21MM');
    expect(capturedHeaders.entryPoint).toBe('SUBSCRIPTIONS');
    expect(capturedHeaders.DATETIME).toBe('1785311760000');
    expect(capturedHeaders['X-GUID']).toBe('guid-123');
  });

  it('throws with status and body on an error response', async () => {
    const request: RequestLike = vi.fn(async () => jsonResponse('nope', 400));
    await expect(fetchVehicleSubscriptions(SESSION, VEHICLE, { request })).rejects.toThrow(
      /400/,
    );
  });
});
