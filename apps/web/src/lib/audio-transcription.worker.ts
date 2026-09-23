import type { TranscriptSegment } from './media-workspace-core';
self.onmessage = async (
  event: MessageEvent<{ samples: Float32Array; language: string }>,
) => {
  try {
    const { samples, language } = event.data;
    if (!samples.length || samples.length > 16000 * 180)
      throw new Error('audioLimit');
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    if (env.backends.onnx.wasm) {
      env.backends.onnx.wasm.numThreads = 1;
      env.backends.onnx.wasm.wasmPaths =
        'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/';
    }
    self.postMessage({ stage: 'download' });
    const transcriber = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny',
      {
        device: 'wasm',
        dtype: 'q8',
        progress_callback: (info: unknown) => {
          if (info && typeof info === 'object') {
            const e = info as Record<string, unknown>;
            self.postMessage({
              progress: {
                status: e.status,
                file: e.file,
                loaded: e.loaded,
                total: e.total,
                progress: e.progress,
              },
            });
          }
        },
      },
    );
    self.postMessage({ stage: 'infer' });
    try {
      const result = await transcriber(samples, {
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
        ...(language !== 'auto' ? { language } : {}),
        task: 'transcribe',
      });
      const output = Array.isArray(result) ? result[0]! : result;
      const segments: TranscriptSegment[] = (output.chunks ?? [])
        .map((chunk, i, all) => ({
          start: chunk.timestamp[0] ?? 0,
          end:
            chunk.timestamp[1] ??
            all[i + 1]?.timestamp[0] ??
            samples.length / 16000,
          text: chunk.text.trim(),
        }))
        .filter((chunk) => chunk.text && chunk.end > chunk.start);
      if (!segments.length && output.text.trim())
        segments.push({
          start: 0,
          end: samples.length / 16000,
          text: output.text.trim(),
        });
      self.postMessage({ result: segments });
    } finally {
      await transcriber.dispose();
    }
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
