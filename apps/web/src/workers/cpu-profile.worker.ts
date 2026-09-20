import { analyzeCpuProfile, CPU_PROFILE_MAX_BYTES } from '../lib/cpu-profile';

self.onmessage = async (event: MessageEvent<File>) => {
  try {
    if (event.data.size > CPU_PROFILE_MAX_BYTES) throw new Error('sizeLimit');
    self.postMessage({ result: analyzeCpuProfile(await event.data.text()) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
