/// <reference lib="webworker" />

import {
  VIDEO_TRIMMER_DIRECTORY,
  type VideoTrimmerRequest,
  type VideoTrimmerResponse,
} from '@/lib/video-trimmer';

const context = self as DedicatedWorkerGlobalScope;

async function getDirectory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(VIDEO_TRIMMER_DIRECTORY, { create: true });
}

async function createInput(file: File) {
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

async function inspect(file: File): Promise<void> {
  const input = await createInput(file);
  try {
    const duration =
      (await input.getDurationFromMetadata()) ??
      (await input.computeDuration(undefined, { skipLiveWait: true }));
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('INVALID_DURATION');
    }
    context.postMessage({
      type: 'inspected',
      duration,
      mimeType: await input.getMimeType(),
    } satisfies VideoTrimmerResponse);
  } finally {
    input.dispose();
  }
}

async function trim(
  request: Extract<VideoTrimmerRequest, { type: 'trim' }>,
): Promise<void> {
  const {
    Conversion,
    Mp4OutputFormat,
    Output,
    StreamTarget,
    WebMOutputFormat,
  } = await import('mediabunny');
  const input = await createInput(request.file);
  const directory = await getDirectory();
  const fileName = `clip-${crypto.randomUUID()}.${request.format}`;
  const handle = await directory.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();

  try {
    const target = new StreamTarget(
      writable as unknown as WritableStream<
        import('mediabunny').StreamTargetChunk
      >,
      { chunked: true },
    );
    const output = new Output({
      format:
        request.format === 'mp4'
          ? new Mp4OutputFormat()
          : new WebMOutputFormat(),
      target,
    });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      trim: { start: request.start, end: request.end },
      showWarnings: false,
    });
    if (!conversion.isValid) throw new Error('CONVERSION_UNAVAILABLE');
    conversion.onProgress = (progress) => {
      context.postMessage({
        type: 'progress',
        progress,
      } satisfies VideoTrimmerResponse);
    };
    await conversion.execute();
    const file = await handle.getFile();
    context.postMessage({
      type: 'trimmed',
      fileName,
      size: file.size,
      mimeType: request.format === 'mp4' ? 'video/mp4' : 'video/webm',
    } satisfies VideoTrimmerResponse);
  } catch (cause) {
    await writable.abort().catch(() => undefined);
    await directory.removeEntry(fileName).catch(() => undefined);
    throw cause;
  } finally {
    input.dispose();
  }
}

context.onmessage = (event: MessageEvent<VideoTrimmerRequest>) => {
  const task =
    event.data.type === 'inspect' ? inspect(event.data.file) : trim(event.data);
  void task.catch((cause: unknown) => {
    context.postMessage({
      type: 'error',
      error: cause instanceof Error ? cause.message : String(cause),
    } satisfies VideoTrimmerResponse);
  });
};

export {};
