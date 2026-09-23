import { statistics, type StatisticsRequest } from '../lib/statistical-tests';
self.onmessage = async (event: MessageEvent<StatisticsRequest>) => {
  try {
    self.postMessage({ result: await statistics(event.data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
