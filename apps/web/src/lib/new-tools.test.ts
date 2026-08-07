import { describe, expect, it } from 'vitest';
import { renamedFileName } from './batch-files';
import {
  detectBinaryFormat,
  findBytes,
  readBinaryValue,
} from './binary-inspector';
import { parseEmailHeaders } from './email-headers';
import { parseHar } from './har';
import { diffPixelData } from './image-diff';
import { contrastRatio, extractPalette } from './image-palette';
import { jsonToNdjson, ndjsonToJson } from './json-data-tools';
import { parsePageSelection } from './pdf-pages';
import { createPngIco } from './pwa-icons';
import { parseAuthenticatorData } from './webauthn';

describe('new local tools', () => {
  it('handles file names, colors, and PDF page ranges', () => {
    expect(
      renamedFileName('draft.txt', 0, {
        extension: 'md',
        find: 'draft',
        prefix: 'doc-',
        replace: 'final',
        start: 3,
      }),
    ).toBe('doc-3-final.md');
    expect(parsePageSelection('3,1-2', 3)).toEqual([2, 0, 1]);
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(
      extractPalette(
        new Uint8ClampedArray([
          255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255,
        ]),
        1,
      )[0]?.hex,
    ).toBe('#ff0000');
  });

  it('parses browser diagnostics without leaking sensitive headers', () => {
    const har = parseHar(
      JSON.stringify({
        log: {
          entries: [
            {
              startedDateTime: '2026-01-01T00:00:00.000Z',
              time: 120,
              request: {
                method: 'GET',
                url: 'https://example.com/api?token=secret',
                headers: [{ name: 'Authorization', value: 'Bearer secret' }],
              },
              response: {
                status: 500,
                statusText: 'Error',
                bodySize: 12,
                headers: [],
                content: { mimeType: 'application/json', size: 12 },
              },
              timings: { wait: 100, receive: 20 },
            },
          ],
        },
      }),
    );
    expect(har.failures).toBe(1);
    expect(har.entries[0]?.url).not.toContain('secret');
    expect(har.entries[0]?.requestHeaders[0]?.value).toBe('••••••••');

    const binary = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 1, 2]);
    expect(detectBinaryFormat(binary).name).toBe('PNG');
    expect(findBytes(binary, Uint8Array.from([1, 2]))).toEqual([4, 6]);
    expect(readBinaryValue(Uint8Array.from([1, 0]), 0, 'uint16', true)).toBe(1);

    expect(ndjsonToJson(jsonToNdjson([{ id: 1 }, { id: 2 }]))).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
    expect(
      parseEmailHeaders(
        'Subject: =?UTF-8?B?5rWL6K+V?=\nAuthentication-Results: spf=pass; dkim=pass',
      ).subject,
    ).toBe('测试');

    const auth = new Uint8Array(37);
    auth[32] = 0x05;
    auth[36] = 2;
    expect(parseAuthenticatorData(auth.buffer).flags).toEqual(['UP', 'UV']);
    expect(parseAuthenticatorData(auth.buffer).signCount).toBe(2);

    expect(
      diffPixelData(
        new Uint8ClampedArray([0, 0, 0, 255]),
        new Uint8ClampedArray([255, 255, 255, 255]),
        false,
      ).changed,
    ).toBe(1);
    expect([
      ...createPngIco(Uint8Array.from([1, 2]), 32, 32).slice(0, 6),
    ]).toEqual([0, 0, 1, 0, 1, 0]);
  });
});
