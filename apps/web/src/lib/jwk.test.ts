import { describe, expect, it } from 'vitest';
import { jwkToPem, verifyJwtWithJwk, type PublicJwk } from './jwk';

function base64Url(value: string | ArrayBuffer): string {
  const bytes =
    typeof value === 'string'
      ? new TextEncoder().encode(value)
      : new Uint8Array(value);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

describe('JWK utilities', () => {
  it('exports PEM and verifies an RS256 JWT', async () => {
    const keys = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
      },
      true,
      ['sign', 'verify'],
    );
    const jwk = (await crypto.subtle.exportKey(
      'jwk',
      keys.publicKey,
    )) as PublicJwk;
    jwk.alg = 'RS256';
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64Url(JSON.stringify({ sub: '1' }));
    const input = `${header}.${payload}`;
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      keys.privateKey,
      new TextEncoder().encode(input),
    );

    await expect(jwkToPem(jwk)).resolves.toContain('BEGIN PUBLIC KEY');
    await expect(
      verifyJwtWithJwk(`${input}.${base64Url(signature)}`, jwk),
    ).resolves.toBe(true);
  });
});
