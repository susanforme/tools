import {
  transformJsonata,
  type JsonataRequest,
} from '../lib/jsonata-transform';
self.onmessage = async (event: MessageEvent<JsonataRequest>): Promise<void> => {
  try {
    self.postMessage({ result: await transformJsonata(event.data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
