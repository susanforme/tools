import {
  editPhotoBatch,
  type PhotoBatchRequest,
} from '../lib/batch4-organizer-photo';
self.onmessage = async (event: MessageEvent<PhotoBatchRequest>) => {
  try {
    self.postMessage({ result: await editPhotoBatch(event.data) });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
