import { balanceEquation } from '@/lib/batch4-chemistry';
self.onmessage = (event: MessageEvent<string>) => {
  try {
    self.postMessage({ result: balanceEquation(event.data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
