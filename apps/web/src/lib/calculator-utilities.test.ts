import { describe, it, expect } from 'vitest';
import {
  calculateFunctions,
  compileExpression,
  derivative,
  integrate,
  intersections,
} from './function-workbench';
import {
  electrical,
  intervalPosition,
  moldVolume,
  recipeBatch,
} from './electrical-baking';
describe('calculator extensions', () => {
  it('parses numeric expressions with precedence and rejects script access', () => {
    expect(compileExpression('-2^2+2^-2')(0, 0)).toBe(-3.75);
    expect(compileExpression('2^3^2')(0, 0)).toBe(512);
    expect(compileExpression('sin(pi/2)+a*x')(3, 2)).toBe(7);
    for (const source of [
      'x.constructor',
      'alert(1)',
      'x=2',
      '2x',
      'sqrt(',
      '1e999',
    ])
      expect(() => compileExpression(source)).toThrow();
  });
  it('calculates calculus, roots and discontinuous graphs', () => {
    expect(derivative((x) => x * x, 3)).toBeCloseTo(6, 6);
    expect(integrate((x) => x * x, 0, 3)).toBeCloseTo(9);
    expect(integrate(Math.sin, Math.PI, 0)).toBeCloseTo(-2);
    expect(() => integrate((x) => 1 / x, -1, 1)).toThrow();
    expect(intersections((x) => x * x - 4, -3, 3)).toEqual(
      expect.arrayContaining([expect.closeTo(-2, 5), expect.closeTo(2, 5)]),
    );
    expect(intersections((x) => 1 / x, -1, 1)).toEqual([]);
    const result = calculateFunctions({
      mode: 'difference',
      f: 'x^2',
      g: 'x+2',
      from: -3,
      to: 3,
      parameter: 1,
      at: 0,
    });
    expect(result.points[0]).toEqual([-3, 9]);
    expect(result.second[0]).toEqual([-3, -1]);
    expect(result.roots).toHaveLength(2);
    expect(
      calculateFunctions({
        mode: 'derivative',
        f: 'sqrt(x)',
        g: '0',
        from: -1,
        to: 1,
        parameter: 1,
        at: 0,
      }).points[0],
    ).toBeNull();
  });
  it('computes electronics and rejects invalid LED supply', () => {
    expect(electrical('ohm', [12, 1000], 'series').current).toBe(0.012);
    expect(electrical('network', [100, 100], 'parallel').resistance).toBe(50);
    expect(electrical('divider', [12, 100, 200], 'series').voltage).toBe(8);
    expect(electrical('led', [5, 2, 20], 'series').resistance).toBe(150);
    expect(() => electrical('led', [2, 3, 20], 'series')).toThrow();
    expect(electrical('rc', [1000, 100], 'series').tau).toBe(0.1);
  });
  it('scales recipes, percentages, pans and actual elapsed timer stages', () => {
    const result = recipeBatch(
      [
        { name: 'flour', grams: 500, kind: 'flour' },
        { name: 'water', grams: 350, kind: 'water' },
      ],
      2,
    );
    expect(result.hydration).toBe(70);
    expect(result.total).toBe(1700);
    expect(moldVolume('round', 20, 5, 1) / moldVolume('round', 10, 5, 1)).toBe(
      4,
    );
    const stages = [
      { name: 'work', seconds: 20 },
      { name: 'rest', seconds: 10 },
    ];
    expect(intervalPosition(stages, 8, 85)).toMatchObject({
      round: 3,
      index: 1,
      remaining: 5,
    });
    expect(intervalPosition(stages, 8, 240).done).toBe(true);
    expect(() => intervalPosition(stages, 0, 0)).toThrow();
  });
});
