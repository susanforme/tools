import { readParquetPreview } from '../lib/parquet-viewer';

self.onmessage = async (event: MessageEvent<File>) => {
  try {
    self.postMessage({ result: await readParquetPreview(event.data) });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
