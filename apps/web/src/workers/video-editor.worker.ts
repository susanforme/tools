/// <reference lib="webworker" />

import type { StreamTargetChunk } from 'mediabunny';
import type {
  EditorAsset,
  EditorWorkerRequest,
  EditorWorkerResponse,
  TimelineClip,
} from '@/lib/webav-editor';
import { VIDEO_EDITOR_CONFIG } from '@/lib/video-editor-config';

const context = self as DedicatedWorkerGlobalScope;

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

async function readAsset(
  directory: FileSystemDirectoryHandle,
  asset: EditorAsset,
): Promise<File> {
  return (await directory.getFileHandle(asset.storageName)).getFile();
}

async function normalizeVideo(
  request: Extract<EditorWorkerRequest, { type: 'normalize-video' }>,
): Promise<void> {
  const directory = await getSessionDirectory(request.sessionId);
  const source = await (
    await directory.getFileHandle(request.storageName)
  ).getFile();
  const {
    ALL_FORMATS,
    BlobSource,
    Conversion,
    Input,
    Mp4OutputFormat,
    Output,
    StreamTarget,
  } = await import('mediabunny');
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(source),
  });
  try {
    if (!(await input.canRead())) throw new Error('UNSUPPORTED_CONTAINER');
    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    if (!video) throw new Error('VIDEO_REQUIRED');
    if (!(await video.canDecode()) || (audio && !(await audio.canDecode()))) {
      throw new Error('WEBCODECS_UNSUPPORTED');
    }
    if (/\.mp4$/i.test(request.storageName)) {
      postDone(request.id, {
        type: 'normalize-video',
        storageName: request.storageName,
      });
      return;
    }

    const storageName = `${crypto.randomUUID()}.mp4`;
    const handle = await directory.getFileHandle(storageName, { create: true });
    const writable = await handle.createWritable();
    const output = new Output({
      format: new Mp4OutputFormat(),
      target: new StreamTarget(
        writable as unknown as WritableStream<StreamTargetChunk>,
        { chunked: true },
      ),
    });
    try {
      const conversion = await Conversion.init({
        input,
        output,
        tracks: 'primary',
        video: { codec: 'avc', keyFrameInterval: 2 },
        audio: { codec: 'aac' },
        tags: {},
        showWarnings: false,
      });
      if (!conversion.isValid) throw new Error('VIDEO_CONVERSION_UNAVAILABLE');
      conversion.onProgress = (progress) =>
        context.postMessage({
          id: request.id,
          type: 'progress',
          progress,
        } satisfies EditorWorkerResponse);
      await conversion.execute();
      postDone(request.id, { type: 'normalize-video', storageName });
    } catch (cause) {
      await output.cancel().catch(() => undefined);
      await writable.abort().catch(() => undefined);
      await directory.removeEntry(storageName).catch(() => undefined);
      throw cause;
    }
  } finally {
    input.dispose();
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
    ) {
      return null;
    }
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

async function generateThumbnails(
  request: Extract<EditorWorkerRequest, { type: 'thumbnails' }>,
): Promise<void> {
  const session = await getSessionDirectory(request.sessionId);
  const root = await session.getDirectoryHandle(
    VIDEO_EDITOR_CONFIG.thumbnailDirectory,
    { create: true },
  );
  const directory = await root.getDirectoryHandle(request.asset.id, {
    create: true,
  });
  const cached = await readThumbnailManifest(directory);
  if (cached?.length) {
    postDone(request.id, { type: 'thumbnails', manifest: cached });
    return;
  }

  const { MP4Clip } = await import('@webav/av-cliper');
  const source = await readAsset(session, request.asset);
  const clip = new MP4Clip(source.stream(), { audio: false });
  try {
    await clip.ready;
    const generated = await clip.thumbnails(96, {
      start: 0,
      end: request.asset.duration * VIDEO_EDITOR_CONFIG.microsecondsPerSecond,
      step:
        Math.max(0.5, Math.ceil((request.asset.duration / 24) * 2) / 2) *
        VIDEO_EDITOR_CONFIG.microsecondsPerSecond,
    });
    if (generated.length === 0) {
      const frame = await clip.tick(0);
      if (frame.video) {
        const height = Math.max(
          1,
          Math.round(
            (96 * frame.video.displayHeight) / frame.video.displayWidth,
          ),
        );
        const canvas = new OffscreenCanvas(96, height);
        canvas.getContext('2d')?.drawImage(frame.video, 0, 0, 96, height);
        frame.video.close();
        generated.push({
          ts: 0,
          img: await canvas.convertToBlob({
            type: 'image/jpeg',
            quality: 0.75,
          }),
        });
      }
    }

    const manifest: Array<{ name: string; ts: number }> = [];
    for (const [index, thumbnail] of generated.entries()) {
      const name = `${index}.jpg`;
      const handle = await directory.getFileHandle(name, { create: true });
      await thumbnail.img.stream().pipeTo(await handle.createWritable());
      manifest.push({ name, ts: thumbnail.ts });
    }
    if (manifest.length > 0) {
      await writeThumbnailManifest(directory, manifest);
    }
    postDone(request.id, { type: 'thumbnails', manifest });
  } finally {
    clip.destroy();
  }
}

