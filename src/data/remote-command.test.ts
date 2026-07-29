import { describe, expect, it, vi } from 'vitest';

import type { LexusSession } from '@/auth/lexus-auth';
import type { VehicleContext } from '@/data/lexus-api';
import {
  commandBody,
  isCommandAccepted,
  REMOTE_COMMAND_ACCEPTED,
  sendRemoteCommand,
} from './remote-command';

const session = {
  accessToken: 'token',
  tokenType: 'Bearer',
  idToken: 'id',
  refreshToken: 'refresh',
  expiresAt: Date.now() + 3_600_000,
} as unknown as LexusSession;

const context: VehicleContext = { vin: 'VIN1', brand: 'L', generation: '21MM' };

describe('commandBody', () => {
  it('wraps the command with autoFixPopup disabled', () => {
    expect(commandBody('door-lock')).toEqual({ command: 'door-lock', autoFixPopup: false });
  });
});

describe('isCommandAccepted', () => {
  it('accepts only the 000000 return code', () => {
    expect(isCommandAccepted({ returnCode: REMOTE_COMMAND_ACCEPTED })).toBe(true);
    expect(isCommandAccepted({ returnCode: '000001' })).toBe(false);
    expect(isCommandAccepted({})).toBe(false);
    expect(isCommandAccepted(null)).toBe(false);
  });
});

describe('sendRemoteCommand', () => {
  it('POSTs the command body and resolves when accepted', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ returnCode: REMOTE_COMMAND_ACCEPTED }),
    });

    await expect(
      sendRemoteCommand(session, context, 'door-lock', fetchImpl as never),
    ).resolves.toBeUndefined();

    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ command: 'door-lock', autoFixPopup: false });
  });

  it('throws on a non-ok transport response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(
      sendRemoteCommand(session, context, 'door-lock', fetchImpl as never),
    ).rejects.toThrow('503');
  });

  it('throws when the vehicle does not accept the command', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ returnCode: '999999' }),
    });
    await expect(
      sendRemoteCommand(session, context, 'engine-start', fetchImpl as never),
    ).rejects.toThrow('did not accept');
  });
});
