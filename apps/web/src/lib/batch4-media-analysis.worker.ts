import { analyzeAudio, parseGcode } from './batch4-media-analysis';
self.onmessage = (
  event: MessageEvent<
    | { type: 'audio'; channels: Float32Array[]; sampleRate: number }
    | { type: 'gcode'; source: string }
  >,
) => {
  try {
    const q = event.data;
    self.postMessage({
      result:
        q.type === 'audio'
          ? analyzeAudio(q.channels, q.sampleRate)
          : parseGcode(q.source),
    });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
