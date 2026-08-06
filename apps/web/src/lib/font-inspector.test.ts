import { describe, expect, test } from 'vitest';
import {
  formatCodePoint,
  getPageCount,
  isSupportedFontFile,
  parseGlyphSearch,
} from './font-inspector';

describe('Font inspector helpers', () => {
  test('validates files and paginates glyphs', () => {
    expect(isSupportedFontFile('Demo.WOFF2')).toBe(true);
    expect(isSupportedFontFile('font.txt')).toBe(false);
    expect(getPageCount(201)).toBe(3);
    expect(formatCodePoint(0x1f600)).toBe('U+1F600');
    expect(parseGlyphSearch('@')).toEqual([0x40]);
    expect(parseGlyphSearch('U+0040')).toEqual([0x40]);
  });
});
