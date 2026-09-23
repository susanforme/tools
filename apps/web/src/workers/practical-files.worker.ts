import { processFileTask, type FileTask } from '@/lib/practical-files';
self.onmessage = async (event: MessageEvent<FileTask>) => {
  try {
    self.postMessage({ result: await processFileTask(event.data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