async function trimClip<
  Clip extends { split(time: number): Promise<[Clip, Clip]>; destroy(): void },
>(
  clip: Clip,
  sourceStart: number,
  duration: number,
  sourceDuration: number,
): Promise<Clip> {
  let current = clip;
  if (sourceStart > 0) {
    const previous = current;
    const [before, after] = await current.split(
      sourceStart * VIDEO_EDITOR_CONFIG.microsecondsPerSecond,
    );
    before.destroy();
    current = after;
    previous.destroy();
  }
  if (duration >= sourceDuration - sourceStart - 0.001) return current;
  const previous = current;
  const [selected, after] = await current.split(
    duration * VIDEO_EDITOR_CONFIG.microsecondsPerSecond,
  );
  after.destroy();
  previous.destroy();
  return selected;
}

async function normalizeAudio(
  directory: FileSystemDirectoryHandle,
  asset: EditorAsset,
): Promise<{ file: File; storageName: string }> {
  const {
    ALL_FORMATS,
    BlobSource,
    Conversion,
    Input,
    Mp4OutputFormat,
    Output,
    StreamTarget,
  } = await import('mediabunny');
  const source = await readAsset(directory, asset);
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(source),
  });
  if (!(await input.canRead()) || !(await input.getPrimaryAudioTrack())) {
    input.dispose();
    throw new Error('AUDIO_REQUIRED');
  }

  const storageName = `.audio-${asset.id}-${crypto.randomUUID()}.mp4`;
  const handle = await directory.getFileHandle(storageName, { create: true });
  const writable = await handle.createWritable();
  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new StreamTarget(
      writable as unknown as WritableStream<StreamTargetChunk>,
      { chunked: true },
    ),
  });
  try {
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: { discard: true },
      audio: { codec: 'aac', sampleRate: 48_000, numberOfChannels: 2 },
      tags: {},
      showWarnings: false,
    });
    if (!conversion.isValid) throw new Error('AUDIO_CONVERSION_UNAVAILABLE');
    await conversion.execute();
    return { file: await handle.getFile(), storageName };
  } catch (cause) {
    await output.cancel().catch(() => undefined);
    await writable.abort().catch(() => undefined);
    await directory.removeEntry(storageName).catch(() => undefined);
    throw cause;
  } finally {
    input.dispose();
  }
}

function timelineDuration(clips: TimelineClip[]): number {
  return clips.reduce(
    (duration, clip) => Math.max(duration, clip.offset + clip.duration),
    0,
  );
}

