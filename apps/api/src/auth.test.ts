import { describe, expect, test } from 'bun:test';
import { hashPassword, hashToken, randomToken, verifyPassword } from './auth';

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
});
