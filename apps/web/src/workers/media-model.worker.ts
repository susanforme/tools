import { measureTriangles } from '../lib/media-model';
self.onmessage = (event: MessageEvent<number[]>) => {
  try {
    self.postMessage({ result: measureTriangles(event.data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
