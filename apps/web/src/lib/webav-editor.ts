import { VIDEO_EDITOR_CONFIG } from './video-editor-config';

export type EditorAsset = {
  id: string;
  storageName: string;
  name: string;
  kind: 'video' | 'audio' | 'subtitle' | 'font';
  mimeType: string;
  size: number;
  duration: number;
  width: number;
  height: number;
};

export type TimelineClip = {
  id: string;
  assetId: string;
  kind: 'video' | 'audio';
  trackId?: string;
  offset: number;
  sourceStart: number;
  duration: number;
  muted?: boolean;
  hidden?: boolean;
  linkGroupId?: string;
};

export type EditorTrack = {
  id: string;
  kind: 'video' | 'audio' | 'subtitle';
  name: string;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
};

export type EditorSubtitleCue = {
  id: string;
  trackId: string;
  start: number;
  end: number;
  text: string;
};

export type EditorSubtitleStyle = {
  fontFamily: string;
  fontSize: number;
  color: string;
  fontAssetId: string | null;
};

export type EditorTimeline = {
  assets: EditorAsset[];
  clips: TimelineClip[];
  tracks: EditorTrack[];
  subtitles: EditorSubtitleCue[];
  subtitleStyle: EditorSubtitleStyle;
};

export type EditorExportSettings = {
  resolution: 'source' | '720p' | '1080p' | 'custom';
  width: number;
  height: number;
  fps: number;
  quality: 'compact' | 'balanced' | 'high';
  format: 'mp4' | 'webm' | 'mov' | 'mkv' | 'avi' | 'ts';
  videoBitrateKbps: number;
  audioBitrateKbps: number;
};

export type EditorProjectState = EditorTimeline & {
  version: 3;
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
    }
  | {
      id: string;
      type: 'normalize-video';
      sessionId: string;
      storageName: string;
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
  | { type: 'export'; storageName: string }
  | { type: 'normalize-video'; storageName: string };

export type EditorWorkerResponse =
  | { id: string; type: 'progress'; progress: number }
  | { id: string; type: 'done'; result: EditorWorkerResult }
  | { id: string; type: 'error'; error: string };

export const DEFAULT_EXPORT_SETTINGS: EditorExportSettings = {
  resolution: 'source',
  width: 1920,
  height: 1080,
  fps: 30,
  quality: 'balanced',
  format: 'mp4',
  videoBitrateKbps: 6_000,
  audioBitrateKbps: 192,
};

export const DEFAULT_SUBTITLE_STYLE: EditorSubtitleStyle = {
  fontFamily: 'sans-serif',
  fontSize: 42,
  color: '#ffffff',
  fontAssetId: null,
};

export const DEFAULT_AUDIO_TRACK_COUNT = 3;

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
    file.type.startsWith('video/') ||
    /\.(3gp|asf|avi|divx|dv|flv|m2ts|m4v|mkv|mov|mp4|mpeg|mpg|mts|mxf|ogv|rm|rmvb|ts|vob|webm|wmv)$/i.test(
      file.name,
    ) ||
    /\.(srt|vtt|ttf|otf|woff2?)$/i.test(file.name)
  );
}

export function getEditorAssetKind(file: File): EditorAsset['kind'] {
  if (file.type.startsWith('audio/')) return 'audio';
  if (/\.(srt|vtt)$/i.test(file.name)) return 'subtitle';
  if (/\.(ttf|otf|woff2?)$/i.test(file.name)) return 'font';
  return 'video';
}

export function createEditorTrack(
  kind: EditorTrack['kind'],
  index: number,
): EditorTrack {
  return {
    id: crypto.randomUUID(),
    kind,
    name: `${kind === 'video' ? 'V' : kind === 'audio' ? 'A' : 'S'}${index}`,
    muted: false,
    hidden: false,
    locked: false,
  };
}

export function ensureDefaultAudioTracks(tracks: EditorTrack[]): EditorTrack[] {
  const audioTrackCount = tracks.filter(({ kind }) => kind === 'audio').length;
  if (audioTrackCount >= DEFAULT_AUDIO_TRACK_COUNT) return tracks;
  return [
    ...tracks,
    ...Array.from(
      { length: DEFAULT_AUDIO_TRACK_COUNT - audioTrackCount },
      (_, index) => createEditorTrack('audio', audioTrackCount + index + 1),
    ),
  ];
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
  fps = 20,
): TimelineClip {
  return {
    ...clip,
    offset: Math.max(0, Math.round(offset * fps) / fps),
  };
}

