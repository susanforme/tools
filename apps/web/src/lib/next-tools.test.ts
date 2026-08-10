import { describe, expect, it } from 'vitest';
import {
  analyzeHttpCache,
  analyzeHttpLogs,
  checksums,
  decodeProtobufWire,
  generatePkce,
  inspectDataUri,
  inspectSecurityTxt,
  inspectUnicodeSecurity,
  parseOAuthCallback,
} from './next-tools';

describe('next tool batch', () => {
  it('handles browser protocol helpers', async () => {
    const pkce = await generatePkce();
    expect(pkce.verifier.length).toBeGreaterThanOrEqual(43);
    expect(parseOAuthCallback('https://a.test/cb?code=1#state=2')).toEqual({
      code: '1',
      state: '2',
    });
    expect(
      analyzeHttpCache('Cache-Control: max-age=60\nAge: 10', 0)
        .remainingSeconds,
    ).toBe(50);
    expect(inspectUnicodeSecurity(`a\u202E`)[0]?.code).toBe('bidi');
    expect(inspectDataUri('data:text/plain;base64,aGk=').text).toBe('hi');
  });

  it('decodes binary and operational formats', () => {
    expect(decodeProtobufWire(Uint8Array.of(8, 150, 1))).toEqual([
      { field: 1, wireType: 0, value: '150' },
    ]);
    expect(checksums(new TextEncoder().encode('123456789'))).toEqual({
      crc32: 'cbf43926',
      adler32: '091e01de',
      xxhash32: '937bad67',
    });
    expect(
      analyzeHttpLogs(
        '127.0.0.1 - - [10/Oct/2000:13:55:36 +0000] "GET / HTTP/1.1" 200 12',
      ).requests,
    ).toBe(1);
    expect(
      inspectSecurityTxt(
        'Contact: mailto:a@example.com\nExpires: 2099-01-01T00:00:00Z',
      ).map(({ code }) => code),
    ).toEqual(['missingCanonical']);
  });
});
