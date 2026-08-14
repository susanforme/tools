import { describe, expect, it } from 'vitest';
import { normalizeVideoEditorPreferences } from './video-editor-preferences';

describe('video editor preferences', () => {
  it('normalizes persisted layout values', () => {
    expect(
      normalizeVideoEditorPreferences({
        layoutVersion: 2,
        panelOrder: ['properties', 'properties', 'unknown', 'assets'],
        panelSizes: { assets: 20, preview: 60, properties: 20 },
        timelineSize: 1_000,
        snapping: false,
      }),
    ).toEqual({
      layoutVersion: 2,
      panelOrder: ['properties', 'assets', 'preview'],
      panelSizes: { assets: 20, preview: 60, properties: 20 },
      timelineSize: 55,
      snapping: false,
    });
  });

  it('replaces legacy pixel sizes with responsive percentages', () => {
    expect(
      normalizeVideoEditorPreferences({
        panelSizes: { assets: 300, preview: 720, properties: 280 },
        timelineHeight: 216,
      }),
    ).toMatchObject({
      layoutVersion: 2,
      panelSizes: { assets: 22, preview: 56, properties: 22 },
      timelineSize: 30,
    });
  });
});
