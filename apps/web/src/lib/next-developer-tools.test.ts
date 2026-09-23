import { describe, expect, it } from 'vitest';
import {
  buildCampaignUrl,
  canonicalizeUrl,
  createMergePatch,
  inspectComposeGraph,
  retrySchedule,
} from './next-developer-tools';

describe('web diagnostics', () => {
  it('creates JSON Merge Patch changes and rejects unrepresentable null values', () => {
    expect(
      createMergePatch({ name: 'A', old: 1 }, { name: 'B', nested: {} }),
    ).toEqual({ name: 'B', old: null, nested: {} });
    expect(() => createMergePatch({}, { value: null })).toThrow();
    expect(() => createMergePatch({}, { nested: { value: null } })).toThrow();
  });
  it('removes tracking parameters and computes bounded retry delays', () => {
    expect(
      canonicalizeUrl('https://example.com/?utm_source=x&b=2&a=1#top'),
    ).toBe('https://example.com/?a=1&b=2');
    expect(retrySchedule(2, 4, 5).map((item) => item.delaySeconds)).toEqual([
      2, 4, 5, 5,
    ]);
  });
  it('orders Compose dependencies and rejects cycles', () => {
    expect(
      inspectComposeGraph(
        'services:\n  web:\n    depends_on: [api]\n  api:\n    image: node',
      ).startupOrder,
    ).toEqual(['api', 'web']);
    expect(() =>
      inspectComposeGraph(
        'services:\n  a:\n    depends_on: [b]\n  b:\n    depends_on: [a]',
      ),
    ).toThrow(/cycle/i);
  });
  it('preserves existing URL params', () => {
    expect(
      buildCampaignUrl('https://example.com/?q=1', 'mail', 'email', 'fall'),
    ).toContain('q=1&utm_source=mail');
  });
});
