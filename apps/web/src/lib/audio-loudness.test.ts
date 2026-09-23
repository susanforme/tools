import { describe, expect, it } from 'vitest';
import { analyzeAudioLoudness } from './audio-loudness';

describe('audio loudness', () => {
  it('applies relative level consistently and finds inter-sample peak', () => {
    const sampleRate = 48000;
    const wave = Float32Array.from({ length: sampleRate }, (_, index) =>
      Math.sin((2 * Math.PI * 1000 * index) / sampleRate),
    );
    const full = analyzeAudioLoudness([wave], sampleRate);
    const half = analyzeAudioLoudness(
      [wave.map((value) => value / 2)],
      sampleRate,
    );
    expect(full.lufs - half.lufs).toBeCloseTo(6.0206, 1);
    expect(full.truePeakDb).toBeGreaterThanOrEqual(-0.1);
    expect(half.truePeakDb).toBeCloseTo(-6.02, 1);
  });
});
