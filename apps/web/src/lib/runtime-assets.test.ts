import { describe, expect, it } from 'vitest';
import { RUNTIME_ASSET_URLS } from './runtime-assets';

describe('runtime assets', () => {
  it('pins immutable CDN assets to exact package versions', () => {
    expect(Object.values(RUNTIME_ASSET_URLS)).toHaveLength(24);
    for (const url of Object.values(RUNTIME_ASSET_URLS)) {
      expect(url).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/npm\/.+@\d[^/]*\/.+/);
    }
  });
});
