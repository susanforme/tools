import { describe, expect, test } from 'vitest';
import { formatJson, summarizeDiff } from './diff';

describe('diff helpers', () => {
  test('counts inserted and removed lines from Monaco changes', () => {
    expect(
      summarizeDiff([
        {
          originalStartLineNumber: 3,
          originalEndLineNumber: 0,
          modifiedStartLineNumber: 3,
          modifiedEndLineNumber: 4,
        },
        {
          originalStartLineNumber: 8,
          originalEndLineNumber: 10,
          modifiedStartLineNumber: 9,
          modifiedEndLineNumber: 0,
        },
      ]),
    ).toEqual({ added: 2, removed: 3 });
  });

  test('formats JSON while preserving blank input', () => {
    expect(formatJson('{"ok":true}')).toBe('{\n  "ok": true\n}');
    expect(formatJson('  ')).toBe('');
  });
});
