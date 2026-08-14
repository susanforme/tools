import { describe, expect, it } from 'vitest';
import {
  buildFfmpegExportArgs,
  getFfmpegCoreAssetUrl,
  supportsFfmpegMultiThread,
} from './ffmpeg-export';

describe('buildFfmpegExportArgs', () => {
  it('prefers multi-thread only in a cross-origin isolated environment', () => {
    expect(supportsFfmpegMultiThread(true, true)).toBe(true);
    expect(supportsFfmpegMultiThread(false, true)).toBe(false);
    expect(supportsFfmpegMultiThread(true, false)).toBe(false);
  });

  it('loads version-pinned FFmpeg cores from the CDN', () => {
    expect(getFfmpegCoreAssetUrl(true, 'ffmpeg-core.wasm')).toBe(
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.10/dist/umd/ffmpeg-core.wasm',
    );
    expect(getFfmpegCoreAssetUrl(false, 'ffmpeg-core.js')).toBe(
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js',
    );
  });

  it('builds a constrained WebM export command', () => {
    expect(
      buildFfmpegExportArgs('/input/source.mp4', '/output.webm', {
        format: 'webm',
        width: 1280,
        height: 720,
        fps: 30,
        videoBitrateKbps: 2_500,
        audioBitrateKbps: 128,
      }),
    ).toEqual([
      '-i',
      '/input/source.mp4',
      '-map',
      '0:v:0?',
      '-map',
      '0:a:0?',
      '-vf',
      'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30',
      '-b:v',
      '2500k',
      '-b:a',
      '128k',
      '-c:v',
      'libvpx-vp9',
      '-deadline',
      'realtime',
      '-cpu-used',
      '4',
      '-c:a',
      'libopus',
      '/output.webm',
    ]);
  });

  it('rejects an incomplete resolution', () => {
    expect(() =>
      buildFfmpegExportArgs('/input.mp4', '/output.mp4', {
        format: 'mp4',
        width: 1280,
      }),
    ).toThrow('宽度和高度必须同时设置');
  });

  it('uses container-compatible codecs for AVI', () => {
    expect(
      buildFfmpegExportArgs('/input.mp4', '/output.avi', {
        format: 'avi',
      }),
    ).toEqual(expect.arrayContaining(['-c:v', 'mpeg4', '-c:a', 'libmp3lame']));
  });
});
