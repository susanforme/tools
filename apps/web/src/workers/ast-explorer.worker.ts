import { parseAst, type AstRequest } from '../lib/ast-explorer';
self.onmessage = async ({ data }: MessageEvent<AstRequest>) => {
  try {
    self.postMessage({ result: await parseAst(data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
