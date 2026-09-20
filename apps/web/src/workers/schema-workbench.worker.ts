import {
  analyzeAsyncApi,
  evaluateCel,
  inspectSpdx,
  type SchemaRequest,
} from '../lib/schema-workbench';
self.onmessage = async ({ data }: MessageEvent<SchemaRequest>) => {
  try {
    const result =
      data.kind === 'asyncapi'
        ? await analyzeAsyncApi(data.source)
        : data.kind === 'cel'
          ? await evaluateCel(data.source, data.data ?? '{}', !!data.integers)
          : await inspectSpdx(data.source);
    if (result.output.length > 2 * 1024 * 1024) throw new Error('LIMIT');
    self.postMessage({ result });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
