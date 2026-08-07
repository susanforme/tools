/// <reference lib="webworker" />

import {
  MEDIA_TOOLS_DIRECTORY,
  type MediaInfo,
  type MediaWorkerRequest,
  type MediaWorkerResponse,
  type StoredMediaResult,
} from '@/lib/media-tools';
import type {
  Input,
  Output,
  OutputFormat,
  StreamTargetChunk,
} from 'mediabunny';

const context = self as DedicatedWorkerGlobalScope;
const MAX_ANIMATION_BYTES = 128 * 1024 * 1024;
const MAX_ANIMATION_FRAMES = 300;

async function getDirectory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(MEDIA_TOOLS_DIRECTORY, { create: true });
}

async function cleanup(): Promise<void> {
  const directory = await getDirectory();
  for await (const [name] of directory.entries()) {
    await directory.removeEntry(name, { recursive: true });
  }
  context.postMessage({ type: 'cleaned' } satisfies MediaWorkerResponse);
}

async function createInput(file: File): Promise<Input> {
  const { ALL_FORMATS, BlobSource, Input } = await import('mediabunny');
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(file),
  });
  if (!(await input.canRead())) {
    input.dispose();
    throw new Error('UNSUPPORTED_MEDIA');
  }
  return input;
}

async function durationOf(input: Input): Promise<number> {
  const duration =
    (await input.getDurationFromMetadata(undefined, { skipLiveWait: true })) ??
    (await input.computeDuration(undefined, { skipLiveWait: true }));
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('INVALID_DURATION');
  }
  return duration;
}

async function inspect(file: File): Promise<void> {
  const input = await createInput(file);
  try {
    const tracks = await input.getTracks();
    const trackInfo = await Promise.all(
      tracks.map(async (track) => {
        const duration =
          (await track.getDurationFromMetadata({ skipLiveWait: true })) ??
          (await track.computeDuration({ skipLiveWait: true }));
        const base = {
          type: track.type,
          codec: (await track.getCodec()) ?? 'unknown',
          duration,
          bitrate:
            (await track.getAverageBitrate()) ?? (await track.getBitrate()),
        };
        if (track.isVideoTrack()) {
          const stats = await track.computePacketStats(120, {
            skipLiveWait: true,
          });
          return {
            ...base,
            width: await track.getDisplayWidth(),
            height: await track.getDisplayHeight(),
            rotation: await track.getRotation(),
            frameRate: stats.averagePacketRate,
          };
        }
        if (track.isAudioTrack()) {
          return {
            ...base,
            channels: await track.getNumberOfChannels(),
            sampleRate: await track.getSampleRate(),
          };
        }
        return base;
      }),
    );
    const metadata = await input.getMetadataTags();
    const tags: Array<{ key: string; value: string }> = [];
    const knownKeys = [
      'title',
      'description',
      'artist',
      'album',
      'albumArtist',
      'comment',
      'lyrics',
      'date',
      'genre',
      'trackNumber',
      'tracksTotal',
      'discNumber',
      'discsTotal',
    ] as const;
    for (const key of knownKeys) {
      const value = Reflect.get(metadata, key) as unknown;
      if (value !== undefined && value !== null && value !== '') {
        tags.push({ key, value: String(value) });
      }
    }
    for (const [key, value] of Object.entries(metadata.raw ?? {})) {
      tags.push({ key, value: String(value) });
    }
    if ((metadata.images?.length ?? 0) > 0) {
      tags.push({ key: 'images', value: String(metadata.images!.length) });
    }
    const info: MediaInfo = {
      duration: await durationOf(input),
      mimeType: await input.getMimeType(),
      tracks: trackInfo,
      tags,
    };
    context.postMessage({
      type: 'inspected',
      info,
    } satisfies MediaWorkerResponse);
  } finally {
    input.dispose();
  }
}

type StoredOutput = {
  directory: FileSystemDirectoryHandle;
  fileName: string;
  handle: FileSystemFileHandle;
  output: Output;
  writable: FileSystemWritableFileStream;
};

