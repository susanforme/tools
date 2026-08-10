import { describe, expect, it } from 'vitest';
import { generateKeyPair } from './jwk';
import {
  analyzeForwardedHeaders,
  canonicalizeJson,
  diffOpenApi,
  generateAppAssociation,
  generateDsRecord,
  inspectAppAssociation,
  inspectModernCookie,
  inspectPermissionsPolicy,
  inspectWebManifest,
  matchNginxLocation,
  negotiateContent,
  parseLinkHeader,
  serializeLinkHeader,
  signHttpMessage,
  verifyContentDigest,
  verifyHttpMessageSignature,
} from './modern-web-tools';

describe('modern web tools', () => {
  it('signs and verifies an HTTP message and content digest', async () => {
    const signed = await signHttpMessage({
      method: 'POST',
      url: 'https://example.com/items',
      body: '{"ok":true}',
      keyMaterial: 'test-secret',
      algorithm: 'hmac-sha256',
      created: 1_700_000_000,
    });
    expect(await verifyContentDigest('{"ok":true}', signed.contentDigest)).toBe(
      true,
    );
    expect(
      await verifyHttpMessageSignature({
        signatureBase: signed.signatureBase,
        signature: signed.signature,
        keyMaterial: 'test-secret',
        algorithm: 'hmac-sha256',
      }),
    ).toBe(true);
    const rsa = await generateKeyPair('RSA');
    const rsaSigned = await signHttpMessage({
      method: 'GET',
      url: 'https://example.com/',
      body: '',
      keyMaterial: rsa.privatePem,
      algorithm: 'rsa-pss-sha512',
      created: 1_700_000_000,
    });
    expect(
      await verifyHttpMessageSignature({
        signatureBase: rsaSigned.signatureBase,
        signature: rsaSigned.signature,
        keyMaterial: rsa.publicPem,
        algorithm: 'rsa-pss-sha512',
      }),
    ).toBe(true);
  });

  it('checks policies, app links and manifests', () => {
    expect(
      inspectPermissionsPolicy(
        'camera=()',
        'microphone=();report-to=default',
        'default="https://example.com/reports"',
      ).issues,
    ).toHaveLength(0);
    const association = generateAppAssociation(
      'apple',
      'TEAM.com.example.app',
      '',
      '/products/*',
    );
    expect(
      inspectAppAssociation(association, 'apple', '/products/1'),
    ).toMatchObject({
      issues: [],
      matched: true,
    });
    expect(
      inspectWebManifest({ name: 'App', start_url: '/', icons: [] }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ICON_192_REQUIRED' }),
      ]),
    );
  });

  it('finds breaking OpenAPI changes and modern cookie mistakes', () => {
    const previous = {
      paths: {
        '/users': { get: { responses: { 200: { description: 'OK' } } } },
      },
    };
    expect(diffOpenApi(previous, { paths: {} })[0]).toMatchObject({
      level: 'breaking',
      code: 'OPERATION_REMOVED',
    });
    expect(inspectModernCookie('id=1; SameSite=None; Partitioned')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SAMESITE_NONE_REQUIRES_SECURE' }),
        expect.objectContaining({ code: 'PARTITIONED_REQUIRES_SECURE' }),
      ]),
    );
  });

  it('parses linking and proxy headers and negotiates content', () => {
    const links = parseLinkHeader('</app.js>; rel="preload"; as="script"');
    expect(serializeLinkHeader(links)).toContain('rel="preload"');
    expect(
      analyzeForwardedHeaders(
        'X-Forwarded-For: 203.0.113.5, 192.0.2.1\nVia: 1.1 proxy',
        1,
      ).probableClient,
    ).toBe('203.0.113.5');
    expect(
      negotiateContent(
        'text/html, application/json;q=0.9',
        'application/json\ntext/plain',
        'media',
      ).selected,
    ).toBe('application/json');
  });

  it('canonicalizes JSON, matches Nginx locations and creates DS records', async () => {
    expect(canonicalizeJson('{"b":2,"a":1}')).toBe('{"a":1,"b":2}');
    expect(
      matchNginxLocation(
        'location / { }\nlocation ^~ /images/ { }\nlocation ~* \\.png$ { }',
        '/images/logo.png',
      ).matched,
    ).toMatchObject({ modifier: '^~', pattern: '/images/' });
    const ds = await generateDsRecord('example.com', '257 3 8 AwEAAc8=', 2);
    expect(ds.record).toMatch(/^example\.com\. IN DS \d+ 8 2 [0-9A-F]{64}$/);
  });
});
