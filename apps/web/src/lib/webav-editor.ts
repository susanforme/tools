import { VIDEO_EDITOR_CONFIG } from './video-editor-config';

export type EditorAsset = {
  id: string;
  storageName: string;
  name: string;
  kind: 'video' | 'audio';
  mimeType: string;
  size: number;
  duration: number;
  width: number;
  height: number;
};

export type TimelineClip = {
  id: string;
  assetId: string;
  kind: EditorAsset['kind'];
  offset: number;
  sourceStart: number;
  duration: number;
  muted?: boolean;
  hidden?: boolean;
};

export type EditorTimeline = {
  assets: EditorAsset[];
  clips: TimelineClip[];
};

export type EditorExportSettings = {
  resolution: 'source' | '720p' | '1080p';
  fps: 24 | 30 | 60;
  quality: 'compact' | 'balanced' | 'high';
};

export type EditorProjectState = EditorTimeline & {
  version: 2;
  name: string;
  playhead: number;
  zoom: number;
  exportSettings: EditorExportSettings;
};

export type EditorThumbnail = { ts: number; file: File };

export type EditorExportConfig = {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
};

export type EditorWorkerRequest =
  | {
      id: string;
      type: 'thumbnails';
      sessionId: string;
      asset: EditorAsset;
    }
  | {
      id: string;
      type: 'export';
      sessionId: string;
      timeline: EditorTimeline;
      fileName: string;
      output: EditorExportConfig;
    };

type EditorWorkerCommand = EditorWorkerRequest extends infer Request
  ? Request extends { id: string }
    ? Omit<Request, 'id'>
    : never
  : never;

export type EditorWorkerResult =
  | {
      type: 'thumbnails';
      manifest: Array<{ name: string; ts: number }>;
    }
  | { type: 'export'; storageName: string };

export type EditorWorkerResponse =
  | { id: string; type: 'progress'; progress: number }
  | { id: string; type: 'done'; result: EditorWorkerResult }
  | { id: string; type: 'error'; error: string };

export const DEFAULT_EXPORT_SETTINGS: EditorExportSettings = {
  resolution: 'source',
  fps: 30,
  quality: 'balanced',
};

type PendingEditorWork = {
  resolve: (result: EditorWorkerResult) => void;
  reject: (reason: Error) => void;
  onProgress?: (progress: number) => void;
};

let editorWorker: Worker | null = null;
const pendingEditorWork = new Map<string, PendingEditorWork>();

function failEditorWorker(): void {
  for (const pending of pendingEditorWork.values()) {
    pending.reject(new Error('EDITOR_WORKER_FAILED'));
  }
  pendingEditorWork.clear();
  editorWorker?.terminate();
  editorWorker = null;
}

function getEditorWorker(): Worker {
  if (editorWorker) return editorWorker;
  editorWorker = new Worker(
    new URL('../workers/video-editor.worker.ts', import.meta.url),
    { type: 'module', name: 'video-editor' },
  );
  editorWorker.onmessage = (event: MessageEvent<EditorWorkerResponse>) => {
    const pending = pendingEditorWork.get(event.data.id);
    if (!pending) return;
    if (event.data.type === 'progress') {
      pending.onProgress?.(event.data.progress);
      return;
    }
    pendingEditorWork.delete(event.data.id);
    if (event.data.type === 'done') pending.resolve(event.data.result);
    else pending.reject(new Error(event.data.error));
  };
  editorWorker.onerror = failEditorWorker;
  editorWorker.onmessageerror = failEditorWorker;
  return editorWorker;
}

function runEditorWorker(
  request: EditorWorkerCommand,
  onProgress?: (progress: number) => void,
): Promise<EditorWorkerResult> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pendingEditorWork.set(id, { resolve, reject, onProgress });
    try {
      getEditorWorker().postMessage({ ...request, id } as EditorWorkerRequest);
    } catch (cause) {
      pendingEditorWork.delete(id);
      reject(cause instanceof Error ? cause : new Error(String(cause)));
    }
  });
}

