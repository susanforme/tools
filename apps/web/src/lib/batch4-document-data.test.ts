import { describe, it, expect } from 'vitest';
import {
  bindTemplate,
  cleanTable,
  parseCleanupCsv,
  contentBounds,
  searchDocuments,
  textChapters,
  validateRect,
} from './batch4-document-data';
describe('document data workbench', () => {
  it('preserves quoted CSV whitespace and multiline fields until a cleanup is chosen', async () => {
    expect(
      await parseCleanupCsv('name,note\n" Alice ","first\nsecond"'),
    ).toEqual([
      ['name', 'note'],
      [' Alice ', 'first\nsecond'],
    ]);
  });
  it('cleans atomically, merges normalized text and keeps first deduplicated row', () => {
    const input = [
      ['name', 'date', 'empty'],
      ['A B', '2024/2/29', ' '],
      ['ａ-b', '2024.02.29', ''],
      ['Other', '2026-09-23', 'x'],
    ];
    const clustered = cleanTable(input, {
      operation: 'cluster',
      column: 0,
      other: 1,
      value: '',
    });
    expect(clustered[2][0]).toBe('A B');
    expect(input[2][0]).toBe('ａ-b');
    const dedup = cleanTable(clustered, {
      operation: 'dedup',
      column: 0,
      other: 1,
      value: '',
    });
    expect(dedup).toHaveLength(3);
    expect(
      cleanTable(input, {
        operation: 'date',
        column: 1,
        other: 0,
        value: '',
      })[1][1],
    ).toBe('2024-02-29');
    expect(() =>
      cleanTable([['date'], ['2023/2/29']], {
        operation: 'date',
        column: 0,
        other: 1,
        value: '',
      }),
    ).toThrow('date');
    expect(
      cleanTable(input, {
        operation: 'fill',
        column: 2,
        other: 0,
        value: 'unknown',
      })[1][2],
    ).toBe('unknown');
    const split = cleanTable([['name'], ['Alice Doe'], ['Bob']], {
      operation: 'split',
      column: 0,
      other: 0,
      value: ' ',
    });
    expect(split).toEqual([
      ['name_1', 'name_2'],
      ['Alice', 'Doe'],
      ['Bob', ''],
    ]);
    expect(
      cleanTable(split, {
        operation: 'merge',
        column: 0,
        other: 1,
        value: ' ',
      })[1],
    ).toEqual(['Alice Doe']);
  });
  it('binds exact CSV variables and serials without code execution', () => {
    expect(
      bindTemplate(
        '{{name}} / {{#}}',
        ['name'],
        ['<script>x</script>'],
        'A-001',
      ),
    ).toBe('<script>x</script> / A-001');
    expect(() => bindTemplate('{{missing}}', ['name'], ['A'], '1')).toThrow(
      'variable',
    );
    expect(() => bindTemplate('{{x}}', ['x', 'x'], ['a', 'b'], '1')).toThrow(
      'template',
    );
  });
  it('finds repeated text and filters document type', () => {
    const docs = [
      {
        name: 'a.txt',
        type: 'txt',
        sections: [{ label: '', text: 'Alpha alpha beta' }],
      },
      { name: 'b.pdf', type: 'pdf', sections: [{ label: '2', text: 'alpha' }] },
    ];
    expect(searchDocuments(docs, 'alpha', 'all')).toHaveLength(3);
    expect(searchDocuments(docs, 'alpha', 'pdf')[0]).toMatchObject({
      name: 'b.pdf',
      label: '2',
      hit: 'alpha',
    });
    expect(searchDocuments(docs, '', 'all')).toEqual([]);
  });
  it('bounds irreversible redaction and crops only white margins', () => {
    expect(() =>
      validateRect({ page: 1, x: 90, y: 0, width: 11, height: 10 }),
    ).toThrow('rectangle');
    expect(() =>
      validateRect({ page: 0, x: 0, y: 0, width: 10, height: 10 }),
    ).toThrow();
    const pixels = new Uint8ClampedArray(40 * 40 * 4).fill(255);
    pixels[(20 * 40 + 20) * 4] = 0;
    expect(contentBounds(pixels, 40, 40)).toEqual({
      x: 12,
      y: 12,
      width: 17,
      height: 17,
    });
    expect(contentBounds(new Uint8ClampedArray(16).fill(255), 2, 2)).toEqual({
      x: 0,
      y: 0,
      width: 2,
      height: 2,
    });
  });
  it('splits markdown chapters without losing body or empty leading title', () => {
    expect(textChapters('# One\nhello\n# Two\nworld', 'Book')).toEqual([
      { title: 'One', text: 'hello' },
      { title: 'Two', text: 'world' },
    ]);
    expect(() => textChapters('', 'Book')).toThrow('book');
  });
});
