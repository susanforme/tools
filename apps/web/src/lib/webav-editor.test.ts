import { expect, test, vi } from 'vitest';
import {
  clearEditorProject,
  DEFAULT_EXPORT_SETTINGS,
  DEFAULT_SUBTITLE_STYLE,
  duplicateTimelineClip,
  extractTimelineAudio,
  isEditorProjectState,
  isWebAvCompatibleFile,
  moveTimelineClip,
  normalizeEditorProjectState,
  resolveExportConfig,
  snapTimelineClip,
  timelineDuration,
} from './webav-editor';

test('clears only the current editor session directory', async () => {
  const removeEntry = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', {
    storage: {
      getDirectory: async () => ({
        getDirectoryHandle: async () => ({ removeEntry }),
      }),
    },
  });

  await clearEditorProject('current');

  expect(removeEntry).toHaveBeenCalledWith('current', { recursive: true });
  vi.unstubAllGlobals();
});

test('validates persisted OPFS editor state before restoring it', () => {
  expect(
    isEditorProjectState({
      version: 3,
      name: 'Draft',
      playhead: 1,
      zoom: 50,
      assets: [],
      clips: [],
      tracks: [],
      subtitles: [],
      subtitleStyle: DEFAULT_SUBTITLE_STYLE,
      exportSettings: {
        ...DEFAULT_EXPORT_SETTINGS,
        format: 'webm',
      },
    }),
  ).toBe(true);
  expect(isEditorProjectState({ version: 3, assets: 'broken' })).toBe(false);

  expect(
    normalizeEditorProjectState({
      version: 3,
      name: 'GIF draft',
      playhead: 0,
      zoom: 50,
      assets: [],
      clips: [],
      tracks: [],
      subtitles: [],
      subtitleStyle: DEFAULT_SUBTITLE_STYLE,
      exportSettings: { ...DEFAULT_EXPORT_SETTINGS, format: 'gif' },
    })?.exportSettings.format,
  ).toBe('mp4');
});

test('migrates legacy projects to tracks and expanded export settings', () => {
  const migrated = normalizeEditorProjectState({
    version: 2,
    name: 'Old draft',
    playhead: 0,
    zoom: 50,
    assets: [],
    clips: [
      {
        id: 'video-clip',
        assetId: 'video',
        kind: 'video',
        offset: 0,
        sourceStart: 0,
        duration: 4,
      },
      {
        id: 'audio-clip',
        assetId: 'video',
        kind: 'audio',
        offset: 0,
        sourceStart: 0,
        duration: 4,
      },
    ],
    exportSettings: {
      resolution: '720p',
      fps: 24,
      quality: 'high',
    },
  });

  expect(migrated).toMatchObject({
    version: 3,
    subtitles: [],
    subtitleStyle: DEFAULT_SUBTITLE_STYLE,
    exportSettings: {
      ...DEFAULT_EXPORT_SETTINGS,
      resolution: '720p',
      fps: 24,
      quality: 'high',
    },
  });
  const videoTrack = migrated?.tracks.find(({ kind }) => kind === 'video');
  expect(migrated?.clips[0]?.trackId).toBe(videoTrack?.id);
  expect(migrated?.clips[0]?.linkGroupId).toBe(migrated?.clips[1]?.linkGroupId);
  expect(migrated?.tracks.filter(({ kind }) => kind === 'audio')).toHaveLength(
    3,
  );
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
      ...DEFAULT_EXPORT_SETTINGS,
      resolution: '1080p',
      fps: 30,
      quality: 'balanced',
    }),
  ).toEqual({ width: 1920, height: 1080, fps: 30, bitrate: 6_000_000 });
});

test('accepts videos that can be normalized for WebAV MP4Clip', () => {
  expect(
    isWebAvCompatibleFile(new File([''], 'clip.mp4', { type: 'video/mp4' })),
  ).toBe(true);
  expect(
    isWebAvCompatibleFile(new File([''], 'clip.mp3', { type: 'audio/mpeg' })),
  ).toBe(true);
  expect(
    isWebAvCompatibleFile(new File([''], 'clip.webm', { type: 'video/webm' })),
  ).toBe(true);
  expect(
    isWebAvCompatibleFile(
      new File([''], 'clip.mkv', { type: 'application/octet-stream' }),
    ),
  ).toBe(true);
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
  expect(moveTimelineClip(clip, 1.2, 24).offset).toBeCloseTo(29 / 24);
  expect(moveTimelineClip(clip, -2).offset).toBe(0);
  expect(timelineDuration([clip, { ...clip, id: 'two', offset: 6 }])).toBe(10);
});

test('snaps clip edges to nearby timeline targets', () => {
  const clip = {
    id: 'moving',
    assetId: 'asset',
    kind: 'video' as const,
    offset: 0,
    sourceStart: 0,
    duration: 2,
  };
  const clips = [clip, { ...clip, id: 'previous', offset: 0, duration: 5 }];

  const snapped = snapTimelineClip(clip, 5.06, clips, 100, 8);
  expect(snapped.offset).toBeCloseTo(5);
  expect(snapped.guide).toBe(5);
  expect(snapTimelineClip(clip, 5.2, clips, 100, 8)).toEqual({
    offset: 5.2,
    guide: null,
  });
  const linked = { ...clip, offset: 10, linkGroupId: 'av' };
  expect(
    snapTimelineClip(
      linked,
      10.04,
      [linked, { ...linked, id: 'audio', kind: 'audio' }],
      100,
      0,
    ),
  ).toEqual({ offset: 10.04, guide: null });
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
  expect(duplicate.linkGroupId).toBeUndefined();
  expect(extracted.video.muted).toBe(true);
  expect(extracted.video.linkGroupId).toBe(extracted.audio.linkGroupId);
  expect(extracted.audio).toMatchObject({
    assetId: 'asset',
    kind: 'audio',
    offset: 2,
    sourceStart: 1,
    duration: 4,
  });
});