export function isWebAvCompatibleFile(file: File): boolean {
  return (
    file.type.startsWith('audio/') ||
    file.type === 'video/mp4' ||
    file.name.toLowerCase().endsWith('.mp4')
  );
}

export function timelineDuration(clips: TimelineClip[]): number {
  return clips.reduce(
    (duration, clip) => Math.max(duration, clip.offset + clip.duration),
    0,
  );
}

export function moveTimelineClip(
  clip: TimelineClip,
  offset: number,
): TimelineClip {
  return { ...clip, offset: Math.max(0, Math.round(offset * 20) / 20) };
}

export function duplicateTimelineClip(
  clip: TimelineClip,
  offset = clip.offset + clip.duration,
): TimelineClip {
  return { ...clip, id: crypto.randomUUID(), offset };
}

export function extractTimelineAudio(clip: TimelineClip): {
  video: TimelineClip;
  audio: TimelineClip;
} {
  return {
    video: { ...clip, muted: true },
    audio: {
      ...clip,
      id: crypto.randomUUID(),
      kind: 'audio',
      muted: false,
      hidden: false,
    },
  };
}

async function getSessionDirectory(
  sessionId: string,
): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const editor = await root.getDirectoryHandle(
    VIDEO_EDITOR_CONFIG.rootDirectory,
    { create: true },
  );
  return editor.getDirectoryHandle(sessionId, { create: true });
}

async function probeMedia(
  file: File,
  kind: EditorAsset['kind'],
): Promise<{ duration: number; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  const media = document.createElement(kind === 'video' ? 'video' : 'audio');
  media.preload = 'metadata';
  media.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      media.onloadedmetadata = () => resolve();
      media.onerror = () => reject(new Error('UNSUPPORTED_MEDIA'));
    });
    if (!Number.isFinite(media.duration) || media.duration <= 0) {
      throw new Error('INVALID_DURATION');
    }
    return {
      duration: media.duration,
      width: media instanceof HTMLVideoElement ? media.videoWidth : 0,
      height: media instanceof HTMLVideoElement ? media.videoHeight : 0,
    };
  } finally {
    media.removeAttribute('src');
    media.load();
    URL.revokeObjectURL(url);
  }
}

export async function storeEditorAsset(
  sessionId: string,
  source: File,
): Promise<EditorAsset> {
  if (!isWebAvCompatibleFile(source)) throw new Error('UNSUPPORTED_MEDIA');
  const kind = source.type.startsWith('audio/') ? 'audio' : 'video';
  const directory = await getSessionDirectory(sessionId);
  const extension = source.name.match(/\.[a-z0-9]+$/i)?.[0] ?? '';
  const storageName = `${crypto.randomUUID()}${extension}`;
  const handle = await directory.getFileHandle(storageName, { create: true });
  const writable = await handle.createWritable();
  try {
    await source.stream().pipeTo(writable);
  } catch (cause) {
    await writable.abort().catch(() => undefined);
    await directory.removeEntry(storageName).catch(() => undefined);
    throw cause;
  }
  const stored = await handle.getFile();
  const metadata = await probeMedia(stored, kind);
  return {
    id: crypto.randomUUID(),
    storageName,
    name: source.name,
    kind,
    mimeType: source.type || stored.type,
    size: stored.size,
    ...metadata,
  };
}

export async function readEditorAsset(
  sessionId: string,
  asset: EditorAsset,
): Promise<File> {
  const directory = await getSessionDirectory(sessionId);
  return (await directory.getFileHandle(asset.storageName)).getFile();
}