async function createStoredOutput(
  format: OutputFormat,
  prefix: string,
): Promise<StoredOutput> {
  const { Output, StreamTarget } = await import('mediabunny');
  const directory = await getDirectory();
  const fileName = `${prefix}-${crypto.randomUUID()}${format.fileExtension}`;
  const handle = await directory.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  const target = new StreamTarget(
    writable as unknown as WritableStream<StreamTargetChunk>,
    { chunked: true },
  );
  return {
    directory,
    fileName,
    handle,
    output: new Output({ format, target }),
    writable,
  };
}

async function failStored(stored: StoredOutput): Promise<void> {
  await stored.output.cancel().catch(() => undefined);
  await stored.writable.abort().catch(() => undefined);
  await stored.directory.removeEntry(stored.fileName).catch(() => undefined);
}

async function postStored(stored: StoredOutput): Promise<void> {
  const file = await stored.handle.getFile();
  const result: StoredMediaResult = {
    fileName: stored.fileName,
    mimeType: await stored.output.getMimeType(),
    size: file.size,
  };
  context.postMessage({ type: 'stored', result } satisfies MediaWorkerResponse);
}

function postProgress(progress: number): void {
  context.postMessage({
    type: 'progress',
    progress: Math.max(0, Math.min(1, progress)),
  } satisfies MediaWorkerResponse);
}

function evenSize(value: number): number {
  return Math.max(2, Math.floor(value / 2) * 2);
}

function evenOffset(value: number): number {
  return Math.max(0, Math.floor(value / 2) * 2);
}

