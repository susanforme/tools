import { describe, expect, it } from 'vitest';
import {
  beadUsage,
  parseBeadColors,
  quantizeBeads,
  validateBeadProject,
} from './bead-pattern';
import {
  allowedCutOrientations,
  planCuts,
  type CutProject,
} from './cut-planner';
import { formatPhotoExif } from './photo-frame';
import {
  furnitureDistance,
  furnitureRect,
  roomCollisions,
  roomSvg,
  validateRoomProject,
  type Furniture,
} from './room-planner';
import { validateScreenshotProject } from './screenshot-annotator';

describe('creative tools', () => {
  it('validates imported annotation projects and rejects active content in images', () => {
    const project = {
      version: 1,
      image: null,
      marks: [
        {
          kind: 'text',
          x: 1,
          y: 2,
          endX: 3,
          endY: 4,
          color: '#ff0000',
          size: 20,
          text: 'test',
        },
      ],
      padding: 40,
      radius: 16,
      background: '#ffffff',
    };
    expect(validateScreenshotProject(project)).toBe(true);
    expect(
      validateScreenshotProject({
        ...project,
        image: {
          name: 'x',
          data: 'data:image/svg+xml,<svg onload="alert(1)"/>',
          width: 10,
          height: 10,
        },
      }),
    ).toBe(false);
    expect(
      validateScreenshotProject({
        ...project,
        marks: [{ ...project.marks[0], x: Infinity }],
      }),
    ).toBe(false);
  });
  it('formats available EXIF only, handles absent tags and exposure units', () => {
    expect(
      formatPhotoExif({
        Make: 'Canon',
        Model: 'Canon R5',
        FNumber: 2.8,
        ExposureTime: 0.004,
        ISO: 200,
        FocalLength: 50,
      }),
    ).toEqual({
      camera: 'Canon R5',
      lens: '',
      parameters: '50 mm · f/2.8 · 1/250 s · ISO 200',
      date: '',
    });
    expect(formatPhotoExif(null)).toEqual({
      camera: '',
      lens: '',
      parameters: '',
      date: '',
    });
    expect(formatPhotoExif({ ExposureTime: 2 }).parameters).toBe('2 s');
    expect(formatPhotoExif({ ExposureTime: 0.8 }).parameters).toBe('0.8 s');
  });
  it('limits a generic bead palette, counts every bead and rejects bad grids', () => {
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 0, 0, 0, 250, 0, 0, 255, 255, 255, 255, 255,
    ]);
    const grid = quantizeBeads(
      pixels,
      2,
      2,
      ['#ff0000', '#ffffff', '#000000'],
      2,
    );
    expect(grid.palette).toEqual(['#ff0000', '#ffffff']);
    expect(beadUsage(grid)).toEqual([2, 2]);
    expect(validateBeadProject({ version: 1, image: null, grid })).toBe(true);
    expect(
      validateBeadProject({
        version: 1,
        image: null,
        grid: { ...grid, cells: [10, 0, 0, 0] },
      }),
    ).toBe(false);
    expect(parseBeadColors('#FFFFFF, #ffffff;#000000')).toEqual([
      '#ffffff',
      '#000000',
    ]);
    expect(() => parseBeadColors('fake-brand-code')).toThrow();
  });
  it('respects grain, rotation and kerf, and conserves sheet area without overlap', () => {
    const part = {
      id: 'a',
      name: 'A',
      width: 60,
      height: 40,
      quantity: 4,
      rotate: true,
      grain: 'height' as const,
    };
    expect(allowedCutOrientations(part, 'width')).toEqual([
      { width: 40, height: 60, rotated: true },
    ]);
    expect(allowedCutOrientations({ ...part, rotate: false }, 'width')).toEqual(
      [],
    );
    const project: CutProject = {
      version: 1,
      sheetWidth: 100,
      sheetHeight: 100,
      sheets: 2,
      kerf: 5,
      grain: 'none',
      parts: [part],
    };
    const result = planCuts(project);
    expect(result.unplaced).toHaveLength(0);
    expect(result.sheets).toHaveLength(2);
    let used = 0;
    for (const sheet of result.sheets) {
      const rectangles = [...sheet.parts, ...sheet.free];
      sheet.parts.forEach((item) => {
        used += item.width * item.height;
      });
      rectangles.forEach((a, index) => {
        expect(a.x + a.width).toBeLessThanOrEqual(project.sheetWidth);
        expect(a.y + a.height).toBeLessThanOrEqual(project.sheetHeight);
        for (const b of rectangles.slice(index + 1))
          expect(
            a.x >= b.x + b.width ||
              b.x >= a.x + a.width ||
              a.y >= b.y + b.height ||
              b.y >= a.y + a.height,
          ).toBe(true);
      });
    }
    expect(used + result.leftover + result.kerfWaste).toBeCloseTo(20000);
    expect(() => planCuts({ ...project, sheetWidth: Infinity })).toThrow();
    expect(
      planCuts({
        ...project,
        grain: 'width',
        parts: [{ ...part, rotate: false }],
      }).unplaced,
    ).toHaveLength(4);
  });
  it('measures actual furniture edges, flags collisions and validates saved plans', () => {
    const bed: Furniture = {
      id: 'bed',
      name: '<bed>',
      kind: 'bed',
      x: 0,
      y: 0,
      width: 150,
      depth: 200,
      rotated: false,
      color: '#ffffff',
    };
    const desk: Furniture = {
      ...bed,
      id: 'desk',
      name: 'desk',
      kind: 'desk',
      x: 180,
      y: 240,
      width: 100,
      depth: 60,
    };
    expect(furnitureDistance(bed, desk)).toBe(50);
    expect(furnitureRect({ ...bed, rotated: true })).toMatchObject({
      width: 200,
      height: 150,
    });
    const current = { width: 500, height: 400, items: [bed, desk] };
    expect(roomCollisions(current)).toEqual([]);
    expect(
      roomCollisions({ ...current, items: [bed, { ...desk, x: 10, y: 10 }] }),
    ).toEqual(['bed', 'desk']);
    expect(validateRoomProject({ version: 1, current, plans: [] })).toBe(true);
    expect(
      validateRoomProject({
        version: 1,
        current: { ...current, items: [bed, bed] },
        plans: [],
      }),
    ).toBe(false);
    expect(roomSvg(current)).toContain('&lt;bed&gt;');
  });
});
