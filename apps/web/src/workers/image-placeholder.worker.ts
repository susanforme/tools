import {
  createImagePlaceholder,
  type PlaceholderRequest,
} from '@/lib/image-placeholder';
self.onmessage = async (event: MessageEvent<PlaceholderRequest>) => {
  try {
    self.postMessage({ result: await createImagePlaceholder(event.data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