function cropForAspect(
  width: number,
  height: number,
  aspect: 'original' | '16:9' | '9:16' | '1:1',
) {
  if (aspect === 'original') return undefined;
  const ratio = aspect === '16:9' ? 16 / 9 : aspect === '9:16' ? 9 / 16 : 1;
  let cropWidth = width;
  let cropHeight = evenSize(width / ratio);
  if (cropHeight > height) {
    cropHeight = height;
    cropWidth = evenSize(height * ratio);
  }
  cropWidth = evenSize(cropWidth);
  cropHeight = evenSize(cropHeight);
  return {
    left: evenOffset((width - cropWidth) / 2),
    top: evenOffset((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  };
}

async function transformVideo(
  request: Extract<MediaWorkerRequest, { type: 'video-transform' }>,
): Promise<void> {
  const { Conversion, WebMOutputFormat } = await import('mediabunny');
  const input = await createInput(request.file);
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) {
    input.dispose();
    throw new Error('VIDEO_REQUIRED');
  }
  const rotated = request.rotation === 90 || request.rotation === 270;
  const width = await videoTrack.getDisplayWidth();
  const height = await videoTrack.getDisplayHeight();
  const stored = await createStoredOutput(new WebMOutputFormat(), 'video');
  try {
    const conversion = await Conversion.init({
      input,
      output: stored.output,
      tracks: 'primary',
      video: {
        rotate: request.rotation,
        crop: cropForAspect(
          rotated ? height : width,
          rotated ? width : height,
          request.aspect,
        ),
        allowRotationMetadata: false,
      },
      audio: request.mute ? { discard: true } : undefined,
      tags: request.clearMetadata ? {} : undefined,
      showWarnings: false,
    });
    if (!conversion.isValid) throw new Error('CONVERSION_UNAVAILABLE');
    conversion.onProgress = postProgress;
    await conversion.execute();
    await postStored(stored);
  } catch (cause) {
    await failStored(stored);
    throw cause;
  } finally {
    input.dispose();
  }
}

async function extractAudio(file: File): Promise<void> {
  const { Conversion, WavOutputFormat } = await import('mediabunny');
  const input = await createInput(file);
  if (!(await input.getPrimaryAudioTrack())) {
    input.dispose();
    throw new Error('AUDIO_REQUIRED');
  }
  const stored = await createStoredOutput(new WavOutputFormat(), 'audio');
  try {
    const conversion = await Conversion.init({
      input,
      output: stored.output,
      tracks: 'primary',
      video: { discard: true },
      audio: { codec: 'pcm-s16' },
      tags: {},
      showWarnings: false,
    });
    if (!conversion.isValid) throw new Error('CONVERSION_UNAVAILABLE');
    conversion.onProgress = postProgress;
    await conversion.execute();
    await postStored(stored);
  } catch (cause) {
    await failStored(stored);
    throw cause;
  } finally {
    input.dispose();
  }
}

async function replaceAudio(videoFile: File, audioFile: File): Promise<void> {
  const { Conversion, WebMOutputFormat } = await import('mediabunny');
  const videoInput = await createInput(videoFile);
  const audioInput = await createInput(audioFile);
  if (!(await videoInput.getPrimaryVideoTrack())) {
    videoInput.dispose();
    audioInput.dispose();
    throw new Error('VIDEO_REQUIRED');
  }
  if (!(await audioInput.getPrimaryAudioTrack())) {
    videoInput.dispose();
    audioInput.dispose();
    throw new Error('AUDIO_REQUIRED');
  }
  const stored = await createStoredOutput(new WebMOutputFormat(), 'video');
  try {
    const videoConversion = await Conversion.init({
      input: videoInput,
      output: stored.output,
      tracks: 'primary',
      video: {},
      audio: { discard: true },
      composable: true,
      showWarnings: false,
    });
    const audioConversion = await Conversion.init({
      input: audioInput,
      output: stored.output,
      tracks: 'primary',
      video: { discard: true },
      audio: { codec: 'opus' },
      trim: { start: 0, end: await durationOf(videoInput) },
      composable: true,
      showWarnings: false,
    });
    stored.output.setMetadataTags({});
    await stored.output.start();
    videoConversion.onProgress = (progress) => postProgress(progress / 2);
    audioConversion.onProgress = (progress) => postProgress(0.5 + progress / 2);
    await Promise.all([videoConversion.execute(), audioConversion.execute()]);
    await stored.output.finalize();
    await postStored(stored);
  } catch (cause) {
    await failStored(stored);
    throw cause;
  } finally {
    videoInput.dispose();
    audioInput.dispose();
  }
}

async function thumbnail(file: File, timestamp: number): Promise<void> {
  const { VideoSampleSink } = await import('mediabunny');
  const input = await createInput(file);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) throw new Error('VIDEO_REQUIRED');
    const sample = await new VideoSampleSink(track).getSample(timestamp);
    if (!sample) throw new Error('FRAME_UNAVAILABLE');
    try {
      const canvas = new OffscreenCanvas(
        sample.displayWidth,
        sample.displayHeight,
      );
      const drawing = canvas.getContext('2d', { alpha: false });
      if (!drawing) throw new Error('CANVAS_UNAVAILABLE');
      sample.draw(drawing, 0, 0);
      const blob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: 0.92,
      });
      context.postMessage({
        type: 'blob',
        blob,
        fileName: 'thumbnail.jpg',
      } satisfies MediaWorkerResponse);
    } finally {
      sample.close();
    }
  } finally {
    input.dispose();
  }
}

