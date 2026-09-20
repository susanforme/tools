// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { analyzeRedaction, redactText } from './data-redactor';
import {
  MAX_LOG_LINE_LENGTH,
  matchesLog,
  parseLogEntry,
  scanLogFile,
  type LogFilters,
} from './log-explorer';
const filters: LogFilters = { keyword: '', level: 'all', from: null, to: null };

describe('browser inspection tools', () => {
  it('reuses placeholders, resolves overlapping headers, preserves URLs and allows manual edits', () => {
    const source =
      'Authorization: Bearer abc123\njane@example.com jane@example.com\nhttps://example.com/?token=xyz&safe=1\npassword=hide';
    const result = analyzeRedaction(source);
    expect(result.output).toContain('Authorization: [SECRET_1]');
    expect(result.output).toContain('[EMAIL_1] [EMAIL_1]');
    expect(result.output).toContain('?token=[TOKEN_1]&safe=1');
    expect(result.output).not.toContain('hide');
    expect(
      result.matches.find((match) => match.kind === 'EMAIL')?.occurrences,
    ).toBe(2);
    const changed = result.matches.map((match) => ({
      ...match,
      enabled: match.kind !== 'EMAIL',
      replacement: '"manual"',
    }));
    expect(analyzeRedaction(source, {}, changed).output).toContain(
      'jane@example.com jane@example.com',
    );
    expect(redactText('[EMAIL_1] jane@example.com')).toBe(
      '[EMAIL_1] [EMAIL_2]',
    );
    expect(
      redactText('999.1.1.1 192.168.0.1 +1 (415) 555-0132 13800138000'),
    ).toBe('999.1.1.1 [IP_1] [PHONE_1] [PHONE_2]');
  });

  it('preserves JSON validity, array pointers and object types when deselected', () => {
    const source = JSON.stringify({
      authorization: 'Bearer abcd',
      users: [{ name: 'Alice' }],
      'a/b': { secret: 42 },
      __proto__: null,
      public: 'jane@example.com',
    });
    const options = {
      format: 'json' as const,
      paths: ['/users/*/name', '/a~1b'],
    };
    const result = analyzeRedaction(source, options);
    const output = JSON.parse(result.output) as Record<string, unknown>;
    expect(output.authorization).toBe('[SECRET_1]');
    expect(output.users).toEqual([{ name: '[FIELD_1]' }]);
    expect(output['a/b']).toBe('[FIELD_2]');
    const changed = result.matches.map((match) => ({
      ...match,
      enabled: match.value !== '{"secret":42}',
      replacement: 'a"b\nc',
    }));
    const edited = JSON.parse(
      analyzeRedaction(source, options, changed).output,
    ) as Record<string, unknown>;
    expect(edited.authorization).toBe('a"b\nc');
    expect(edited['a/b']).toEqual({ secret: 42 });
    expect(() =>
      analyzeRedaction('{}', { format: 'json', paths: ['$.foo'] }),
    ).toThrow('INVALID_POINTER');
  });

  it('redacts embedded MCP JSON text and header arrays while retaining string types', () => {
    const source = JSON.stringify({
      content: [{ type: 'text', text: '{"password":"top-secret","ok":true}' }],
      headers: [{ name: 'Cookie', value: 'session=hidden' }],
      plain: '{not JSON}',
    });
    const output = JSON.parse(
      analyzeRedaction(source, { format: 'json' }).output,
    ) as {
      content: Array<{ text: string }>;
      headers: Array<{ value: string }>;
      plain: string;
    };
    expect(typeof output.content[0].text).toBe('string');
    expect(JSON.parse(output.content[0].text)).toEqual({
      password: '[SECRET_1]',
      ok: true,
    });
    expect(output.headers[0].value).toBe('[SECRET_2]');
    expect(output.plain).toBe('{not JSON}');
  });

  it('streams split UTF-8 lines, skips overlong lines and scans past the retained row limit', async () => {
    const content =
      'x'.repeat(MAX_LOG_LINE_LENGTH * 5) +
      '\n' +
      Array.from({ length: 10_005 }, (_, i) =>
        JSON.stringify({
          level: 50,
          time: 1_700_000_000_000,
          msg: `中文 failure ${i}`,
        }),
      ).join('\r\n');
    const result = await scanLogFile(new Blob([content]), filters);
    expect(result.scannedLines).toBe(10_006);
    expect(result.scannedBytes).toBe(new Blob([content]).size);
    expect(result.skippedLongLines).toBe(1);
    expect(result.matches).toBe(10_005);
    expect(result.rows).toHaveLength(10_000);
    expect(result.rows[0]).toMatchObject({
      line: 2,
      level: 'error',
      message: '中文 failure 0',
    });
    expect(result.rows[9999].message).toBe('中文 failure 9999');
    expect(result.limited).toBe(true);
    expect(result.errorGroups).toEqual([
      { message: '中文 failure <n>', count: 10_005 },
    ]);
  });

  it('applies combined filters and excludes missing timestamps from a time range', () => {
    const entry = parseLogEntry('2026-09-17T00:00:00Z WARN Request timeout', 1);
    expect(
      matchesLog(entry, {
        ...filters,
        level: 'warn',
        keyword: 'TIMEOUT',
        from: Date.parse('2026-09-16'),
      }),
    ).toBe(true);
    expect(matchesLog(entry, { ...filters, level: 'error' })).toBe(false);
    expect(
      matchesLog(parseLogEntry('ERROR no timestamp', 2), {
        ...filters,
        from: 0,
      }),
    ).toBe(false);
  });
});
