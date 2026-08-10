import { describe, expect, it } from 'vitest';
import {
  generateKeyPair,
  jwkToPem,
  pemToJwk,
  verifyJwtWithJwk,
  type PublicJwk,
} from './jwk';

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
  it('generates an EC key pair', async () => {
    const pair = await generateKeyPair('P-256');
    expect(pair.publicJwk).toMatchObject({ kty: 'EC', crv: 'P-256' });
    expect(pair.privatePem).toContain('BEGIN PRIVATE KEY');
  });

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

    const pem = await jwkToPem(jwk);
    expect(pem).toContain('BEGIN PUBLIC KEY');
    await expect(pemToJwk(pem)).resolves.toMatchObject({
      kty: 'RSA',
      n: jwk.n,
      e: jwk.e,
    });
    const privateJwk = (await crypto.subtle.exportKey(
      'jwk',
      keys.privateKey,
    )) as PublicJwk;
    const privatePem = await jwkToPem(privateJwk);
    expect(privatePem).toContain('BEGIN PRIVATE KEY');
    await expect(pemToJwk(privatePem)).resolves.toMatchObject({
      kty: 'RSA',
      d: privateJwk.d,
    });
    await expect(
      verifyJwtWithJwk(`${input}.${base64Url(signature)}`, jwk),
    ).resolves.toBe(true);
  });
});
