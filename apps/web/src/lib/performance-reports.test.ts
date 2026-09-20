import { readFileSync } from 'node:fs';
import { getHeapSnapshot } from 'node:v8';
import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import {
  parseHeapSnapshot,
  heapReferences,
  compareHeapGroups,
} from './heap-snapshot';
import { parseChromeTrace } from './chrome-trace';
import { parseNetlog } from './netlog-viewer';
import { parsePlaywrightTrace, unzipTraceEntries } from './playwright-trace';

describe('performance report formats', () => {
  it('reads a real V8 snapshot using metadata field offsets and navigates references', async () => {
    class HeapReferenceFixture {
      payload = { marker: 'performance-reference-check' };
    }
    const holder = globalThis as typeof globalThis & {
      __heapFixture?: HeapReferenceFixture;
    };
    holder.__heapFixture = new HeapReferenceFixture();
    const chunks: Buffer[] = [];
    try {
      for await (const chunk of getHeapSnapshot())
        chunks.push(Buffer.from(chunk));
    } finally {
      delete holder.__heapFixture;
    }
    const report = parseHeapSnapshot(Buffer.concat(chunks).toString());
    const index = report.nodes.findIndex(
      (node) => node.type === 'object' && node.name === 'HeapReferenceFixture',
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const refs = heapReferences(report, index, 'outgoing', 0);
    const payload = refs.rows.find((edge) => edge.name === 'payload');
    expect(payload).toBeDefined();
    expect(
      heapReferences(report, payload!.node, 'incoming', 0).rows.some(
        (edge) => edge.node === index,
      ),
    ).toBe(true);
    expect(
      compareHeapGroups(report, report).every(
        (group) => group.deltaCount === 0 && group.deltaSize === 0,
      ),
    ).toBe(true);
  }, 20_000);
  it('merges nested B/E within each thread, handles complete and instant records, and excludes slow child slices from long tasks', () => {
    const report = parseChromeTrace(
      JSON.stringify({
        traceEvents: [
          {
            ph: 'M',
            pid: 1,
            tid: 1,
            name: 'thread_name',
            args: { name: 'main' },
          },
          { ph: 'B', pid: 1, tid: 1, ts: 1000, name: 'RunTask' },
          {
            ph: 'X',
            pid: 1,
            tid: 1,
            ts: 2000,
            dur: 55000,
            name: 'EvaluateScript',
          },
          { ph: 'E', pid: 1, tid: 1, ts: 61000 },
          { ph: 'I', pid: 1, tid: 2, ts: 63000, name: 'point' },
          { ph: 'B', pid: 1, tid: 2, ts: 64000, name: 'unfinished' },
          { ph: 's', pid: 1, tid: 2, ts: 65000, name: 'flow' },
        ],
      }),
    );
    expect(report.events[0]).toMatchObject({
      duration: 60,
      start: 0,
      task: true,
      incomplete: false,
    });
    expect(report.events[1]).toMatchObject({
      duration: 55,
      start: 1,
      task: false,
    });
    expect(report.unmatched).toBe(1);
    expect(report.unsupported).toBe(1);
    expect(report.threads[0].name).toContain('main');
    expect(() => parseChromeTrace('{"nodes":[],"samples":[]}')).toThrow(
      'invalidFormat',
    );
  });
  it('decodes NetLog constants, sorts ticks, and links Sources bidirectionally without conflating successful events', () => {
    const report = parseNetlog(
      JSON.stringify({
        constants: {
          logEventTypes: { CONNECT: 2 },
          logSourceType: { SOCKET: 3 },
          logEventPhase: { PHASE_END: 2 },
          netError: { ERR_REFUSED: -102 },
          timeTickOffset: '1700000000000',
        },
        events: [
          {
            time: '1020',
            type: 2,
            phase: 2,
            source: { id: 2, type: 3 },
            params: { net_error: -102 },
          },
          {
            time: '1000',
            type: 2,
            phase: 1,
            source: { id: 1, type: 3 },
            params: { source_dependency: { id: 2, type: 3 }, net_error: 0 },
          },
        ],
      }),
    );
    expect(report.events[0]).toMatchObject({
      time: 0,
      source: '1',
      errors: [],
    });
    expect(report.events[1]).toMatchObject({
      time: 20,
      type: 'CONNECT',
      phase: 'PHASE_END',
      errors: ['ERR_REFUSED'],
    });
    expect(report.sources.find((source) => source.id === '2')?.related).toEqual(
      ['1'],
    );
  });
  it('loads unchanged official Playwright v6/v7 fixtures with real actions and network records', async () => {
    const v6 = await parsePlaywrightTrace(
      new Uint8Array(
        readFileSync(
          new URL(
            './__fixtures__/performance/playwright-v6.zip',
            import.meta.url,
          ),
        ),
      ),
    );
    expect(v6.contexts[0].version).toBe(6);
    expect(v6.actions).toHaveLength(14);
    expect(v6.network).toHaveLength(18);
    expect(v6.frames).toHaveLength(4);
    expect(v6.frames.every((frame) => frame.data === null)).toBe(true);
    const v7 = await parsePlaywrightTrace(
      new Uint8Array(
        readFileSync(
          new URL(
            './__fixtures__/performance/playwright-v7.zip',
            import.meta.url,
          ),
        ),
      ),
    );
    expect(v7.contexts[0].version).toBe(7);
    expect(
      v7.actions.some(
        (action) => action.title === 'page.setContent' && action.end !== null,
      ),
    ).toBe(true);
  });
  it('reads archived raster bytes, errors and v9 file references without rendering HTML or fetching a URI', async () => {
    const png = Uint8Array.from(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/nS8AAAAASUVORK5CYII=',
        'base64',
      ),
    );
    const records = [
      { type: 'context-options', version: 9 },
      {
        type: 'before',
        callId: '1',
        startTime: 1,
        class: 'Page',
        method: 'click',
        params: { html: '<script>evil()</script>' },
      },
      { type: 'after', callId: '1', endTime: 2, error: { message: 'Timeout' } },
      {
        type: 'screenshot',
        timestamp: 2,
        pageId: 'page',
        file: 'resources/frame.png',
      },
    ];
    const result = await parsePlaywrightTrace(
      zipSync({
        '0.trace': strToU8(
          records.map((record) => JSON.stringify(record)).join('\n'),
        ),
        'resources/frame.png': png,
        'resources/unused.html': strToU8('<script>evil()</script>'),
      }),
    );
    expect(result.actions[0]).toMatchObject({
      end: 2,
      error: '{\n  "message": "Timeout"\n}',
    });
    expect(result.frames[0].mime).toBe('image/png');
    expect(result.frames[0].data).toEqual(png);
    expect(result.actions[0].params).toContain('<script>');
    await expect(
      parsePlaywrightTrace(
        zipSync({
          'trace.trace': strToU8('{"type":"context-options","version":100}'),
        }),
      ),
    ).rejects.toThrow('traceVersion');
  });
  it('rejects unsafe ZIP paths and oversized declared entries', async () => {
    await expect(
      unzipTraceEntries(
        zipSync({ '../trace.trace': strToU8('{}') }),
        () => true,
      ),
    ).rejects.toThrow('invalidZip');
    const zip = zipSync({ 'trace.trace': new Uint8Array(1) });
    await expect(
      unzipTraceEntries(zip.subarray(0, zip.length - 5), () => true),
    ).rejects.toThrow('invalidZip');
    await expect(
      unzipTraceEntries(new Uint8Array(5), () => true),
    ).rejects.toThrow('invalidZip');
    new DataView(zip.buffer).setUint32(22, 40 * 1024 * 1024, true);
    await expect(unzipTraceEntries(zip, () => true)).rejects.toThrow(
      'zipLimit',
    );
  });
});
