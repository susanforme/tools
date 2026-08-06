import { describe, expect, it } from 'vitest';
import { convertUnit } from './unit-converter';

describe('convertUnit', () => {
  it('converts representative metric, speed and data units', () => {
    expect(convertUnit(1, 'length', 'km', 'm')).toBe(1_000);
    expect(convertUnit(1, 'speed', 'mps', 'kmh')).toBeCloseTo(3.6);
    expect(convertUnit(1, 'data', 'mib', 'b')).toBe(1_048_576);
  });
});
