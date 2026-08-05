import { describe, expect, test } from 'bun:test';
import { hashPassword, hashToken, randomToken, verifyPassword } from './auth';
import { toPublicUser } from './index';

describe('auth crypto', () => {
  test('password and session token are not stored as plaintext', async () => {
    const password = 'correct horse battery staple';
    const stored = await hashPassword(password);
    const token = randomToken();

    expect(stored.hash).not.toBe(password);
    expect(await verifyPassword(password, stored.hash, stored.salt)).toBe(true);
    expect(await verifyPassword('wrong', stored.hash, stored.salt)).toBe(false);
    expect(await hashToken(token)).not.toBe(token);
  });

  test('public auth responses do not expose email addresses', () => {
    expect(
      toPublicUser({
        avatar_url: null,
        email: 'private@example.com',
        github_id: null,
        id: 'user-id',
        name: 'User',
        password_hash: null,
        password_salt: null,
      }),
    ).toEqual({ avatar_url: null, id: 'user-id', name: 'User' });
  });
});
