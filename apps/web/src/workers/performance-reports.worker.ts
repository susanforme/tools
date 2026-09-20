import { PERFORMANCE_MAX_BYTES } from '../lib/performance-reports';
self.onmessage = async (
  event: MessageEvent<{
    kind: 'heap' | 'trace' | 'netlog' | 'playwright';
    file: File;
  }>,
): Promise<void> => {
  try {
    const { kind, file } = event.data;
    if (!(file instanceof Blob) || file.size > PERFORMANCE_MAX_BYTES)
      throw new Error('sizeLimit');
    if (kind === 'heap') {
      const { parseHeapSnapshot } = await import('../lib/heap-snapshot');
      const result = parseHeapSnapshot(await file.text());
      self.postMessage(
        { result },
        {
          transfer: [
            result.edges.buffer,
            result.outgoing.buffer,
            result.incoming.buffer,
            result.incomingEdges.buffer,
          ],
        },
      );
    } else if (kind === 'trace')
      self.postMessage({
        result: (await import('../lib/chrome-trace')).parseChromeTrace(
          await file.text(),
        ),
      });
    else if (kind === 'netlog')
      self.postMessage({
        result: (await import('../lib/netlog-viewer')).parseNetlog(
          await file.text(),
        ),
      });
    else if (kind === 'playwright')
      self.postMessage({
        result: await (
          await import('../lib/playwright-trace')
        ).parsePlaywrightTrace(new Uint8Array(await file.arrayBuffer())),
      });
    else throw new Error('invalidFormat');
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
