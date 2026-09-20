import { describe, expect, it } from 'vitest';
import { compareLighthouse, parseLighthouse } from './lighthouse-report';
import { parseOtel } from './otel-viewer';
import { parseExplain, rowEstimateRatio } from './postgres-explain';
import {
  createReplayDocument,
  parseRrweb,
  readReplayMessage,
} from './rrweb-player';
import { readReportJson } from './observability-report';

describe('local observability report parsers', () => {
  it('compares matching Lighthouse units without converting missing scores into zero', () => {
    const fixture = {
      lighthouseVersion: '13',
      categories: { performance: { score: null, auditRefs: [] } },
      audits: {
        lcp: { numericValue: 3000, numericUnit: 'millisecond', score: null },
        old: { score: 0 },
      },
    };
    const before = parseLighthouse(JSON.stringify(fixture));
    const after = parseLighthouse(
      JSON.stringify({
        lighthouseResult: {
          ...fixture,
          audits: {
            lcp: { numericValue: 2000, numericUnit: 'millisecond', score: 0.9 },
            new: { score: null },
          },
        },
      }),
    );
    const comparison = compareLighthouse(before, after);
    expect(comparison[0]).toMatchObject({
      numericDelta: -1000,
      scoreDelta: null,
    });
    expect(comparison.find((row) => row.id === 'old')?.right).toBeNull();
    expect(comparison.find((row) => row.id === 'new')?.left).toBeNull();
    after.audits[0].unit = 'unitless';
    expect(compareLighthouse(before, after)[0].numericDelta).toBeNull();
  });
  it('keeps PostgreSQL averages distinct from loop totals and does not invent actual rows', () => {
    const report = parseExplain(
      JSON.stringify([
        {
          Plan: {
            'Node Type': 'Nested Loop',
            'Plan Rows': 10,
            Plans: [
              {
                'Node Type': 'Index Scan',
                'Actual Rows': 10,
                'Plan Rows': 2,
                'Actual Total Time': 0.5,
                'Actual Loops': 20,
              },
            ],
          },
        },
      ]),
    );
    const [root, child] = report.statements[0].nodes;
    expect(root.actualRows).toBeNull();
    expect(rowEstimateRatio(root)).toBe('—');
    expect(child).toMatchObject({
      parent: root.id,
      depth: 1,
      time: 0.5,
      totalTime: 10,
    });
    expect(rowEstimateRatio(child)).toBe('5×');
    expect(rowEstimateRatio({ actualRows: 10, plannedRows: 0, loops: 1 })).toBe(
      '∞',
    );
    expect(rowEstimateRatio({ actualRows: 0, plannedRows: 5, loops: 0 })).toBe(
      '—',
    );
  });
  const traceId = '11111111111111111111111111111111';
  const span = (spanId: string, parentSpanId = '') => ({
    traceId,
    spanId,
    parentSpanId,
    name: 'work',
    startTimeUnixNano: '1750000000000000001',
    endTimeUnixNano: '1750000000000000009',
    status: { code: 2 },
    attributes: [{ key: 'number', value: { intValue: '9007199254740993' } }],
  });
  const otlp = (spans: unknown[]) =>
    JSON.stringify({
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'api' } },
            ],
          },
          scopeSpans: [{ spans }],
        },
      ],
    });
  it('keeps OTLP nanosecond precision and resolves out-of-order parents, orphans, and cycles', () => {
    const report = parseOtel(
      otlp([
        span('0000000000000002', '0000000000000001'),
        span('0000000000000001'),
        span('0000000000000003', '0000000000000004'),
        span('0000000000000005', '0000000000000006'),
        span('0000000000000006', '0000000000000005'),
      ]),
    );
    const trace = report.traces[0];
    expect(trace.durationMs).toBe(0.000008);
    expect(trace.errors).toBe(5);
    expect(trace.spans.find((item) => item.spanId.endsWith('2'))).toMatchObject(
      { depth: 1, service: 'api' },
    );
    expect(trace.spans.find((item) => item.spanId.endsWith('3'))?.issue).toBe(
      'orphan',
    );
    expect(trace.spans.filter((item) => item.issue === 'cycle')).toHaveLength(
      1,
    );
    expect(trace.spans[0].attributes).toContain('9007199254740993');
    expect(() =>
      parseOtel(
        otlp([
          {
            ...span('0000000000000001'),
            startTimeUnixNano: 1750000000000000000,
          },
        ]),
      ),
    ).toThrow('precision');
    expect(() =>
      parseOtel(otlp([span('0000000000000001'), span('0000000000000001')])),
    ).toThrow('duplicateSpan');
  });
  it('sanitizes rrweb snapshots and incremental attributes, drops active replay sources, and requires a snapshot', () => {
    const report = parseRrweb(
      JSON.stringify([
        {
          type: 2,
          timestamp: 1,
          data: {
            node: {
              type: 0,
              id: 1,
              childNodes: [
                {
                  type: 2,
                  id: 2,
                  tagName: 'script',
                  attributes: { nonce: 'x' },
                  childNodes: [{ type: 3, id: 3, textContent: 'alert(1)' }],
                },
                {
                  type: 2,
                  id: 4,
                  tagName: 'img',
                  attributes: {
                    src: 'https://example.invalid',
                    onerror: 'alert(1)',
                  },
                  childNodes: [],
                },
              ],
            },
            initialOffset: { left: 0, top: 0 },
          },
        },
        {
          type: 3,
          timestamp: 2,
          data: {
            source: 0,
            attributes: [
              {
                id: 4,
                attributes: {
                  srcdoc: '<script>evil()</script>',
                  onclick: 'evil()',
                },
              },
            ],
          },
        },
        { type: 3, timestamp: 3, data: { source: 9, commands: [] } },
      ]),
    );
    expect(report.blocked).toBe(2);
    expect(report.duration).toBe(2);
    const serialized = JSON.stringify(report.events);
    expect(serialized).not.toContain('alert(1)');
    expect(serialized).not.toContain('https://example.invalid');
    expect(serialized).not.toContain('evil()');
    expect(report.events[2]).toMatchObject({
      type: 5,
      data: { tag: 'omitted' },
    });
    expect(() =>
      parseRrweb('[{"type":0,"timestamp":0},{"type":1,"timestamp":1}]'),
    ).toThrow('noSnapshot');
  });
  it('builds a restrictive replay harness and validates window and nonce for message delivery', () => {
    const nonce = '12345678-1234-1234-1234-123456789abc';
    const html = createReplayDocument(
      nonce,
      'window.rrweb = {};',
      'body{color:black}',
    );
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("script-src-attr 'none'");
    expect(html).toContain('UNSAFE_replayCanvas: false');
    expect(html).not.toContain("'unsafe-eval'");
    const source = {} as Window;
    expect(
      readReplayMessage(
        { source, data: { type: 'replay-loaded', nonce } },
        source,
        nonce,
      ),
    ).not.toBeNull();
    expect(
      readReplayMessage(
        { source: {} as Window, data: { type: 'replay-loaded', nonce } },
        source,
        nonce,
      ),
    ).toBeNull();
    expect(
      readReplayMessage(
        { source, data: { type: 'replay-loaded', nonce: 'wrong' } },
        source,
        nonce,
      ),
    ).toBeNull();
  });
  it('bounds JSON nesting and rejects malformed data before normalization', () => {
    expect(() => readReportJson('{')).toThrow('invalidJson');
    expect(() => readReportJson('['.repeat(82) + '0' + ']'.repeat(82))).toThrow(
      'limit',
    );
    expect(() => parseLighthouse('{"audits":{}}')).toThrow('invalidFormat');
    expect(() => parseExplain('[{}]')).toThrow('invalidFormat');
    expect(() => parseOtel('{"resourceSpans":{},"spans":[]}')).toThrow(
      'invalidFormat',
    );
  });
});
