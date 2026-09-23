import { it, expect } from 'vitest';
import {
  laserPlan,
  laserDxf,
  laserSvg,
  offsetOrthogonal,
  type LaserOptions,
} from './laser-design';
const options: LaserOptions = {
  kind: 'box',
  width: 100,
  depth: 80,
  height: 60,
  thickness: 3,
  kerf: 0.2,
  clearance: 0.1,
  rows: 2,
  columns: 3,
};
it('compensates outer contours outward and mating holes inward, with closed DXF cuts in mm', () => {
  expect(
    offsetOrthogonal(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
        { x: 0, y: 5 },
      ],
      0.1,
    ),
  ).toEqual([
    { x: -0.1, y: -0.1 },
    { x: 10.1, y: -0.1 },
    { x: 10.1, y: 5.1 },
    { x: -0.1, y: 5.1 },
  ]);
  const plan = laserPlan(options);
  expect(plan.parts).toHaveLength(5);
  expect(plan.parts[0].shapes.filter((s) => s.hole)).toHaveLength(8);
  const hole = plan.parts[0].shapes.find((s) => s.hole)!;
  expect(hole.points[2].y - hole.points[0].y + options.kerf).toBeCloseTo(
    options.thickness + options.clearance,
  );
  const svg = laserSvg(plan),
    dxf = laserDxf(plan);
  expect(svg).toContain('width="');
  expect(svg).toContain('id="CUT"');
  expect(dxf).toContain('$INSUNITS\r\n70\r\n4');
  expect(dxf.match(/LWPOLYLINE/g)).toHaveLength(
    plan.parts.reduce((sum, p) => sum + p.shapes.length, 0),
  );
  expect(dxf.endsWith('0\r\nEOF')).toBe(true);
});
it('makes complementary half-height divider slots and bounded fit cards', () => {
  const plan = laserPlan({ ...options, kind: 'dividers' });
  expect(plan.parts).toHaveLength(5);
  expect(plan.parts[0].shapes[0].points.length).toBe(16);
  expect(plan.parts[2].shapes[0].points.length).toBe(12);
  const card = laserPlan({ ...options, kind: 'card' });
  expect(card.labels).toHaveLength(10);
  expect(
    laserPlan({ ...options, kind: 'card', thickness: 15 }).labels,
  ).toHaveLength(10);
  expect(card.labels.slice(1).map((l) => l.text)).toEqual([
    '2.70',
    '2.80',
    '2.90',
    '3.00',
    '3.10',
    '3.20',
    '3.30',
    '3.40',
    '3.50',
  ]);
  expect(() => laserPlan({ ...options, thickness: 20 })).toThrow('dimensions');
});
