import { describe, expect, it } from 'vitest';
import {
  getRecordingCleanupPlan,
  getRecordingExtension,
  getRecommendedScreenRecordingBitrate,
  getScreenCaptureVideoConstraints,
} from './screen-recordings';

describe('screen recording file extension', () => {
  it('matches the selected container', () => {
    expect(getRecordingExtension('video/webm;codecs=vp9,opus')).toBe('webm');
    expect(getRecordingExtension('video/mp4')).toBe('mp4');
  });

  it('removes interrupted files and stale metadata', () => {
    expect(
      getRecordingCleanupPlan(
        [
          { id: 'kept', fileName: 'kept.webm' },
          { id: 'missing', fileName: 'missing.webm' },
        ],
        ['kept.webm', 'interrupted.webm'],
      ),
    ).toEqual({
      orphanFiles: ['interrupted.webm'],
      missingRecordIds: ['missing'],
    });
  });

  it('keeps auto capture unconstrained and caps explicit quality', () => {
    expect(getScreenCaptureVideoConstraints('auto', 'auto')).toEqual({});
    expect(getScreenCaptureVideoConstraints('', '')).toEqual({});
    expect(getScreenCaptureVideoConstraints('2560x1080', '48')).toEqual({
      width: { ideal: 2560, max: 2560 },
      height: { ideal: 1080, max: 1080 },
      frameRate: { ideal: 48, max: 48 },
    });
    expect(() => getScreenCaptureVideoConstraints('invalid', 'auto')).toThrow(
      'INVALID_CAPTURE_RESOLUTION',
    );
    expect(() => getScreenCaptureVideoConstraints('1920x1080', '0')).toThrow(
      'INVALID_CAPTURE_FRAME_RATE',
    );
  });

  it('recommends bitrate from captured resolution and frame rate', () => {
    expect(getRecommendedScreenRecordingBitrate(1280, 720, 30)).toBe(5_000_000);
    expect(getRecommendedScreenRecordingBitrate(1920, 1080, 60)).toBe(
      12_000_000,
    );
    expect(getRecommendedScreenRecordingBitrate(2560, 1440, 30)).toBe(
      16_000_000,
    );
    expect(getRecommendedScreenRecordingBitrate(3840, 2160, 60)).toBe(
      60_000_000,
    );
  });
});
