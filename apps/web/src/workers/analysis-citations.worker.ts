import {
  processCitations,
  type CitationRequest,
} from '@/lib/analysis-citations';
self.onmessage = async (event: MessageEvent<CitationRequest>) => {
  try {
    self.postMessage({ result: await processCitations(event.data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
