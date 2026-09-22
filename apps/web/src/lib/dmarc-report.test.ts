// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseDmarc } from './dmarc-report';
const report = (count = '10') =>
  `<feedback><policy_published><domain>example.com</domain></policy_published><record><row><source_ip>192.0.2.1</source_ip><count>${count}</count><policy_evaluated><dkim>pass</dkim><spf>fail</spf><disposition>none</disposition></policy_evaluated></row></record><record><row><source_ip>192.0.2.1</source_ip><count>2</count><policy_evaluated><dkim>fail</dkim><spf>fail</spf><disposition>reject</disposition></policy_evaluated></row></record></feedback>`;
describe('DMARC report', () => {
  it('weights alignment by mail count and groups repeated source IPs', () => {
    const result = parseDmarc(report());
    expect(result.total).toBe(12);
    expect(result.passed).toBe(10);
    expect(result.sources).toEqual([
      { ip: '192.0.2.1', count: 12, spfPass: 0, dkimPass: 10, aligned: 10 },
    ]);
  });
  it('rejects malformed XML, DTD and unsafe counts', () => {
    expect(() => parseDmarc('<feedback>')).toThrow();
    expect(() => parseDmarc('<!DOCTYPE feedback>' + report())).toThrow();
    expect(() => parseDmarc(report('-1'))).toThrow();
    expect(() => parseDmarc(report('9007199254740992'))).toThrow();
    expect(() => parseDmarc('<feedback/>')).toThrow();
  });
});