export function snapTimelineClip(
  clip: TimelineClip,
  offset: number,
  clips: TimelineClip[],
  pixelsPerSecond: number,
  playhead: number,
): { offset: number; guide: number | null } {
  const targets = [
    0,
    playhead,
    ...clips
      .filter(
        (item) =>
          item.id !== clip.id &&
          (!clip.linkGroupId || item.linkGroupId !== clip.linkGroupId),
      )
      .flatMap((item) => [item.offset, item.offset + item.duration]),
  ];
  const threshold = 8 / pixelsPerSecond;
  const edges = [offset, offset + clip.duration];
  let best: { distance: number; offset: number; guide: number } | null = null;
  for (const edge of edges) {
    for (const target of targets) {
      const distance = Math.abs(target - edge);
      if (distance <= threshold && (!best || distance < best.distance)) {
        best = { distance, offset: offset + target - edge, guide: target };
      }
    }
  }
  return best
    ? { offset: Math.max(0, best.offset), guide: best.guide }
    : { offset, guide: null };
}

export function duplicateTimelineClip(
  clip: TimelineClip,
  offset = clip.offset + clip.duration,
): TimelineClip {
  return { ...clip, id: crypto.randomUUID(), offset, linkGroupId: undefined };
}

export function extractTimelineAudio(clip: TimelineClip): {
  video: TimelineClip;
  audio: TimelineClip;
} {
  const linkGroupId = clip.linkGroupId ?? crypto.randomUUID();
  return {
    video: { ...clip, muted: true, linkGroupId },
    audio: {
      ...clip,
      id: crypto.randomUUID(),
      kind: 'audio',
      muted: false,
      hidden: false,
      linkGroupId,
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

export async function getEditorOutputHandle(
  sessionId: string,
  fileName: string,
): Promise<FileSystemFileHandle> {
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, '-').trim() || 'video';
  return (await getSessionDirectory(sessionId)).getFileHandle(safeName, {
    create: true,
  });
}

export async function removeEditorOutput(
  sessionId: string,
  fileName: string,
): Promise<void> {
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, '-').trim() || 'video';
  await (await getSessionDirectory(sessionId))
    .removeEntry(safeName)
    .catch(() => undefined);
}

export async function clearEditorProject(sessionId: string): Promise<void> {
  const root = await navigator.storage.getDirectory();
  try {
    const editor = await root.getDirectoryHandle(
      VIDEO_EDITOR_CONFIG.rootDirectory,
    );
    await editor.removeEntry(sessionId, { recursive: true });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'NotFoundError') return;
    throw cause;
  }
}

async function probeMedia(
  file: File,
  kind: 'video' | 'audio',
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
  const kind = getEditorAssetKind(source);
  const directory = await getSessionDirectory(sessionId);
  const extension = source.name.match(/\.[a-z0-9]+$/i)?.[0] ?? '';
  const originalStorageName = `${crypto.randomUUID()}${extension}`;
  const handle = await directory.getFileHandle(originalStorageName, {
    create: true,
  });
  const writable = await handle.createWritable();
  try {
    await source.stream().pipeTo(writable);
  } catch (cause) {
    await writable.abort().catch(() => undefined);
    await directory.removeEntry(originalStorageName).catch(() => undefined);
    throw cause;
  }
  let storageName = originalStorageName;
  try {
    if (kind === 'video') {
      try {
        const result = await runEditorWorker({
          type: 'normalize-video',
          sessionId,
          storageName: originalStorageName,
        });
        if (result.type !== 'normalize-video') {
          throw new Error('VIDEO_NORMALIZATION_FAILED');
        }
        storageName = result.storageName;
      } catch {
        const { convertVideoToEditorMp4 } = await import('./ffmpeg-export');
        storageName = `${crypto.randomUUID()}.mp4`;
        const target = await directory.getFileHandle(storageName, {
          create: true,
        });
        await convertVideoToEditorMp4(await handle.getFile(), target);
      }
      if (storageName !== originalStorageName) {
        await directory.removeEntry(originalStorageName).catch(() => undefined);
      }
    }
    const stored = await (await directory.getFileHandle(storageName)).getFile();
    const metadata =
      kind === 'video' || kind === 'audio'
        ? await probeMedia(stored, kind)
        : { duration: 0, width: 0, height: 0 };
    return {
      id: crypto.randomUUID(),
      storageName,
      name: source.name,
      kind,
      mimeType: kind === 'video' ? 'video/mp4' : source.type || stored.type,
      size: stored.size,
      ...metadata,
    };
  } catch (cause) {
    await directory.removeEntry(originalStorageName).catch(() => undefined);
    if (storageName !== originalStorageName) {
      await directory.removeEntry(storageName).catch(() => undefined);
    }
    throw cause;
  }
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
    project.version === 3 &&
    isEditorProjectData(project) &&
    isExportSettings(project.exportSettings) &&
    Array.isArray(project.tracks) &&
    project.tracks.every(isEditorTrack) &&
    Array.isArray(project.subtitles) &&
    project.subtitles.every(isSubtitleCue) &&
    isSubtitleStyle(project.subtitleStyle)
  );
}

