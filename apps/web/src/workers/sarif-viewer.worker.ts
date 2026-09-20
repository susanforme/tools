import { parseSarif, SARIF_MAX_BYTES } from '../lib/sarif-viewer';
self.onmessage = async (event: MessageEvent<File>): Promise<void> => {
  try {
    if (!(event.data instanceof Blob) || event.data.size > SARIF_MAX_BYTES)
      throw new Error('sizeLimit');
    self.postMessage({ result: parseSarif(await event.data.text()) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
