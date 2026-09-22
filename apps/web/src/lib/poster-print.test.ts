import { describe, expect, it } from 'vitest';
import { getPosterLayout } from './poster-print';

describe('A4 poster tiling', () => {
  it('covers the requested physical size with exact overlap and no extra boundary page', () => {
    const exact = getPosterLayout(370, 370 / 544, 'portrait', 10);
    expect([exact.columns, exact.rows]).toEqual([2, 2]);
    expect(
      exact.tileWidth + (exact.columns - 1) * (exact.tileWidth - exact.overlap),
    ).toBe(370);
    expect(
      exact.tileHeight + (exact.rows - 1) * (exact.tileHeight - exact.overlap),
    ).toBe(544);
    expect(getPosterLayout(371, 1, 'portrait', 10).columns).toBe(3);
    expect(getPosterLayout(277, 277 / 190, 'landscape', 0).columns).toBe(1);
    expect(getPosterLayout(10, 1, 'portrait', 10).rows).toBe(1);
  });
  it('rejects invalid dimensions and excessive work before PDF allocation', () => {
    for (const width of [NaN, Infinity, -1, 0, 5001])
      expect(() => getPosterLayout(width, 1, 'portrait', 10)).toThrow();
    expect(() => getPosterLayout(200, 0, 'portrait', 10)).toThrow();
    expect(() => getPosterLayout(200, 1, 'portrait', -1)).toThrow();
    expect(() => getPosterLayout(200, 1, 'other', 10)).toThrow();
    expect(() => getPosterLayout(5000, 1, 'portrait', 30)).toThrow(
      'tooManyPages',
    );
  });
});