export function normalizeEditorProjectState(
  value: unknown,
): EditorProjectState | null {
  if (isEditorProjectState(value)) {
    return {
      ...value,
      clips: ensureLinkedAvClips(value.clips),
      tracks: ensureDefaultAudioTracks(value.tracks),
    };
  }
  if (!value || typeof value !== 'object') return null;
  const project = value as Record<string, unknown>;
  if (
    project.version === 3 &&
    isEditorProjectData(project) &&
    Array.isArray(project.tracks) &&
    project.tracks.every(isEditorTrack) &&
    Array.isArray(project.subtitles) &&
    project.subtitles.every(isSubtitleCue) &&
    isSubtitleStyle(project.subtitleStyle)
  ) {
    return {
      ...(project as Omit<EditorProjectState, 'exportSettings'>),
      clips: ensureLinkedAvClips(project.clips as TimelineClip[]),
      tracks: ensureDefaultAudioTracks(project.tracks),
      exportSettings: normalizeExportSettings(project.exportSettings),
    };
  }
  if (
    (project.version !== 1 && project.version !== 2) ||
    !isEditorProjectData(project)
  )
    return null;
  const legacyClips = project.clips as TimelineClip[];
  const videoTrack = createEditorTrack('video', 1);
  const audioTrack = createEditorTrack('audio', 1);
  return {
    ...(project as Omit<
      EditorProjectState,
      'version' | 'exportSettings' | 'tracks' | 'subtitles' | 'subtitleStyle'
    >),
    version: 3,
    clips: ensureLinkedAvClips(
      legacyClips.map((clip) => ({
        ...clip,
        trackId: clip.kind === 'video' ? videoTrack.id : audioTrack.id,
      })),
    ),
    tracks: ensureDefaultAudioTracks([videoTrack, audioTrack]),
    subtitles: [],
    subtitleStyle: DEFAULT_SUBTITLE_STYLE,
    exportSettings: normalizeExportSettings(project.exportSettings),
  };
}

function ensureLinkedAvClips(clips: TimelineClip[]): TimelineClip[] {
  const next = clips.map((clip) => ({ ...clip }));
  for (const video of next) {
    if (video.kind !== 'video' || video.linkGroupId) continue;
    const audio = next.find(
      (clip) =>
        clip.kind === 'audio' &&
        !clip.linkGroupId &&
        clip.assetId === video.assetId &&
        clip.offset === video.offset &&
        clip.sourceStart === video.sourceStart &&
        clip.duration === video.duration,
    );
    if (!audio) continue;
    const linkGroupId = crypto.randomUUID();
    video.linkGroupId = linkGroupId;
    audio.linkGroupId = linkGroupId;
  }
  return next;
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
      settings.resolution === '1080p' ||
      settings.resolution === 'custom') &&
    typeof settings.width === 'number' &&
    typeof settings.height === 'number' &&
    typeof settings.fps === 'number' &&
    settings.fps > 0 &&
    (settings.quality === 'compact' ||
      settings.quality === 'balanced' ||
      settings.quality === 'high') &&
    (settings.format === 'mp4' ||
      settings.format === 'webm' ||
      settings.format === 'mov' ||
      settings.format === 'mkv' ||
      settings.format === 'avi' ||
      settings.format === 'ts') &&
    typeof settings.videoBitrateKbps === 'number' &&
    typeof settings.audioBitrateKbps === 'number'
  );
}

