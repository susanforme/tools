import { processAudio, type AudioTask } from '../lib/media-audio';
self.onmessage = (event: MessageEvent<AudioTask>) => {
  try {
    self.postMessage({ result: processAudio(event.data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
