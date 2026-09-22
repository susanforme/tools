import { describe, expect, it } from 'vitest';
import { inspectArrow } from './arrow-viewer';
import { convertBinaryData } from './binary-data';
import { inspectMetrics, inspectPromql } from './metrics-inspector';

describe('data protocol tools', () => {
  it('parses metrics with escaped labels, infinity and histograms', () => {
    const result = inspectMetrics(
      '# TYPE latency histogram\nlatency_bucket{path="a,b}\\n\\\"",le="+Inf"} 12\nlatency_sum 3.5e2\nlatency_count 12\n# EOF',
      true,
    );
    expect(result.families[0]?.type).toBe('histogram');
    expect(result.samples[0]?.labels).toEqual({ path: 'a,b}\n"', le: '+Inf' });
    expect(result.sampleCount).toBe(3);
  });
  it('rejects malformed metrics, labels, and OpenMetrics boundaries', () => {
    expect(() => inspectMetrics('x 1', true)).toThrow('EOF');
    expect(() => inspectMetrics('x{a="1",a="2"} 1', false)).toThrow('标签');
    expect(() => inspectMetrics('x{a="1" b="2"} 1', false)).toThrow('标签');
    expect(() => inspectMetrics('x text', false)).toThrow('数值');
    expect(() => inspectMetrics('# EOF\nx 1', true)).toThrow('EOF');
  });
  it('finds actual PromQL grammar errors and emits a syntax tree', async () => {
    const result = await inspectPromql(
      'sum by (job) (rate(http_requests_total[5m]))',
    );
    expect(result.valid).toBe(true);
    expect(result.tree).toContain('AggregateExpr');
    expect((await inspectPromql('sum(rate(x[5m])')).valid).toBe(false);
  });
  it('round trips BSON using canonical EJSON without losing int64', async () => {
    const source =
      '{"id":{"$oid":"507f1f77bcf86cd799439011"},"count":{"$numberLong":"9007199254740993"}}';
    const encoded = await convertBinaryData('bson', 'encode', source);
    const decoded = await convertBinaryData('bson', 'decode', encoded.text);
    expect(JSON.parse(decoded.text)).toEqual(JSON.parse(source));
    await expect(convertBinaryData('bson', 'encode', '[]')).rejects.toThrow(
      '对象',
    );
    await expect(convertBinaryData('bson', 'decode', 'AQ==')).rejects.toThrow();
  });
  it('preserves Ion annotations and decimal precision through binary', async () => {
    const encoded = await convertBinaryData(
      'ion',
      'encode',
      'order::{amount:12345678901234567890.120d0,ok:true}',
    );
    expect(encoded.bytes?.slice(0, 4)).toEqual(
      new Uint8Array([224, 1, 0, 234]),
    );
    const decoded = await convertBinaryData('ion', 'decode', encoded.text);
    expect(decoded.text).toContain('order::');
    expect(decoded.text).toContain('12345678901234567890.120');
    await expect(
      convertBinaryData('ion', 'encode', '{broken:'),
    ).rejects.toThrow();
  });
  it('reads Arrow file and stream, preserves nulls and exports CSV safely', async () => {
    const { tableFromArrays, tableToIPC } = await import('apache-arrow');
    const table = tableFromArrays({
      name: ['=cmd', 'Alice'],
      score: [null, 2],
    });
    for (const format of ['file', 'stream'] as const) {
      const result = await inspectArrow(tableToIPC(table, format));
      expect(result.rowCount).toBe(2);
      expect(result.rows[0]?.[1]).toBe('NULL');
      expect(result.csv).toContain("'=cmd");
      expect(JSON.parse(result.json).rows[0][1]).toBe(null);
      expect(result.batches[0]?.rows).toBe(2);
    }
    await expect(inspectArrow(new Uint8Array([1, 2, 3]))).rejects.toThrow();
  });
});
