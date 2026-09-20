import { compareLockfiles, type LockfileRequest } from '../lib/lockfile-diff';
self.onmessage = async (
  event: MessageEvent<LockfileRequest>,
): Promise<void> => {
  try {
    self.postMessage({ result: await compareLockfiles(event.data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
