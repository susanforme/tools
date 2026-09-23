import { astronomy, type AstronomyRequest } from '../lib/astronomy-calculations';
self.onmessage = async (event: MessageEvent<AstronomyRequest>) => {
  try {
    self.postMessage({ result: await astronomy(event.data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
