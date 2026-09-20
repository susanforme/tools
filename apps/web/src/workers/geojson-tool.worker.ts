import { inspectGeoJson } from '../lib/geojson-tool';
self.onmessage = async (
  event: MessageEvent<{ input: string }>,
): Promise<void> => {
  try {
    self.postMessage({ result: await inspectGeoJson(event.data.input) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
