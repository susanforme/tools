import { describe, expect, it, vi } from 'vitest';
import * as cdnAssets from './cdn-asset-cache';
import {
  buildFfmpegExportArgs,
  disposeFfmpegExporter,
  exportWithFfmpeg,
  getFfmpegCoreAssetUrl,
  supportsFfmpegMultiThread,
} from './ffmpeg-export';

describe('buildFfmpegExportArgs', () => {
  it('uses and releases a same-origin worker entry for CDN imports', async () => {
    const load = vi.fn().mockRejectedValue(new Error('CORE_FAILED'));
    vi.doMock('@ffmpeg/ffmpeg', () => ({
      FFmpeg: class {
        load = load;
        terminate() {}
      },
    }));
    vi.stubEnv('PROD', true);
    vi.stubGlobal('crossOriginIsolated', false);
    vi.spyOn(cdnAssets, 'loadCachedCdnAssetUrl').mockResolvedValue('blob:core');
    const createUrl = vi.spyOn(URL, 'createObjectURL');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL');
    try {
      await expect(
        exportWithFfmpeg(
          new File([], 'source.mp4'),
          {} as FileSystemFileHandle,
          { format: 'mp4' },
        ),
      ).rejects.toThrow('CORE_FAILED');
      const workerUrl = load.mock.calls[0][0].classWorkerURL as string;
      expect(workerUrl).toMatch(/^blob:/);
      expect(await (createUrl.mock.calls[0][0] as Blob).text()).toBe(
        "import 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/worker.js';",
      );
      disposeFfmpegExporter();
      expect(revokeUrl).toHaveBeenCalledWith(workerUrl);
    } finally {
      disposeFfmpegExporter();
      vi.doUnmock('@ffmpeg/ffmpeg');
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it('prefers multi-thread only in a cross-origin isolated environment', () => {
    expect(supportsFfmpegMultiThread(true, true)).toBe(true);
    expect(supportsFfmpegMultiThread(false, true)).toBe(false);
    expect(supportsFfmpegMultiThread(true, false)).toBe(false);
  });

  it('loads version-pinned FFmpeg cores from the CDN', () => {
    expect(getFfmpegCoreAssetUrl(true, 'ffmpeg-core.wasm')).toBe(
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.10/dist/esm/ffmpeg-core.wasm',
    );
    expect(getFfmpegCoreAssetUrl(false, 'ffmpeg-core.js')).toBe(
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js',
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
      '-threads',
      '4',
      '-vf',
      'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30',
      '-b:v',
      '2500k',
      '-b:a',
      '128k',
      '-c:v',
      'libvpx',
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
    const args = buildFfmpegExportArgs('/input.mp4', '/output.avi', {
      format: 'avi',
      videoBitrateKbps: 6_000,
    });
    expect(args).toEqual(
      expect.arrayContaining([
        '-b:v',
        '6000k',
        '-threads',
        '4',
        '-c:v',
        'mpeg4',
        '-c:a',
        'libmp3lame',
      ]),
    );
    expect(args).not.toContain('-q:v');
  });

  it('limits every FFmpeg export to four threads', () => {
    for (const format of ['mp4', 'mov', 'mkv', 'avi', 'ts'] as const) {
      expect(
        buildFfmpegExportArgs('/input.mp4', `/output.${format}`, { format }),
      ).toEqual(expect.arrayContaining(['-threads', '4']));
    }
  });
});
