import { describe, expect, it } from 'vitest';
import { generateKeyPair } from './jwk';
import {
  analyzeRateLimitHeaders,
  ascii85Decode,
  ascii85Encode,
  base58Decode,
  base58Encode,
  bech32Decode,
  bech32Encode,
  buildContentDisposition,
  decodeSnowflake,
  generateHreflang,
  generateJsonSchemaExample,
  inspectDnsZone,
  inspectEmailPolicies,
  inspectMultipart,
  intlPreview,
  matchCertificateKey,
  parseBaggage,
  parseContentDisposition,
  parseHreflangEntries,
  parseStructuredField,
  parseStructuredLogs,
  parseTraceparent,
  parseTracestate,
  restoreStackTrace,
  serializeBaggage,
} from './protocol-tools';

describe('protocol tools', () => {
  it('handles tracing and HTTP formats', async () => {
    expect(
      parseTraceparent(
        '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      ),
    ).toMatchObject({ sampled: true });
    expect(parseTracestate('rojo=00f067aa0ba902b7')).toHaveLength(1);
    const baggage = parseBaggage('userId=alice,serverNode=DF%2028;ttl=60');
    expect(baggage[1]).toMatchObject({ value: 'DF 28' });
    expect(serializeBaggage(baggage)).toBe(
      'userId=alice,serverNode=DF%2028;ttl=60',
    );
    expect(
      analyzeRateLimitHeaders(
        'RateLimit-Policy: "api";q=100;w=60\nRateLimit: "api";r=40;t=12',
        0,
      ),
    ).toMatchObject({ limit: 100, remaining: 40, waitSeconds: 12 });
    const header = buildContentDisposition('测试.txt', 'attachment');
    expect(parseContentDisposition(header).filename).toBe('测试.txt');
    expect(
      inspectMultipart(
        '--x\r\nContent-Disposition: form-data; name="title"\r\n\r\nhello\r\n--x--',
        'x',
      )[0],
    ).toMatchObject({ name: 'title', preview: 'hello' });
    await expect(
      parseStructuredField('a=1, ready', 'dictionary'),
    ).resolves.toMatchObject({
      a: [1, {}],
      ready: [true, {}],
    });
  });

  it('round-trips developer encodings and identifiers', () => {
    const bytes = new TextEncoder().encode('hello');
    expect(new TextDecoder().decode(base58Decode(base58Encode(bytes)))).toBe(
      'hello',
    );
    expect(new TextDecoder().decode(ascii85Decode(ascii85Encode(bytes)))).toBe(
      'hello',
    );
    const bech32 = bech32Encode('tool', bytes);
    expect(new TextDecoder().decode(bech32Decode(bech32).bytes)).toBe('hello');
    expect(decodeSnowflake('175928847299117063', 1420070400000)).toMatchObject({
      sequence: 7,
    });
  });

  it('checks operational text formats', () => {
    expect(
      inspectDnsZone(
        '$ORIGIN example.com.\n@ 3600 IN SOA ns.example.com. hostmaster.example.com. (1 2 3 4 5)\n@ IN NS ns.example.com.\nwww IN A 192.0.2.1',
      ).issues,
    ).toEqual([]);
    expect(
      inspectEmailPolicies('v=spf1 mx -all', 'v=DMARC1; p=reject'),
    ).toMatchObject({
      spfLookups: 1,
      spfIssues: [],
      dmarcIssues: [],
    });
    expect(
      parseStructuredLogs('level=info status=200 ok=true', 'logfmt')[0],
    ).toEqual({
      level: 'info',
      status: 200,
      ok: true,
    });
    expect(
      intlPreview({
        locale: 'en-US',
        currency: 'USD',
        number: 2,
        date: new Date('2026-08-10T12:00:00Z'),
      }).pluralCardinal,
    ).toBe('other');
  });

  it('generates and queries structured documents', () => {
    expect(
      generateJsonSchemaExample(
        JSON.stringify({
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
        }),
      ),
    ).toEqual({ id: '123e4567-e89b-42d3-a456-426614174000' });
    const parsed = parseHreflangEntries(
      'en https://example.com/en\nzh-CN https://example.com/zh',
    );
    expect(parsed.issues).toEqual([]);
    expect(generateHreflang(parsed.entries, 'html')).toContain(
      'hreflang="zh-CN"',
    );
  });

  it('restores a stack and matches certificate key material', async () => {
    await expect(
      restoreStackTrace(
        JSON.stringify({
          version: 3,
          sources: ['src/app.ts'],
          names: [],
          mappings: 'AAAA',
        }),
        'at run (app.js:1:1)',
      ),
    ).resolves.toMatchObject({
      mappings: [{ original: { source: 'src/app.ts', line: 1, column: 1 } }],
    });

    const x509 = await import('@peculiar/x509');
    const pair = await generateKeyPair('P-256');
    const algorithm: EcKeyGenParams & EcdsaParams = {
      name: 'ECDSA',
      namedCurve: 'P-256',
      hash: 'SHA-256',
    };
    const keys = {
      publicKey: await crypto.subtle.importKey(
        'jwk',
        pair.publicJwk,
        algorithm,
        true,
        ['verify'],
      ),
      privateKey: await crypto.subtle.importKey(
        'jwk',
        pair.privateJwk,
        algorithm,
        true,
        ['sign'],
      ),
    };
    const certificate = await x509.X509CertificateGenerator.createSelfSigned({
      serialNumber: '01',
      name: 'CN=Match',
      signingAlgorithm: algorithm,
      keys,
    });
    await expect(
      matchCertificateKey(certificate.toString('pem'), pair.privatePem),
    ).resolves.toMatchObject({ matches: true, type: 'EC' });
  });
});