async function mergeVideo(files: File[]): Promise<void> {
  const {
    AudioSampleSink,
    AudioSampleSource,
    QUALITY_HIGH,
    VideoSampleSink,
    VideoSampleSource,
    WebMOutputFormat,
  } = await import('mediabunny');
  if (files.length < 2) throw new Error('MULTIPLE_FILES_REQUIRED');
  const inputs = await Promise.all(files.map(createInput));
  const videoTracks = await Promise.all(
    inputs.map((input) => input.getPrimaryVideoTrack()),
  );
  if (videoTracks.some((track) => track === null)) {
    inputs.forEach((input) => input.dispose());
    throw new Error('VIDEO_REQUIRED');
  }
  const audioTracks = await Promise.all(
    inputs.map((input) => input.getPrimaryAudioTrack()),
  );
  const firstAudio = audioTracks.find((track) => track !== null) ?? null;
  const stored = await createStoredOutput(new WebMOutputFormat(), 'merged');
  const videoSource = new VideoSampleSource({
    codec: 'vp9',
    quality: QUALITY_HIGH,
    sizeChangeBehavior: 'contain',
  });
  const audioSource = firstAudio
    ? new AudioSampleSource({
        codec: 'opus',
        quality: QUALITY_HIGH,
        transform: {
          numberOfChannels: await firstAudio.getNumberOfChannels(),
          sampleRate: await firstAudio.getSampleRate(),
        },
      })
    : null;
  stored.output.addVideoTrack(videoSource);
  if (audioSource) stored.output.addAudioTrack(audioSource);
  stored.output.setMetadataTags({});
  try {
    await stored.output.start();
    let offset = 0;
    for (let index = 0; index < inputs.length; index += 1) {
      const input = inputs[index]!;
      const videoTrack = videoTracks[index]!;
      const audioTrack = audioTracks[index];
      const addVideo = async () => {
        const firstTimestamp = await videoTrack.getFirstTimestamp();
        for await (const sample of new VideoSampleSink(videoTrack).samples()) {
          sample.setTimestamp(offset + sample.timestamp - firstTimestamp);
          await videoSource.add(sample);
          sample.close();
        }
      };
      const addAudio = async () => {
        if (!audioSource || !audioTrack) return;
        const firstTimestamp = await audioTrack.getFirstTimestamp();
        for await (const sample of new AudioSampleSink(audioTrack).samples()) {
          sample.setTimestamp(offset + sample.timestamp - firstTimestamp);
          await audioSource.add(sample);
          sample.close();
        }
      };
      await Promise.all([addVideo(), addAudio()]);
      offset += await durationOf(input);
      postProgress((index + 1) / inputs.length);
    }
    videoSource.close();
    audioSource?.close();
    await stored.output.finalize();
    await postStored(stored);
  } catch (cause) {
    await failStored(stored);
    throw cause;
  } finally {
    inputs.forEach((input) => input.dispose());
  }
}

async function waveform(file: File, buckets: number): Promise<void> {
  const { AudioSampleSink } = await import('mediabunny');
  const input = await createInput(file);
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) throw new Error('AUDIO_REQUIRED');
    const duration = await durationOf(input);
    const peaks = Array.from({ length: buckets }, () => 0);
    for await (const sample of new AudioSampleSink(track).samples()) {
      const data = new Float32Array(
        sample.numberOfFrames * sample.numberOfChannels,
      );
      sample.copyTo(data, { planeIndex: 0, format: 'f32' });
      const step = Math.max(1, sample.numberOfChannels * 8);
      for (let index = 0; index < data.length; index += step) {
        const frame = Math.floor(index / sample.numberOfChannels);
        const timestamp = sample.timestamp + frame / sample.sampleRate;
        const bucket = Math.min(
          buckets - 1,
          Math.max(0, Math.floor((timestamp / duration) * buckets)),
        );
        peaks[bucket] = Math.max(peaks[bucket]!, Math.abs(data[index]!));
      }
      sample.close();
    }
    context.postMessage({
      type: 'waveform',
      peaks,
      duration,
    } satisfies MediaWorkerResponse);
  } finally {
    input.dispose();
  }
}

async function trimAudio(
  file: File,
  start: number,
  end: number,
): Promise<void> {
  const { Conversion, WavOutputFormat } = await import('mediabunny');
  const input = await createInput(file);
  const stored = await createStoredOutput(new WavOutputFormat(), 'clip');
  try {
    const conversion = await Conversion.init({
      input,
      output: stored.output,
      tracks: 'primary',
      video: { discard: true },
      audio: { codec: 'pcm-s16' },
      trim: { start, end },
      tags: {},
      showWarnings: false,
    });
    if (!conversion.isValid) throw new Error('CONVERSION_UNAVAILABLE');
    conversion.onProgress = postProgress;
    await conversion.execute();
    await postStored(stored);
  } catch (cause) {
    await failStored(stored);
    throw cause;
  } finally {
    input.dispose();
  }
}

