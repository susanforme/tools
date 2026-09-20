import {
  analyzeCompatibility,
  type CompatRequest,
} from '../lib/browser-compat';
self.onmessage = async ({ data }: MessageEvent<CompatRequest>) => {
  try {
    self.postMessage({ result: await analyzeCompatibility(data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
