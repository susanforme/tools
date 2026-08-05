import { setAuthAuthenticated, setAuthGuest } from '@/hooks/useAuthSession';
import { assertSessionActive, runOptionalAuth } from './optional-auth';
import { describe, expect, test } from 'vitest';

describe('optional authenticated operations', () => {
  test('uses local work silently for guests', async () => {
    setAuthGuest();
    const result = await runOptionalAuth({
      local: async () => 'local',
      remote: async () => 'remote',
    });
    expect(result).toEqual({ ok: true, source: 'local', value: 'local' });
  });

  test('reports authenticated failures and falls back after session expiry', async () => {
    setAuthAuthenticated({ avatar_url: null, id: 'user-id', name: 'User' });
    expect(
      await runOptionalAuth({
        local: async () => 'local',
        remote: async () => {
          throw new Error('server failed');
        },
      }),
    ).toEqual({ ok: false, report: true });

    expect(
      await runOptionalAuth({
        local: async () => 'local',
        remote: async () => {
          assertSessionActive({ status: 401 });
          return 'remote';
        },
      }),
    ).toEqual({ ok: true, source: 'local', value: 'local' });
  });
});