async function mergeAudio(files: File[]): Promise<void> {
  const { AudioSampleSink, AudioSampleSource, WavOutputFormat } =
    await import('mediabunny');
  if (files.length < 2) throw new Error('MULTIPLE_FILES_REQUIRED');
  const inputs = await Promise.all(files.map(createInput));
  const tracks = await Promise.all(
    inputs.map((input) => input.getPrimaryAudioTrack()),
  );
  if (tracks.some((track) => track === null)) {
    inputs.forEach((input) => input.dispose());
    throw new Error('AUDIO_REQUIRED');
  }
  const first = tracks[0]!;
  const source = new AudioSampleSource({
    codec: 'pcm-s16',
    transform: {
      numberOfChannels: await first.getNumberOfChannels(),
      sampleRate: await first.getSampleRate(),
    },
  });
  const stored = await createStoredOutput(new WavOutputFormat(), 'merged');
  stored.output.addAudioTrack(source);
  stored.output.setMetadataTags({});
  try {
    await stored.output.start();
    let offset = 0;
    for (let index = 0; index < tracks.length; index += 1) {
      const track = tracks[index]!;
      const firstTimestamp = await track.getFirstTimestamp();
      for await (const sample of new AudioSampleSink(track).samples()) {
        sample.setTimestamp(offset + sample.timestamp - firstTimestamp);
        await source.add(sample);
        sample.close();
      }
      offset += await durationOf(inputs[index]!);
      postProgress((index + 1) / tracks.length);
    }
    source.close();
    await stored.output.finalize();
    await postStored(stored);
  } catch (cause) {
    await failStored(stored);
    throw cause;
  } finally {
    inputs.forEach((input) => input.dispose());
  }
}

async function videoAnimation(
  request: Extract<MediaWorkerRequest, { type: 'video-animation' }>,
): Promise<void> {
  const { VideoSampleSink } = await import('mediabunny');
  const input = await createInput(request.file);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) throw new Error('VIDEO_REQUIRED');
    const sink = new VideoSampleSink(track);
    const frameCount = Math.ceil(
      (request.end - request.start) * request.frameRate,
    );
    if (frameCount <= 0 || frameCount > MAX_ANIMATION_FRAMES) {
      throw new Error('ANIMATION_TOO_LARGE');
    }
    const sourceWidth = await track.getDisplayWidth();
    const sourceHeight = await track.getDisplayHeight();
    const width = Math.min(sourceWidth, request.maxWidth);
    const height = Math.max(
      1,
      Math.round((sourceHeight / sourceWidth) * width),
    );
    if (width * height * 4 * frameCount > MAX_ANIMATION_BYTES) {
      throw new Error('ANIMATION_TOO_LARGE');
    }
    const canvas = new OffscreenCanvas(width, height);
    const drawing = canvas.getContext('2d', { alpha: true });
    if (!drawing) throw new Error('CANVAS_UNAVAILABLE');
    const frames: Array<{
      data: Uint8Array<ArrayBuffer>;
      duration: number;
    }> = [];
    for (let index = 0; index < frameCount; index += 1) {
      const timestamp = request.start + index / Math.max(1, request.frameRate);
      const sample = await sink.getSample(timestamp);
      if (!sample) break;
      drawing.clearRect(0, 0, width, height);
      sample.draw(drawing, 0, 0, width, height);
      const image = drawing.getImageData(0, 0, width, height);
      const data = new Uint8Array(image.data.length);
      data.set(image.data);
      frames.push({
        data,
        duration: Math.max(10, Math.round(1000 / request.frameRate)),
      });
      sample.close();
      postProgress((index + 1) / frameCount / 2);
    }
    if (frames.length === 0) throw new Error('FRAME_UNAVAILABLE');
    let blob: Blob;
    if (request.format === 'gif') {
      const { encode } = await import('modern-gif');
      const output = await encode({
        width,
        height,
        frames: frames.map((frame) => ({
          data: frame.data,
          delay: frame.duration,
        })),
        looped: true,
        loopCount: 0,
        maxColors: 255,
        format: 'arrayBuffer',
      });
      blob = new Blob([output], { type: 'image/gif' });
    } else {
      const webp = await import('wasm-webp');
      const output = await webp.encodeAnimation(
        width,
        height,
        true,
        frames.map((frame) => ({
          data: frame.data,
          duration: frame.duration,
          config: { lossless: 0, quality: request.quality },
        })),
      );
      if (!output) throw new Error('ENCODE_FAILED');
      blob = new Blob([output.slice().buffer], { type: 'image/webp' });
    }
    postProgress(1);
    context.postMessage({
      type: 'blob',
      blob,
      fileName: `animation.${request.format}`,
      frameCount: frames.length,
    } satisfies MediaWorkerResponse);
  } finally {
    input.dispose();
  }
}