async function exportTimeline(
  request: Extract<EditorWorkerRequest, { type: 'export' }>,
): Promise<void> {
  const { Combinator, EmbedSubtitlesClip, MP4Clip, OffscreenSprite } =
    await import('@webav/av-cliper');
  const supported = await Combinator.isSupported({
    width: request.output.width,
    height: request.output.height,
    bitrate: request.output.bitrate,
  });
  if (!supported) throw new Error('WEBAV_UNSUPPORTED');

  const directory = await getSessionDirectory(request.sessionId);
  const temporaryAudio = new Map<string, { file: File; storageName: string }>();
  const combinator = new Combinator({
    ...request.output,
    bgColor: '#000',
    metaDataTags: {
      title: request.fileName,
      encoder: 'Breeze Tools · WebAV',
    },
  });
  const stopProgress = combinator.on('OutputProgress', (progress) => {
    context.postMessage({
      id: request.id,
      type: 'progress',
      progress,
    } satisfies EditorWorkerResponse);
  });
  try {
    for (const item of request.timeline.clips) {
      const track = request.timeline.tracks.find(
        ({ id }) => id === item.trackId,
      );
      if (item.kind === 'audio' && (item.muted || track?.muted)) continue;
      const asset = request.timeline.assets.find(
        ({ id }) => id === item.assetId,
      );
      if (!asset) continue;
      let stored: File;
      if (asset.kind === 'audio') {
        let normalized = temporaryAudio.get(asset.id);
        if (!normalized) {
          normalized = await normalizeAudio(directory, asset);
          temporaryAudio.set(asset.id, normalized);
        }
        stored = normalized.file;
      } else {
        stored = await readAsset(directory, asset);
      }

      const source = new MP4Clip(stored.stream(), {
        audio: item.muted || track?.muted ? false : true,
      });
      await source.ready;
      const clip = await trimClip(
        source,
        item.sourceStart,
        item.duration,
        asset.duration,
      );
      const sprite = new OffscreenSprite(clip);
      if (item.kind === 'video') {
        const scale = Math.min(
          request.output.width / asset.width,
          request.output.height / asset.height,
        );
        sprite.rect.w = asset.width * scale;
        sprite.rect.h = asset.height * scale;
        sprite.rect.x = (request.output.width - sprite.rect.w) / 2;
        sprite.rect.y = (request.output.height - sprite.rect.h) / 2;
      }
      if (item.kind === 'audio' || item.hidden || track?.hidden) {
        sprite.opacity = 0;
      }
      sprite.zIndex = Math.max(
        0,
        request.timeline.tracks.findIndex(({ id }) => id === item.trackId),
      );
      sprite.time = {
        offset: item.offset * VIDEO_EDITOR_CONFIG.microsecondsPerSecond,
        duration: item.duration * VIDEO_EDITOR_CONFIG.microsecondsPerSecond,
      };
      await combinator.addSprite(sprite);
    }

    const subtitleTracks = request.timeline.tracks.filter(
      (track) => track.kind === 'subtitle' && !track.hidden,
    );
    if (subtitleTracks.length > 0 && request.timeline.subtitles.length > 0) {
      const style = request.timeline.subtitleStyle;
      const fontAsset = style.fontAssetId
        ? request.timeline.assets.find(({ id }) => id === style.fontAssetId)
        : null;
      if (fontAsset && 'FontFace' in context && 'fonts' in context) {
        const fontFile = await readAsset(directory, fontAsset);
        const font = new FontFace(
          style.fontFamily,
          await fontFile.arrayBuffer(),
        );
        await font.load();
        (context.fonts as FontFaceSet).add(font);
      }
      for (const track of subtitleTracks) {
        const cues = request.timeline.subtitles
          .filter((cue) => cue.trackId === track.id)
          .map((cue) => ({
            start: cue.start * VIDEO_EDITOR_CONFIG.microsecondsPerSecond,
            end: cue.end * VIDEO_EDITOR_CONFIG.microsecondsPerSecond,
            text: cue.text,
          }));
        if (cues.length === 0) continue;
        const subtitleClip = new EmbedSubtitlesClip(cues, {
          videoWidth: request.output.width,
          videoHeight: request.output.height,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          color: style.color,
        });
        const subtitleSprite = new OffscreenSprite(subtitleClip);
        subtitleSprite.zIndex = request.timeline.tracks.length + 1;
        await combinator.addSprite(subtitleSprite);
      }
    }

    const storageName = `${request.fileName.replace(/[\\/:*?"<>|]/g, '-').trim() || 'video'}.mp4`;
    const handle = await directory.getFileHandle(storageName, { create: true });
    const reader = combinator
      .output({
        maxTime:
          timelineDuration(request.timeline.clips) *
          VIDEO_EDITOR_CONFIG.microsecondsPerSecond,
      })
      .getReader();
    const access = await handle.createSyncAccessHandle();
    let offset = 0;
    try {
      access.truncate(0);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        let chunkOffset = 0;
        while (chunkOffset < value.byteLength) {
          const written = access.write(value.subarray(chunkOffset), {
            at: offset + chunkOffset,
          });
          if (written === 0) throw new Error('OPFS_WRITE_FAILED');
          chunkOffset += written;
        }
        offset += value.byteLength;
      }
      access.truncate(offset);
      access.flush();
    } catch (cause) {
      await reader.cancel(cause).catch(() => undefined);
      throw cause;
    } finally {
      reader.releaseLock();
      access.close();
    }
    postDone(request.id, { type: 'export', storageName });
  } finally {
    stopProgress();
    combinator.destroy();
    await Promise.all(
      [...temporaryAudio.values()].map(({ storageName }) =>
        directory.removeEntry(storageName).catch(() => undefined),
      ),
    );
  }
}

function postDone(
  id: string,
  result: Extract<EditorWorkerResponse, { type: 'done' }>['result'],
): void {
  context.postMessage({
    id,
    type: 'done',
    result,
  } satisfies EditorWorkerResponse);
}

async function handle(request: EditorWorkerRequest): Promise<void> {
  if (request.type === 'thumbnails') return generateThumbnails(request);
  if (request.type === 'normalize-video') return normalizeVideo(request);
  return exportTimeline(request);
}

let queue = Promise.resolve();
context.onmessage = (event: MessageEvent<EditorWorkerRequest>) => {
  queue = queue
    .then(() => handle(event.data))
    .catch((cause: unknown) => {
      context.postMessage({
        id: event.data.id,
        type: 'error',
        error: cause instanceof Error ? cause.message : String(cause),
      } satisfies EditorWorkerResponse);
    });
};

export {};
