import { REPORT_MAX_BYTES } from '../lib/observability-report';
self.onmessage = async (
  event: MessageEvent<{
    kind: 'lighthouse' | 'otel' | 'explain' | 'rrweb';
    file: File;
  }>,
): Promise<void> => {
  try {
    const { kind, file } = event.data;
    if (!(file instanceof Blob) || file.size > REPORT_MAX_BYTES)
      throw new Error('sizeLimit');
    const source = await file.text();
    const result =
      kind === 'lighthouse'
        ? (await import('../lib/lighthouse-report')).parseLighthouse(source)
        : kind === 'otel'
          ? (await import('../lib/otel-viewer')).parseOtel(source)
          : kind === 'explain'
            ? (await import('../lib/postgres-explain')).parseExplain(source)
            : kind === 'rrweb'
              ? (await import('../lib/rrweb-player')).parseRrweb(source)
              : null;
    if (result === null) throw new Error('invalidFormat');
    self.postMessage({ result });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
