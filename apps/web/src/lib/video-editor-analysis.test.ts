import { describe, expect, it } from 'vitest';
import {
  accumulateWaveformPeaks,
  analyzeEditorAsset,
} from './video-editor-analysis';

describe('accumulateWaveformPeaks', () => {
  it('combines channels and places samples on the media clock', () => {
    const peaks = new Float32Array(4);
    accumulateWaveformPeaks(
      peaks,
      2,
      1,
      2,
      2,
      new Float32Array([0.2, -0.7, -0.4, 0.1]),
    );
    expect(peaks[0]).toBe(0);
    expect(peaks[1]).toBe(0);
    expect(peaks[2]).toBeCloseTo(0.7);
    expect(peaks[3]).toBeCloseTo(0.4);
  });

  it('rejects non-media assets before starting a worker', async () => {
    await expect(
      analyzeEditorAsset('current', {
        id: 'font',
        storageName: 'font.ttf',
        name: 'font.ttf',
        kind: 'font',
        mimeType: 'font/ttf',
        size: 1,
        duration: 0,
        width: 0,
        height: 0,
      }),
    ).rejects.toThrow('MEDIA_ASSET_REQUIRED');
  });
});
