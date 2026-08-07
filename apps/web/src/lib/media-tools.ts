export const MEDIA_TOOLS_DIRECTORY = 'media-tools';
export const MAX_MEDIA_FILE_SIZE = 1024 * 1024 * 1024;

export type MediaTrackInfo = {
  type: 'video' | 'audio' | 'subtitle';
  codec: string;
  duration: number;
  bitrate: number | null;
  width?: number;
  height?: number;
  rotation?: number;
  frameRate?: number;
  channels?: number;
  sampleRate?: number;
};

export type MediaInfo = {
  duration: number;
  mimeType: string;
  tracks: MediaTrackInfo[];
  tags: Array<{ key: string; value: string }>;
};

export type SubtitleCue = {
  start: number;
  end: number;
  text: string;
};

export type MediaWorkerRequest =
  | { type: 'inspect'; file: File }
  | { type: 'cleanup' }
  | {
      type: 'video-transform';
      file: File;
      rotation: 0 | 90 | 180 | 270;
      aspect: 'original' | '16:9' | '9:16' | '1:1';
      mute: boolean;
      clearMetadata: boolean;
    }
  | { type: 'merge-video'; files: File[] }
  | { type: 'extract-audio'; file: File }
  | { type: 'replace-audio'; video: File; audio: File }
  | { type: 'thumbnail'; file: File; timestamp: number }
  | {
      type: 'video-animation';
      file: File;
      format: 'gif' | 'webp';
      start: number;
      end: number;
      frameRate: number;
      maxWidth: number;
      quality: number;
    }
  | { type: 'waveform'; file: File; buckets: number }
  | { type: 'trim-audio'; file: File; start: number; end: number }
  | { type: 'merge-audio'; files: File[] }
  | { type: 'burn-subtitles'; file: File; cues: SubtitleCue[] };

export type StoredMediaResult = {
  fileName: string;
  mimeType: string;
  size: number;
};

export type MediaWorkerResponse =
  | { type: 'progress'; progress: number }
  | { type: 'inspected'; info: MediaInfo }
  | { type: 'stored'; result: StoredMediaResult }
  | {
      type: 'blob';
      blob: Blob;
      fileName: string;
      frameCount?: number;
    }
  | { type: 'waveform'; peaks: number[]; duration: number }
  | { type: 'cleaned' }
  | { type: 'error'; error: string };

export function runMediaWorker(
  request: MediaWorkerRequest,
  onProgress?: (progress: number) => void,
): Promise<Exclude<MediaWorkerResponse, { type: 'progress' | 'error' }>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/media-tools.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.onmessage = (event: MessageEvent<MediaWorkerResponse>) => {
      const response = event.data;
      if (response.type === 'progress') {
        onProgress?.(response.progress);
        return;
      }
      worker.terminate();
      if (response.type === 'error') reject(new Error(response.error));
      else resolve(response);
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('WORKER_FAILED'));
    };
    worker.postMessage(request);
  });
}

export async function readStoredMedia(fileName: string): Promise<File> {
  const root = await navigator.storage.getDirectory();
  const directory = await root.getDirectoryHandle(MEDIA_TOOLS_DIRECTORY, {
    create: true,
  });
  return (await directory.getFileHandle(fileName)).getFile();
}

export function formatMediaTime(value: number): string {
  const total = Math.max(0, Math.floor(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

export function formatMediaBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
