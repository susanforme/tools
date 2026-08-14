import type { EditorAsset } from './webav-editor';

export const EDITOR_WAVEFORM_BINS = 160;

export type EditorAssetAnalysis = {
  version: 1;
  assetId: string;
  duration: number;
  video: {
    codec: string | null;
    codecParameter: string | null;
    width: number;
    height: number;
    fps: number;
  } | null;
  audio: {
    codec: string | null;
    codecParameter: string | null;
    sampleRate: number;
    channels: number;
  } | null;
  waveform: number[];
};

type AnalysisWorkerResponse =
  | { id: string; type: 'done'; result: EditorAssetAnalysis }
  | { id: string; type: 'error'; error: string };

type PendingAnalysis = {
  resolve: (result: EditorAssetAnalysis) => void;
  reject: (reason: Error) => void;
};

let analysisWorker: Worker | null = null;
const pendingAnalyses = new Map<string, PendingAnalysis>();

function failAnalysisWorker(): void {
  for (const pending of pendingAnalyses.values()) {
    pending.reject(new Error('EDITOR_ANALYSIS_WORKER_FAILED'));
  }
  pendingAnalyses.clear();
  analysisWorker?.terminate();
  analysisWorker = null;
}

function getAnalysisWorker(): Worker {
  if (analysisWorker) return analysisWorker;
  analysisWorker = new Worker(
    new URL('../workers/video-editor-analysis.worker.ts', import.meta.url),
    { type: 'module', name: 'video-editor-analysis' },
  );
  analysisWorker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
    const pending = pendingAnalyses.get(event.data.id);
    if (!pending) return;
    pendingAnalyses.delete(event.data.id);
    if (event.data.type === 'done') pending.resolve(event.data.result);
    else pending.reject(new Error(event.data.error));
  };
  analysisWorker.onerror = failAnalysisWorker;
  analysisWorker.onmessageerror = failAnalysisWorker;
  return analysisWorker;
}

export function analyzeEditorAsset(
  sessionId: string,
  asset: EditorAsset,
): Promise<EditorAssetAnalysis> {
  if (asset.kind !== 'video' && asset.kind !== 'audio') {
    return Promise.reject(new Error('MEDIA_ASSET_REQUIRED'));
  }
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pendingAnalyses.set(id, { resolve, reject });
    try {
      getAnalysisWorker().postMessage({ id, sessionId, asset });
    } catch (cause) {
      pendingAnalyses.delete(id);
      reject(cause instanceof Error ? cause : new Error(String(cause)));
    }
  });
}

export function accumulateWaveformPeaks(
  peaks: Float32Array,
  duration: number,
  timestamp: number,
  sampleRate: number,
  channels: number,
  samples: Float32Array,
): void {
  const frames = Math.floor(samples.length / channels);
  for (let frame = 0; frame < frames; frame += 1) {
    let peak = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      peak = Math.max(peak, Math.abs(samples[frame * channels + channel]));
    }
    const time = timestamp + frame / sampleRate;
    const bin = Math.min(
      peaks.length - 1,
      Math.max(0, Math.floor((time / duration) * peaks.length)),
    );
    peaks[bin] = Math.max(peaks[bin], Math.min(1, peak));
  }
}
