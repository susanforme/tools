import { describe, expect, it } from 'vitest';
import {
  getRecordingCleanupPlan,
  getRecordingExtension,
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
});
