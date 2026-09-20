import { compareSbom, parseSbom, type SbomRequest } from '../lib/sbom-viewer';
self.onmessage = async ({ data }: MessageEvent<SbomRequest>) => {
  try {
    if (
      data.before.size > 5 * 1024 * 1024 ||
      (data.after?.size ?? 0) > 5 * 1024 * 1024
    )
      throw new Error('LIMIT');
    const before = parseSbom(await data.before.text());
    const after = data.after ? parseSbom(await data.after.text()) : null;
    self.postMessage({
      result: {
        before,
        after,
        changes: after ? compareSbom(before, after) : [],
      },
    });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