async function burnSubtitles(
  request: Extract<MediaWorkerRequest, { type: 'burn-subtitles' }>,
): Promise<void> {
  const { Conversion, WebMOutputFormat } = await import('mediabunny');
  const input = await createInput(request.file);
  const stored = await createStoredOutput(new WebMOutputFormat(), 'subtitled');
  let canvas: OffscreenCanvas | null = null;
  let drawing: OffscreenCanvasRenderingContext2D | null = null;
  try {
    const conversion = await Conversion.init({
      input,
      output: stored.output,
      tracks: 'primary',
      video: {
        forceTranscode: true,
        process: (sample) => {
          if (!canvas || !drawing) {
            canvas = new OffscreenCanvas(
              sample.displayWidth,
              sample.displayHeight,
            );
            drawing = canvas.getContext('2d', { alpha: false });
          }
          if (!drawing) throw new Error('CANVAS_UNAVAILABLE');
          sample.draw(drawing, 0, 0, canvas.width, canvas.height);
          const cue = request.cues.find(
            (item) =>
              sample.timestamp >= item.start && sample.timestamp < item.end,
          );
          if (cue) {
            const fontSize = Math.max(20, Math.round(canvas.height * 0.045));
            const lines = cue.text.split('\n').slice(0, 3);
            drawing.font = `600 ${fontSize}px sans-serif`;
            drawing.textAlign = 'center';
            drawing.textBaseline = 'bottom';
            drawing.lineWidth = Math.max(3, fontSize * 0.16);
            drawing.strokeStyle = 'rgba(0,0,0,.9)';
            drawing.fillStyle = '#fff';
            lines.forEach((line, index) => {
              const y =
                canvas!.height -
                fontSize * 0.8 -
                (lines.length - 1 - index) * fontSize * 1.25;
              drawing!.strokeText(line, canvas!.width / 2, y);
              drawing!.fillText(line, canvas!.width / 2, y);
            });
          }
          return canvas;
        },
      },
      showWarnings: false,
    });
    if (!conversion.isValid) throw new Error('CONVERSION_UNAVAILABLE');
    conversion.onProgress = postProgress;
    await conversion.execute();
    await postStored(stored);
  } catch (cause) {
    await failStored(stored);
    throw cause;
  } finally {
    input.dispose();
  }
}

async function handle(request: MediaWorkerRequest): Promise<void> {
  switch (request.type) {
    case 'cleanup':
      return cleanup();
    case 'inspect':
      return inspect(request.file);
    case 'video-transform':
      return transformVideo(request);
    case 'merge-video':
      return mergeVideo(request.files);
    case 'extract-audio':
      return extractAudio(request.file);
    case 'replace-audio':
      return replaceAudio(request.video, request.audio);
    case 'thumbnail':
      return thumbnail(request.file, request.timestamp);
    case 'video-animation':
      return videoAnimation(request);
    case 'waveform':
      return waveform(request.file, request.buckets);
    case 'trim-audio':
      return trimAudio(request.file, request.start, request.end);
    case 'merge-audio':
      return mergeAudio(request.files);
    case 'burn-subtitles':
      return burnSubtitles(request);
  }
}

context.onmessage = (event: MessageEvent<MediaWorkerRequest>) => {
  void handle(event.data).catch((cause: unknown) => {
    context.postMessage({
      type: 'error',
      error: cause instanceof Error ? cause.message : String(cause),
    } satisfies MediaWorkerResponse);
  });
};

export {};
