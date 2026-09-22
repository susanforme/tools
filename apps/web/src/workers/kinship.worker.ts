import { calculateKinship, type KinshipRequest } from '../lib/kinship';

self.onmessage = async (event: MessageEvent<KinshipRequest>) => {
  try {
    self.postMessage({ result: await calculateKinship(event.data) });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