export async function loadEditorThumbnails(
  sessionId: string,
  asset: EditorAsset,
): Promise<EditorThumbnail[]> {
  if (asset.kind !== 'video') return [];
  const session = await getSessionDirectory(sessionId);
  const root = await session.getDirectoryHandle(
    VIDEO_EDITOR_CONFIG.thumbnailDirectory,
    { create: true },
  );
  const directory = await root.getDirectoryHandle(asset.id, { create: true });
  const cached = await readThumbnailManifest(directory);
  if (cached?.length) {
    try {
      return await readThumbnailFiles(directory, cached);
    } catch {
      // 缓存文件不完整时重新生成。
    }
  }

  const source = await readEditorAsset(sessionId, asset);
  try {
    const result = await runEditorWorker({
      type: 'thumbnails',
      sessionId,
      asset,
    });
    if (result.type === 'thumbnails' && result.manifest.length > 0) {
      return await readThumbnailFiles(directory, result.manifest);
    }
  } catch {
    // WebCodecs/OffscreenCanvas 不可用时才回退到主线程媒体元素。
  }
  const manifest = [{ name: '0.jpg', ts: 0 }];
  const handle = await directory.getFileHandle(manifest[0].name, {
    create: true,
  });
  const fallback = await nativeVideoThumbnail(source, 96);
  await fallback.stream().pipeTo(await handle.createWritable());
  await writeThumbnailManifest(directory, manifest);
  return readThumbnailFiles(directory, manifest);
}

async function nativeVideoThumbnail(file: File, width: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('THUMBNAIL_DECODE_FAILED'));
    });
    const height = Math.max(
      1,
      Math.round((width * video.videoHeight) / video.videoWidth),
    );
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(video, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error('THUMBNAIL_ENCODE_FAILED')),
        'image/jpeg',
        0.75,
      ),
    );
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

async function readThumbnailManifest(
  directory: FileSystemDirectoryHandle,
): Promise<Array<{ name: string; ts: number }> | null> {
  try {
    const file = await (
      await directory.getFileHandle('manifest.json')
    ).getFile();
    const value = JSON.parse(await file.text()) as unknown;
    if (
      !Array.isArray(value) ||
      value.some(
        (item) =>
          !item ||
          typeof item !== 'object' ||
          typeof (item as Record<string, unknown>).name !== 'string' ||
          typeof (item as Record<string, unknown>).ts !== 'number',
      )
    )
      return null;
    return value as Array<{ name: string; ts: number }>;
  } catch {
    return null;
  }
}

async function writeThumbnailManifest(
  directory: FileSystemDirectoryHandle,
  manifest: Array<{ name: string; ts: number }>,
): Promise<void> {
  const handle = await directory.getFileHandle('manifest.json', {
    create: true,
  });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(manifest));
  await writable.close();
}

async function readThumbnailFiles(
  directory: FileSystemDirectoryHandle,
  manifest: Array<{ name: string; ts: number }>,
): Promise<EditorThumbnail[]> {
  return Promise.all(
    manifest.map(async ({ name, ts }) => ({
      ts,
      file: await (await directory.getFileHandle(name)).getFile(),
    })),
  );
}

export async function loadEditorProject(
  sessionId: string,
): Promise<EditorProjectState | null> {
  try {
    const directory = await getSessionDirectory(sessionId);
    const file = await (
      await directory.getFileHandle(VIDEO_EDITOR_CONFIG.projectFile)
    ).getFile();
    const value = JSON.parse(await file.text()) as unknown;
    return normalizeEditorProjectState(value);
  } catch {
    return null;
  }
}

export async function saveEditorProject(
  sessionId: string,
  project: EditorProjectState,
): Promise<void> {
  const directory = await getSessionDirectory(sessionId);
  const handle = await directory.getFileHandle(
    VIDEO_EDITOR_CONFIG.projectFile,
    { create: true },
  );
  const writable = await handle.createWritable();
  try {
    await writable.write(JSON.stringify(project));
    await writable.close();
  } catch (cause) {
    await writable.abort().catch(() => undefined);
    throw cause;
  }
}

export function isEditorProjectState(
  value: unknown,
): value is EditorProjectState {
  if (!value || typeof value !== 'object') return false;
  const project = value as Record<string, unknown>;
  return (
    project.version === 2 &&
    isEditorProjectData(project) &&
    isExportSettings(project.exportSettings)
  );
}

