import { describe, expect, it } from 'vitest';
import {
  collageLayout,
  FULL_CORNERS,
  perspectiveTransform,
  validCorners,
  type Corners,
} from './image-document-tools';

describe('image layout and document perspective', () => {
  it('lays out varied aspect ratios without overlap and rejects excessive canvases', () => {
    const images = [
      { width: 100, height: 200 },
      { width: 100, height: 100 },
      { width: 100, height: 50 },
    ];
    const grid = collageLayout(images, 'grid', 100, 10, 2);
    expect(grid).toMatchObject({ width: 230, height: 280 });
    expect(grid.placements[2]).toEqual({
      x: 10,
      y: 220,
      width: 100,
      height: 50,
    });
    expect(collageLayout(images, 'horizontal', 100, 0, 1)).toMatchObject({
      width: 300,
      height: 200,
    });
    expect(collageLayout(images, 'vertical', 100, 0, 1)).toMatchObject({
      width: 100,
      height: 350,
    });
    expect(() => collageLayout(images, 'grid', 10000, 10, 2)).toThrow();
    expect(() => collageLayout([], 'grid', 100, 0, 2)).toThrow();
    for (const invalid of [NaN, Infinity, -Infinity, 0, -1]) {
      expect(() =>
        collageLayout([{ width: invalid, height: 100 }], 'grid', 100, 0, 2),
      ).toThrow('imageDocumentCommon.errors.dimensions');
      expect(() =>
        collageLayout([{ width: 100, height: invalid }], 'grid', 100, 0, 2),
      ).toThrow('imageDocumentCommon.errors.dimensions');
    }
  });
  it('maps all corners exactly and rejects crossed or degenerate quadrilaterals', () => {
    const corners: Corners = [
      { x: 0.1, y: 0.15 },
      { x: 0.9, y: 0 },
      { x: 0.8, y: 0.9 },
      { x: 0.2, y: 1 },
    ];
    const transform = perspectiveTransform(corners);
    FULL_CORNERS.forEach((point, index) => {
      const result = transform(point.x, point.y);
      expect(result.x).toBeCloseTo(corners[index].x, 9);
      expect(result.y).toBeCloseTo(corners[index].y, 9);
    });
    const identity = perspectiveTransform(FULL_CORNERS);
    expect(identity(0.25, 0.75)).toEqual({ x: 0.25, y: 0.75 });
    expect(validCorners([corners[0], corners[2], corners[1], corners[3]])).toBe(
      false,
    );
    expect(() =>
      perspectiveTransform([corners[0], corners[0], corners[0], corners[0]]),
    ).toThrow();
  });
});
