import { describe, expect, it } from 'vitest';
import { groupCspReports, parseCspReports } from './csp-reports';
import { validateCapture } from './pcap';

describe('CSP report imports', () => {
  it('normalizes legacy and Reporting API bodies, ignores other report types', () => {
    const reports = parseCspReports(
      JSON.stringify([
        {
          'csp-report': {
            'effective-directive': 'script-src',
            'blocked-uri': 'inline',
            'document-uri': 'https://example.com',
          },
        },
        {
          type: 'csp-violation',
          url: 'https://example.com',
          body: {
            effectiveDirective: 'script-src',
            blockedURL: 'inline',
            lineNumber: 3,
          },
        },
        { type: 'deprecation', body: {} },
      ]),
    );
    expect(reports).toHaveLength(2);
    expect(reports[1]?.line).toBe(3);
    expect(groupCspReports(reports, 'blocked')).toEqual([
      { value: 'inline', count: 2 },
    ]);
  });
  it('rejects malformed report objects instead of counting them', () => {
    for (const value of ['null', '[1]', '{}', '{"body": []}'])
      expect(() => parseCspReports(value)).toThrow();
  });
});
describe('capture file validation', () => {
  it('accepts classic endian / nanosecond variants and pcapng only', () => {
    for (const magic of [
      0xa1b2c3d4, 0xd4c3b2a1, 0xa1b23c4d, 0x4d3cb2a1, 0x0a0d0d0a,
    ]) {
      const bytes = new Uint8Array(24);
      new DataView(bytes.buffer).setUint32(0, magic);
      expect(() => validateCapture(bytes)).not.toThrow();
    }
    expect(() => validateCapture(new Uint8Array(24))).toThrow();
    expect(() => validateCapture(new Uint8Array(4))).toThrow();
  });
});