export function normalizeEditorProjectState(
  value: unknown,
): EditorProjectState | null {
  if (isEditorProjectState(value)) return value;
  if (!value || typeof value !== 'object') return null;
  const project = value as Record<string, unknown>;
  if (project.version !== 1 || !isEditorProjectData(project)) return null;
  return {
    ...(project as Omit<EditorProjectState, 'version' | 'exportSettings'>),
    version: 2,
    exportSettings: DEFAULT_EXPORT_SETTINGS,
  };
}

function isEditorProjectData(project: Record<string, unknown>): boolean {
  return (
    typeof project.name === 'string' &&
    typeof project.playhead === 'number' &&
    typeof project.zoom === 'number' &&
    Array.isArray(project.assets) &&
    project.assets.every(isEditorAsset) &&
    Array.isArray(project.clips) &&
    project.clips.every(isTimelineClip)
  );
}

function isExportSettings(value: unknown): value is EditorExportSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Record<string, unknown>;
  return (
    (settings.resolution === 'source' ||
      settings.resolution === '720p' ||
      settings.resolution === '1080p') &&
    (settings.fps === 24 || settings.fps === 30 || settings.fps === 60) &&
    (settings.quality === 'compact' ||
      settings.quality === 'balanced' ||
      settings.quality === 'high')
  );
}

function isEditorAsset(value: unknown): value is EditorAsset {
  if (!value || typeof value !== 'object') return false;
  const asset = value as Record<string, unknown>;
  return (
    typeof asset.id === 'string' &&
    typeof asset.storageName === 'string' &&
    typeof asset.name === 'string' &&
    (asset.kind === 'video' || asset.kind === 'audio') &&
    typeof asset.mimeType === 'string' &&
    typeof asset.size === 'number' &&
    typeof asset.duration === 'number' &&
    typeof asset.width === 'number' &&
    typeof asset.height === 'number'
  );
}

function isTimelineClip(value: unknown): value is TimelineClip {
  if (!value || typeof value !== 'object') return false;
  const clip = value as Record<string, unknown>;
  return (
    typeof clip.id === 'string' &&
    typeof clip.assetId === 'string' &&
    (clip.kind === 'video' || clip.kind === 'audio') &&
    typeof clip.offset === 'number' &&
    typeof clip.sourceStart === 'number' &&
    typeof clip.duration === 'number' &&
    (clip.muted === undefined || typeof clip.muted === 'boolean') &&
    (clip.hidden === undefined || typeof clip.hidden === 'boolean')
  );
}

export function resolveExportConfig(
  asset: EditorAsset,
  settings: EditorExportSettings,
): EditorExportConfig {
  const maxEdge = settings.resolution === '720p' ? 1280 : 1920;
  const scale =
    settings.resolution === 'source'
      ? 1
      : Math.min(1, maxEdge / Math.max(asset.width, asset.height));
  const width = Math.max(2, Math.round((asset.width * scale) / 2) * 2);
  const height = Math.max(2, Math.round((asset.height * scale) / 2) * 2);
  const bitsPerPixel =
    settings.quality === 'compact'
      ? 0.06
      : settings.quality === 'high'
        ? 0.16
        : 0.1;
  return {
    width,
    height,
    fps: settings.fps,
    bitrate: Math.round(
      Math.max(
        1_000_000,
        Math.min(30_000_000, width * height * settings.fps * bitsPerPixel),
      ),
    ),
  };
}

export async function exportEditorTimeline(
  sessionId: string,
  timeline: EditorTimeline,
  fileName: string,
  settings: EditorExportSettings,
  onProgress?: (progress: number) => void,
): Promise<File> {
  const firstVideo = timeline.assets.find((asset) => asset.kind === 'video');
  if (!firstVideo) throw new Error('VIDEO_REQUIRED');
  const output = resolveExportConfig(firstVideo, settings);
  const result = await runEditorWorker(
    {
      type: 'export',
      sessionId,
      timeline,
      fileName,
      output,
    },
    onProgress,
  );
  if (result.type !== 'export') throw new Error('EDITOR_WORKER_FAILED');
  const directory = await getSessionDirectory(sessionId);
  return (await directory.getFileHandle(result.storageName)).getFile();
}
