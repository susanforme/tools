import { expect, test } from 'vitest';
import {
  duplicateTimelineClip,
  extractTimelineAudio,
  isEditorProjectState,
  isWebAvCompatibleFile,
  moveTimelineClip,
  normalizeEditorProjectState,
  resolveExportConfig,
  timelineDuration,
} from './webav-editor';

test('validates persisted OPFS editor state before restoring it', () => {
  expect(
    isEditorProjectState({
      version: 2,
      name: 'Draft',
      playhead: 1,
      zoom: 50,
      assets: [],
      clips: [],
      exportSettings: {
        resolution: 'source',
        fps: 30,
        quality: 'balanced',
      },
    }),
  ).toBe(true);
  expect(
    normalizeEditorProjectState({
      version: 1,
      name: 'Old draft',
      playhead: 0,
      zoom: 50,
      assets: [],
      clips: [],
    })?.exportSettings,
  ).toEqual({ resolution: 'source', fps: 30, quality: 'balanced' });
  expect(isEditorProjectState({ version: 2, assets: 'broken' })).toBe(false);
});

test('maps export presets to an even WebCodecs configuration', () => {
  const asset = {
    id: 'asset',
    storageName: 'video.mp4',
    name: 'video.mp4',
    kind: 'video' as const,
    mimeType: 'video/mp4',
    size: 1,
    duration: 4,
    width: 3840,
    height: 2160,
  };
  expect(
    resolveExportConfig(asset, {
      resolution: '1080p',
      fps: 30,
      quality: 'balanced',
    }),
  ).toEqual({ width: 1920, height: 1080, fps: 30, bitrate: 6_220_800 });
});

test('accepts MP4 files for WebAV MP4Clip', () => {
  expect(
    isWebAvCompatibleFile(new File([''], 'clip.mp4', { type: 'video/mp4' })),
  ).toBe(true);
  expect(
    isWebAvCompatibleFile(new File([''], 'clip.mp3', { type: 'audio/mpeg' })),
  ).toBe(true);
  expect(
    isWebAvCompatibleFile(new File([''], 'clip.webm', { type: 'video/webm' })),
  ).toBe(false);
});

test('moves clips on a multi-track timeline without negative offsets', () => {
  const clip = {
    id: 'clip',
    assetId: 'asset',
    kind: 'video' as const,
    offset: 0,
    sourceStart: 0,
    duration: 4,
  };
  expect(moveTimelineClip(clip, 1.234).offset).toBe(1.25);
  expect(moveTimelineClip(clip, -2).offset).toBe(0);
  expect(timelineDuration([clip, { ...clip, id: 'two', offset: 6 }])).toBe(10);
});

test('copies clips and extracts audio without duplicating the source asset', () => {
  const clip = {
    id: 'clip',
    assetId: 'asset',
    kind: 'video' as const,
    offset: 2,
    sourceStart: 1,
    duration: 4,
  };
  const duplicate = duplicateTimelineClip(clip);
  const extracted = extractTimelineAudio(clip);

  expect(duplicate).toMatchObject({ assetId: 'asset', offset: 6 });
  expect(duplicate.id).not.toBe(clip.id);
  expect(extracted.video.muted).toBe(true);
  expect(extracted.audio).toMatchObject({
    assetId: 'asset',
    kind: 'audio',
    offset: 2,
    sourceStart: 1,
    duration: 4,
  });
});