function normalizeExportSettings(value: unknown): EditorExportSettings {
  if (isExportSettings(value)) return value;
  if (!value || typeof value !== 'object') return DEFAULT_EXPORT_SETTINGS;
  const legacy = value as Record<string, unknown>;
  if (legacy.format === 'gif') {
    const migrated = { ...legacy, format: 'mp4' };
    if (isExportSettings(migrated)) return migrated;
  }
  return {
    ...DEFAULT_EXPORT_SETTINGS,
    resolution:
      legacy.resolution === '720p' || legacy.resolution === '1080p'
        ? legacy.resolution
        : 'source',
    fps: typeof legacy.fps === 'number' && legacy.fps > 0 ? legacy.fps : 30,
    quality:
      legacy.quality === 'compact' || legacy.quality === 'high'
        ? legacy.quality
        : 'balanced',
  };
}

function isEditorAsset(value: unknown): value is EditorAsset {
  if (!value || typeof value !== 'object') return false;
  const asset = value as Record<string, unknown>;
  return (
    typeof asset.id === 'string' &&
    typeof asset.storageName === 'string' &&
    typeof asset.name === 'string' &&
    (asset.kind === 'video' ||
      asset.kind === 'audio' ||
      asset.kind === 'subtitle' ||
      asset.kind === 'font') &&
    typeof asset.mimeType === 'string' &&
    typeof asset.size === 'number' &&
    typeof asset.duration === 'number' &&
    typeof asset.width === 'number' &&
    typeof asset.height === 'number'
  );
}

function isEditorTrack(value: unknown): value is EditorTrack {
  if (!value || typeof value !== 'object') return false;
  const track = value as Record<string, unknown>;
  return (
    typeof track.id === 'string' &&
    (track.kind === 'video' ||
      track.kind === 'audio' ||
      track.kind === 'subtitle') &&
    typeof track.name === 'string' &&
    typeof track.muted === 'boolean' &&
    typeof track.hidden === 'boolean' &&
    typeof track.locked === 'boolean'
  );
}

function isSubtitleCue(value: unknown): value is EditorSubtitleCue {
  if (!value || typeof value !== 'object') return false;
  const cue = value as Record<string, unknown>;
  return (
    typeof cue.id === 'string' &&
    typeof cue.trackId === 'string' &&
    typeof cue.start === 'number' &&
    typeof cue.end === 'number' &&
    typeof cue.text === 'string'
  );
}

function isSubtitleStyle(value: unknown): value is EditorSubtitleStyle {
  if (!value || typeof value !== 'object') return false;
  const style = value as Record<string, unknown>;
  return (
    typeof style.fontFamily === 'string' &&
    typeof style.fontSize === 'number' &&
    typeof style.color === 'string' &&
    (style.fontAssetId === null || typeof style.fontAssetId === 'string')
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
    (clip.hidden === undefined || typeof clip.hidden === 'boolean') &&
    (clip.linkGroupId === undefined || typeof clip.linkGroupId === 'string')
  );
}

export function resolveExportConfig(
  asset: EditorAsset,
  settings: EditorExportSettings,
): EditorExportConfig {
  if (settings.resolution === 'custom') {
    return {
      width: Math.max(2, Math.round(settings.width / 2) * 2),
      height: Math.max(2, Math.round(settings.height / 2) * 2),
      fps: settings.fps,
      bitrate: settings.videoBitrateKbps * 1_000,
    };
  }
  const maxEdge = settings.resolution === '720p' ? 1280 : 1920;
  const scale =
    settings.resolution === 'source'
      ? 1
      : Math.min(1, maxEdge / Math.max(asset.width, asset.height));
  const width = Math.max(2, Math.round((asset.width * scale) / 2) * 2);
  const height = Math.max(2, Math.round((asset.height * scale) / 2) * 2);
  return {
    width,
    height,
    fps: settings.fps,
    bitrate: settings.videoBitrateKbps * 1_000,
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
