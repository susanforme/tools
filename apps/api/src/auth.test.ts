import { describe, expect, test } from 'bun:test';
import { hashPassword, hashToken, randomToken, verifyPassword } from './auth';
import { maskEmail, toPublicUser } from './index';

describe('auth crypto', () => {
  test('password and session token are not stored as plaintext', async () => {
    const password = 'correct horse battery staple';
    const stored = await hashPassword(password);
    const token = randomToken();

    expect(stored.hash).not.toBe(password);
    expect(stored.salt).toMatch(/^pbkdf2-sha256\$100000\$/);
    expect(await verifyPassword(password, stored.hash, stored.salt)).toBe(true);
    expect(await verifyPassword('wrong', stored.hash, stored.salt)).toBe(false);
    expect(await hashToken(token)).not.toBe(token);
  });

  test('existing 600000-iteration password hashes remain valid', async () => {
    expect(
      await verifyPassword(
        'legacy-password',
        'bcd6fa91715d3d26984173277109cb9e49d5a66ad8620b0c813122a8b103ae47',
        '000102030405060708090a0b0c0d0e0f',
      ),
    ).toBe(true);
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

  test('settings mask does not expose the email local part', () => {
    expect(maskEmail('abcdefg@q.com')).toBe('a*******@q.com');
  });
});
