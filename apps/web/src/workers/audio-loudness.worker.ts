import { analyzeAudioLoudness } from '../lib/audio-loudness';

self.onmessage = (event: MessageEvent<{ channels: Float32Array[]; sampleRate: number }>) => {
  try { self.postMessage({ result: analyzeAudioLoudness(event.data.channels, event.data.sampleRate) }); }
  catch (cause) { self.postMessage({ error: (cause as Error).message }); }
};
