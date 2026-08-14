/// <reference lib="webworker" />

import {
  accumulateWaveformPeaks,
  EDITOR_WAVEFORM_BINS,
  type EditorAssetAnalysis,
} from '@/lib/video-editor-analysis';
import { VIDEO_EDITOR_CONFIG } from '@/lib/video-editor-config';
import type { EditorAsset } from '@/lib/webav-editor';

type AnalysisRequest = {
  id: string;
  sessionId: string;
  asset: EditorAsset;
};

type StoredAnalysis = {
  cacheKey: string;
  result: EditorAssetAnalysis;
};

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

async function readCachedAnalysis(
  directory: FileSystemDirectoryHandle,
  asset: EditorAsset,
): Promise<EditorAssetAnalysis | null> {
  try {
    const file = await (
      await directory.getFileHandle(`${asset.id}.json`)
    ).getFile();
    const stored = JSON.parse(await file.text()) as StoredAnalysis;
    const cacheKey = `${asset.storageName}:${asset.size}`;
    return stored.cacheKey === cacheKey && stored.result?.version === 1
      ? stored.result
      : null;
  } catch {
    return null;
  }
}

async function writeCachedAnalysis(
  directory: FileSystemDirectoryHandle,
  asset: EditorAsset,
  result: EditorAssetAnalysis,
): Promise<void> {
  const handle = await directory.getFileHandle(`${asset.id}.json`, {
    create: true,
  });
  const writable = await handle.createWritable();
  await writable.write(
    JSON.stringify({
      cacheKey: `${asset.storageName}:${asset.size}`,
      result,
    } satisfies StoredAnalysis),
  );
  await writable.close();
}

async function analyze(request: AnalysisRequest): Promise<void> {
  if (request.asset.kind !== 'video' && request.asset.kind !== 'audio') {
    throw new Error('MEDIA_ASSET_REQUIRED');
  }
  const session = await getSessionDirectory(request.sessionId);
  const analysisDirectory = await session.getDirectoryHandle('analysis', {
    create: true,
  });
  const cached = await readCachedAnalysis(analysisDirectory, request.asset);
  if (cached) {
    context.postMessage({ id: request.id, type: 'done', result: cached });
    return;
  }

  const { ALL_FORMATS, AudioSampleSink, BlobSource, Input } =
    await import('mediabunny');
  const source = await (
    await session.getFileHandle(request.asset.storageName)
  ).getFile();
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(source),
  });

  try {
    if (!(await input.canRead())) throw new Error('UNSUPPORTED_MEDIA');
    const [duration, videoTrack, audioTrack] = await Promise.all([
      input.computeDuration(),
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
    ]);

    const video = videoTrack
      ? await (async () => {
          const [codec, codecParameter, width, height, stats] =
            await Promise.all([
              videoTrack.getCodec(),
              videoTrack.getCodecParameterString(),
              videoTrack.getDisplayWidth(),
              videoTrack.getDisplayHeight(),
              videoTrack.computePacketStats(100),
            ]);
          return {
            codec,
            codecParameter,
            width,
            height,
            fps: Number.isFinite(stats.averagePacketRate)
              ? Number(stats.averagePacketRate.toFixed(2))
              : 0,
          };
        })()
      : null;

    const audio = audioTrack
      ? await (async () => {
          const [codec, codecParameter, sampleRate, channels] =
            await Promise.all([
              audioTrack.getCodec(),
              audioTrack.getCodecParameterString(),
              audioTrack.getSampleRate(),
              audioTrack.getNumberOfChannels(),
            ]);
          return { codec, codecParameter, sampleRate, channels };
        })()
      : null;

    const peaks = new Float32Array(EDITOR_WAVEFORM_BINS);
    if (audioTrack && duration > 0 && (await audioTrack.canDecode())) {
      const sink = new AudioSampleSink(audioTrack);
      for await (const sample of sink.samples()) {
        try {
          const options = { format: 'f32', planeIndex: 0 } as const;
          const samples = new Float32Array(
            sample.allocationSize(options) / Float32Array.BYTES_PER_ELEMENT,
          );
          sample.copyTo(samples, options);
          accumulateWaveformPeaks(
            peaks,
            duration,
            sample.timestamp,
            sample.sampleRate,
            sample.numberOfChannels,
            samples,
          );
        } finally {
          sample.close();
        }
      }
    }

    const result: EditorAssetAnalysis = {
      version: 1,
      assetId: request.asset.id,
      duration,
      video,
      audio,
      waveform: Array.from(peaks, (peak) => Number(peak.toFixed(4))),
    };
    await writeCachedAnalysis(analysisDirectory, request.asset, result);
    context.postMessage({ id: request.id, type: 'done', result });
  } finally {
    input.dispose();
  }
}

let queue = Promise.resolve();
context.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  queue = queue
    .then(() => analyze(event.data))
    .catch((cause: unknown) => {
      context.postMessage({
        id: event.data.id,
        type: 'error',
        error: cause instanceof Error ? cause.message : String(cause),
      });
    });
};
