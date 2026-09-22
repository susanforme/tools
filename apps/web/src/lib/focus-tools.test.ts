import { describe, expect, it } from 'vitest';
import {
  boundedNumber,
  createNoiseSamples,
  DEFAULT_LEVELS,
  formatClock,
  parseMix,
  remainingTime,
} from './focus-tools';

describe('focus tools', () => {
  it('uses an absolute deadline after delayed ticks and preserves paused time', () => {
    expect(remainingTime(10_000, 10_000, 3_700)).toBe(6_300);
    expect(remainingTime(10_000, 10_000, 50_000)).toBe(0);
    expect(remainingTime(null, 6_300, 50_000)).toBe(6_300);
    expect(formatClock(59_999, true)).toBe('00:01:00');
    expect(formatClock(3_661_234)).toBe('01:01:01');
  });
  it('rejects malformed saved mixes and bounds untrusted query options', () => {
    expect(parseMix(DEFAULT_LEVELS)).toEqual(DEFAULT_LEVELS);
    expect(parseMix({ ...DEFAULT_LEVELS, rain: Infinity })).toBeNull();
    expect(parseMix({ ...DEFAULT_LEVELS, cafe: '20' })).toBeNull();
    expect(parseMix({ ...DEFAULT_LEVELS, pink: -1 })).toBeNull();
    expect(parseMix({ rain: 20 })).toBeNull();
    expect(boundedNumber(Infinity, 40, 5, 100)).toBe(40);
    expect(boundedNumber(-20, 40, 5, 100)).toBe(5);
  });
  it('generates distinct finite noise channels and fades loop boundaries', () => {
    const samples = (kind: 'white' | 'pink' | 'brown') => {
      let seed = 42;
      return createNoiseSamples(kind, 4800, () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 2 ** 32;
      });
    };
    const white = samples('white'),
      pink = samples('pink'),
      brown = samples('brown');
    for (const buffer of [white, pink, brown]) {
      expect(buffer.length).toBe(4800);
      expect(buffer.every(Number.isFinite)).toBe(true);
      expect(Math.abs(buffer[0])).toBe(0);
      expect(Math.abs(buffer[buffer.length - 1])).toBe(0);
      expect(buffer.some((value) => Math.abs(value) > 0.05)).toBe(true);
    }
    const roughness = (buffer: Float32Array) =>
      buffer
        .slice(1)
        .reduce(
          (sum, value, index) => sum + Math.abs(value - buffer[index]),
          0,
        );
    expect(roughness(brown)).toBeLessThan(roughness(pink));
    expect(roughness(pink)).toBeLessThan(roughness(white));
  });
});
