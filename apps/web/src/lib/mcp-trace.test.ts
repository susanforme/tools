import { describe, expect, it } from 'vitest';
import { analyzeMcpTraces } from './mcp-trace';

const line = (dir: string, raw: Record<string, unknown>, ms = 0): string =>
  JSON.stringify({
    t: new Date(ms).toISOString(),
    dir,
    raw: { jsonrpc: '2.0', ...raw },
  });
const analyze = (...lines: string[]) =>
  analyzeMcpTraces([{ name: 'trace', text: lines.join('\n') }]);

describe('MCP trace correlation', () => {
  it('separates typed and bidirectional IDs, notifications and tool failures', () => {
    const result = analyze(
      line('in', { id: 1, method: 'tools/call' }),
      line('out', { id: 1, method: 'sampling/createMessage' }),
      line('in', { id: '1', method: 'tools/list' }),
      line('out', { method: 'notifications/progress' }),
      line('out', { id: '1', result: {} }, 10),
      line('in', { id: 1, result: {} }, 20),
      line('out', { id: 1, result: { isError: true } }, 30),
    );
    expect(
      result.calls.map(({ status, duration }) => [status, duration]),
    ).toEqual([
      ['error', 30],
      ['success', 20],
      ['success', 10],
      ['notification', null],
    ]);
  });
  it('does not correlate across files and retains missing messages', () => {
    const result = analyzeMcpTraces([
      { name: 'a', text: line('in', { id: 1, method: 'tools/call' }) },
      { name: 'b', text: line('out', { id: 1, result: {} }) },
    ]);
    expect(result.calls.map((call) => call.status)).toEqual([
      'pending',
      'unmatched',
    ]);
    expect(() =>
      analyze(
        line('in', { id: 1, method: 'a' }),
        line('in', { id: 1, method: 'b' }),
      ),
    ).toThrow('duplicateId');
    expect(() => analyze('{')).toThrow('invalidJson');
    expect(analyze(JSON.stringify({ type: 'turn', blocks: [] })).skipped).toBe(
      1,
    );
  });
});

it('resets pairing and labels between sessions, including unlabeled metadata', () => {
  const result = analyze(
    JSON.stringify({ type: 'meta', v: 1, label: 'first' }),
    line('in', { id: 1, method: 'tools/list' }),
    JSON.stringify({ type: 'end' }),
    JSON.stringify({ type: 'meta', v: 1 }),
    line('out', { id: 1, result: {} }),
    line('in', { id: 1, method: 'tools/call' }),
    line('out', { id: 1, result: {} }),
  );
  expect(result.calls.map(({ session, status }) => [session, status])).toEqual([
    ['trace / first', 'pending'],
    ['trace', 'unmatched'],
    ['trace', 'success'],
  ]);
});
