import { describe, expect, it } from 'vitest';
import { describePitch, detectPitch } from './pitch-detector';

describe('tuner pitch detection', () => {
  it('finds bass, guitar and voice notes at common sample rates', () => {
    for (const rate of [44100, 48000, 96000]) {
      for (const frequency of [
        55, 82.41, 110, 196, 261.63, 440, 880, 1318.51,
      ]) {
        const signal = Float32Array.from(
          { length: 8192 },
          (_, i) =>
            0.4 * Math.sin((2 * Math.PI * frequency * i) / rate) +
            0.15 * Math.sin((4 * Math.PI * frequency * i) / rate),
        );
        const measured = detectPitch(signal, rate);
        expect(measured).not.toBeNull();
        expect(Math.abs(1200 * Math.log2(measured! / frequency))).toBeLessThan(
          4,
        );
      }
    }
  });
  it('rejects silence, DC, nonfinite samples and noise; handles calibration', () => {
    expect(detectPitch(new Float32Array(4096), 48000)).toBeNull();
    expect(detectPitch(new Float32Array(4096).fill(0.5), 48000)).toBeNull();
    expect(detectPitch(new Float32Array(4096).fill(NaN), 48000)).toBeNull();
    let seed = 13;
    const noise = Float32Array.from({ length: 4096 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      return seed / 2147483648;
    });
    expect(detectPitch(noise, 48000)).toBeNull();
    expect(describePitch(442, 442)).toMatchObject({
      note: 'A',
      octave: 4,
      cents: 0,
    });
    expect(describePitch(440 * 2 ** (25 / 1200))?.cents).toBeCloseTo(25);
    expect(describePitch(NaN)).toBeNull();
  });
});
