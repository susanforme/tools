import ffmpegCoreURL from '@ffmpeg/core?url';
import ffmpegWasmURL from '@ffmpeg/core/wasm?url';
import ffmpegMtCoreURL from '@ffmpeg/core-mt?url';
import ffmpegMtWasmURL from '@ffmpeg/core-mt/wasm?url';
import ffmpegMtWorkerURL from '@ffmpeg/core-mt/worker?url';
import type { FFmpeg, FFFSType } from '@ffmpeg/ffmpeg';

export const FFMPEG_EXPORT_FORMATS = [
  'mp4',
  'webm',
  'mov',
  'mkv',
  'avi',
  'ts',
] as const;

export type FfmpegExportFormat = (typeof FFMPEG_EXPORT_FORMATS)[number];

export interface FfmpegExportOptions {
  format: FfmpegExportFormat;
  width?: number;
  height?: number;
  fps?: number;
  videoBitrateKbps?: number;
  audioBitrateKbps?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
let exporting = false;

export function supportsFfmpegMultiThread(
  isolated = globalThis.crossOriginIsolated,
  hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined',
): boolean {
  return isolated === true && hasSharedArrayBuffer;
}

function positiveInteger(value: number | undefined, label: string): void {
  if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
    throw new Error(`${label}必须是正整数`);
  }
}

export function buildFfmpegExportArgs(
  inputPath: string,
  outputPath: string,
  options: FfmpegExportOptions,
): string[] {
  positiveInteger(options.width, '宽度');
  positiveInteger(options.height, '高度');
  positiveInteger(options.fps, '帧率');
  positiveInteger(options.videoBitrateKbps, '视频码率');
  positiveInteger(options.audioBitrateKbps, '音频码率');
  if ((options.width === undefined) !== (options.height === undefined)) {
    throw new Error('宽度和高度必须同时设置');
  }

  const filters: string[] = [];
  if (options.width !== undefined && options.height !== undefined) {
    filters.push(
      `scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease`,
      `pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2`,
    );
  }
  if (options.fps !== undefined) filters.push(`fps=${options.fps}`);

  const args = ['-i', inputPath, '-map', '0:v:0?', '-map', '0:a:0?'];
  if (filters.length > 0) args.push('-vf', filters.join(','));
  if (options.videoBitrateKbps !== undefined) {
    args.push('-b:v', `${options.videoBitrateKbps}k`);
  }
  if (options.audioBitrateKbps !== undefined) {
    args.push('-b:a', `${options.audioBitrateKbps}k`);
  }

  if (options.format === 'webm') {
    args.push(
      '-c:v',
      'libvpx-vp9',
      '-deadline',
      'realtime',
      '-cpu-used',
      '4',
      '-c:a',
      'libopus',
    );
  } else if (options.format === 'avi') {
    args.push('-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'libmp3lame');
  } else {
    args.push(
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
    );
    if (options.format === 'mp4' || options.format === 'mov') {
      args.push('-movflags', '+faststart');
    }
    if (options.format === 'ts') args.push('-f', 'mpegts');
  }
  args.push(outputPath);
  return args;
}

async function getFfmpeg(): Promise<FFmpeg> {
  if (ffmpeg?.loaded) return ffmpeg;
  if (loading) return loading;
  loading = import('@ffmpeg/ffmpeg').then(async ({ FFmpeg }) => {
    if (supportsFfmpegMultiThread()) {
      const instance = new FFmpeg();
      ffmpeg = instance;
      try {
        await instance.load({
          coreURL: ffmpegMtCoreURL,
          wasmURL: ffmpegMtWasmURL,
          workerURL: ffmpegMtWorkerURL,
        });
        return instance;
      } catch {
        instance.terminate();
        if (ffmpeg === instance) ffmpeg = null;
      }
    }
    const fallback = new FFmpeg();
    ffmpeg = fallback;
    await fallback.load({ coreURL: ffmpegCoreURL, wasmURL: ffmpegWasmURL });
    return fallback;
  });
  try {
    return await loading;
  } catch (cause) {
    ffmpeg?.terminate();
    ffmpeg = null;
    throw cause;
  } finally {
    loading = null;
  }
}

export function disposeFfmpegExporter(): void {
  ffmpeg?.terminate();
  ffmpeg = null;
  loading = null;
}

export async function exportWithFfmpeg(
  source: File,
  target: FileSystemFileHandle,
  options: FfmpegExportOptions,
): Promise<File> {
  if (exporting) throw new Error('已有导出任务正在运行');
  if (options.signal?.aborted) throw options.signal.reason;
  exporting = true;
  const mountPoint = `/input-${crypto.randomUUID()}`;
  const inputName = `source${source.name.match(/\.[a-z0-9]+$/i)?.[0] ?? ''}`;
  const outputPath = `/output-${crypto.randomUUID()}.${options.format}`;
  let instance: FFmpeg | null = null;
  const abort = () => disposeFfmpegExporter();
  options.signal?.addEventListener('abort', abort, { once: true });

  try {
    options.onProgress?.(0);
    instance = await getFfmpeg();
    if (options.signal?.aborted) throw options.signal.reason;
    const progress = ({ progress }: { progress: number }) =>
      options.onProgress?.(Math.min(0.95, Math.max(0, progress) * 0.95));
    instance.on('progress', progress);
    try {
      await instance.createDir(mountPoint);
      await instance.mount(
        'WORKERFS' as FFFSType,
        { blobs: [{ name: inputName, data: source }] },
        mountPoint,
      );
      const exitCode = await instance.exec(
        buildFfmpegExportArgs(
          `${mountPoint}/${inputName}`,
          outputPath,
          options,
        ),
        options.timeoutMs ?? -1,
        { signal: options.signal },
      );
      if (exitCode !== 0) throw new Error(`FFmpeg 导出失败（${exitCode}）`);
      const data = await instance.readFile(outputPath, undefined, {
        signal: options.signal,
      });
      if (!(data instanceof Uint8Array)) throw new Error('FFmpeg 输出无效');
      const writable = await target.createWritable();
      try {
        await writable.write(data as Uint8Array<ArrayBuffer>);
        await writable.close();
      } catch (cause) {
        await writable.abort(cause).catch(() => undefined);
        throw cause;
      }
      options.onProgress?.(1);
      return target.getFile();
    } finally {
      instance.off('progress', progress);
    }
  } finally {
    options.signal?.removeEventListener('abort', abort);
    if (instance?.loaded) {
      await instance.deleteFile(outputPath).catch(() => undefined);
      await instance.unmount(mountPoint).catch(() => undefined);
      await instance.deleteDir(mountPoint).catch(() => undefined);
    }
    exporting = false;
  }
}

export function convertVideoToEditorMp4(
  source: File,
  target: FileSystemFileHandle,
  options: Pick<FfmpegExportOptions, 'signal' | 'onProgress'> = {},
): Promise<File> {
  return exportWithFfmpeg(source, target, { ...options, format: 'mp4' });
}
