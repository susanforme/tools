import type { ScreenRecording } from './db';

export type ScreenRecordingWorkerCommand =
  | { type: 'open'; fileName: string }
  | { type: 'write'; chunk: Blob }
  | { type: 'close' }
  | { type: 'abort' }
  | { type: 'read'; fileName: string }
  | { type: 'delete'; fileName: string }
  | {
      type: 'cleanup';
      records: Pick<ScreenRecording, 'id' | 'fileName'>[];
    };

export type ScreenRecordingWorkerRequest = ScreenRecordingWorkerCommand & {
  id: number;
};

export type ScreenRecordingWorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

export const SCREEN_RECORDING_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
] as const;

export const AUDIO_RECORDING_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/webm',
] as const;

export function getScreenCaptureVideoConstraints(
  resolution: string,
  frameRate: string,
): MediaTrackConstraints {
  const constraints: MediaTrackConstraints = {};
  const normalizedResolution = resolution.trim().toLowerCase();
  if (normalizedResolution && normalizedResolution !== 'auto') {
    const match = resolution.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i);
    const width = Number(match?.[1]);
    const height = Number(match?.[2]);
    if (
      !Number.isSafeInteger(width) ||
      width <= 0 ||
      !Number.isSafeInteger(height) ||
      height <= 0
    )
      throw new Error('INVALID_CAPTURE_RESOLUTION');
    constraints.width = { ideal: width, max: width };
    constraints.height = { ideal: height, max: height };
  }
  const normalizedFrameRate = frameRate.trim().toLowerCase();
  if (normalizedFrameRate && normalizedFrameRate !== 'auto') {
    const value = Number(frameRate);
    if (!Number.isFinite(value) || value <= 0)
      throw new Error('INVALID_CAPTURE_FRAME_RATE');
    constraints.frameRate = { ideal: value, max: value };
  }
  return constraints;
}

export function getRecommendedScreenRecordingBitrate(
  width: number,
  height: number,
  frameRate: number,
): number {
  const pixels = width * height;
  const highFrameRate = frameRate > 30;
  const mbps =
    pixels >= 3840 * 2160
      ? highFrameRate
        ? 60
        : 40
      : pixels >= 2560 * 1440
        ? highFrameRate
          ? 24
          : 16
        : pixels >= 1920 * 1080
          ? highFrameRate
            ? 12
            : 8
          : pixels >= 1280 * 720
            ? highFrameRate
              ? 7.5
              : 5
            : highFrameRate
              ? 4
              : 2.5;
  return mbps * 1_000_000;
}

export function getSupportedRecordingMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return (
    SCREEN_RECORDING_MIME_TYPES.find((type) =>
      MediaRecorder.isTypeSupported(type),
    ) ?? null
  );
}

export function getRecordingExtension(mimeType: string): 'mp4' | 'webm' {
  return mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
}

export function getSupportedAudioRecordingMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return (
    AUDIO_RECORDING_MIME_TYPES.find((type) =>
      MediaRecorder.isTypeSupported(type),
    ) ?? null
  );
}

export function getAudioRecordingExtension(
  mimeType: string,
): 'm4a' | 'ogg' | 'webm' {
  if (mimeType.startsWith('audio/mp4')) return 'm4a';
  if (mimeType.startsWith('audio/ogg')) return 'ogg';
  return 'webm';
}

export function isAudioRecordingSupported(): boolean {
  return Boolean(
    window.isSecureContext &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof navigator.storage?.getDirectory === 'function' &&
    getSupportedAudioRecordingMimeType(),
  );
}

export function formatRecordingDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0
    ? [hours, minutes, rest]
        .map((value) => String(value).padStart(2, '0'))
        .join(':')
    : [minutes, rest].map((value) => String(value).padStart(2, '0')).join(':');
}

export function formatRecordingSize(size: number): string {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function getRecordingCleanupPlan(
  records: Pick<ScreenRecording, 'id' | 'fileName'>[],
  fileNames: Iterable<string>,
) {
  const existingFiles = new Set(fileNames);
  const referencedFiles = new Set(records.map((record) => record.fileName));
  return {
    orphanFiles: [...existingFiles].filter(
      (name) => !referencedFiles.has(name),
    ),
    missingRecordIds: records
      .filter((record) => !existingFiles.has(record.fileName))
      .map((record) => record.id),
  };
}

export function isScreenRecordingSupported(): boolean {
  return Boolean(
    window.isSecureContext &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function' &&
    typeof navigator.storage?.getDirectory === 'function' &&
    getSupportedRecordingMimeType(),
  );
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (cause: Error) => void;
};

export class ScreenRecordingWorkerClient {
  private readonly worker = new Worker(
    new URL('../workers/screen-recorder.worker.ts', import.meta.url),
    { type: 'module' },
  );
  private readonly pending = new Map<number, PendingRequest>();
  private nextId = 1;

  constructor() {
    this.worker.addEventListener(
      'message',
      (event: MessageEvent<ScreenRecordingWorkerResponse>) => {
        const response = event.data;
        const pending = this.pending.get(response.id);
        if (!pending) return;
        this.pending.delete(response.id);
        if (response.ok) {
          pending.resolve(response.result);
        } else {
          pending.reject(new Error(response.error));
        }
      },
    );
    this.worker.addEventListener('error', (event) => {
      const error = new Error(
        event.message || 'Screen recording worker failed',
      );
      this.pending.forEach(({ reject }) => reject(error));
      this.pending.clear();
    });
  }

  open(fileName: string): Promise<void> {
    return this.request({ type: 'open', fileName });
  }

  write(chunk: Blob): Promise<void> {
    return this.request({ type: 'write', chunk });
  }

  close(): Promise<{ size: number }> {
    return this.request({ type: 'close' });
  }

  abort(): Promise<void> {
    return this.request({ type: 'abort' });
  }

  read(fileName: string): Promise<File> {
    return this.request({ type: 'read', fileName });
  }

  delete(fileName: string): Promise<void> {
    return this.request({ type: 'delete', fileName });
  }

  cleanup(
    records: Pick<ScreenRecording, 'id' | 'fileName'>[],
  ): Promise<string[]> {
    return this.request({ type: 'cleanup', records });
  }

  terminate(): void {
    this.worker.terminate();
    this.pending.forEach(({ reject }) =>
      reject(new Error('Screen recording worker terminated')),
    );
    this.pending.clear();
  }

  private request<T>(command: ScreenRecordingWorkerCommand): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.worker.postMessage({ ...command, id });
    });
  }
}
