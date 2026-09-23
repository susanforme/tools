// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  bookmarkKey,
  documentTotals,
  exportBookmarks,
  exportContactsCsv,
  exportFormHtml,
  exportVcard,
  formAnswers,
  mergeBookmarks,
  mergeContacts,
  parseBookmarks,
  parseContactsCsv,
  parseVcard,
  validDay,
  validateBookmarks,
  validateForm,
  validateProject,
  visibleFields,
  type BookmarkData,
  type Contact,
  type FormDesign,
  type ProjectTask,
} from './productivity-data';
const task = (id: string, deps: string[] = []): ProjectTask => ({
  id,
  name: id,
  start: '2026-09-23',
  end: '2026-09-24',
  status: 'todo',
  milestone: false,
  dependencies: deps,
});
const contact = (id: string, email = '', phone = ''): Contact => ({
  id,
  name: id,
  email,
  phone,
  company: '',
  notes: '',
});
const form: FormDesign = {
  title: 'Example',
  fields: [
    {
      id: 'choice',
      label: 'Agree',
      type: 'checkbox',
      required: false,
      options: [],
      condition: '',
      equals: '',
    },
    {
      id: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      options: [],
      condition: 'choice',
      equals: 'true',
    },
  ],
};
describe('productivity workflows', () => {
  it('rejects cyclic or missing dependencies and invalid calendar dates', () => {
    expect(validateProject([task('a'), task('b', ['a'])])).toBe(true);
    expect(validateProject([task('a', ['b']), task('b', ['a'])])).toBe(false);
    expect(validateProject([task('a', ['missing'])])).toBe(false);
    expect(validDay('2026-99-99')).toBe(false);
    expect(validDay('2026-02-29')).toBe(false);
    expect(validDay('2028-02-29')).toBe(true);
  });
  it('validates only visible answers and rejects invalid reordered conditions', () => {
    expect(formAnswers(form, {})).toEqual([
      { id: 'choice', label: 'Agree', value: 'false' },
    ]);
    expect(() => formAnswers(form, { choice: 'true' })).toThrow(
      'requiredError',
    );
    expect(() => formAnswers(form, { choice: 'true', email: 'x@y' })).toThrow(
      'requiredError',
    );
    expect(
      formAnswers(form, { choice: 'true', email: 'x@y.com' }),
    ).toHaveLength(2);
    expect(validateForm({ ...form, fields: [...form.fields].reverse() })).toBe(
      false,
    );
    expect(visibleFields({ ...form, fields: [] }.fields, {})).toEqual([]);
  });
  it('exports a working standalone form and neutralizes script markup', () => {
    const hostile = {
      ...form,
      title: '</title><img src=x onerror=alert(1)>',
      fields: form.fields.map((f) => ({
        ...f,
        label: f.label + '</script><script>globalThis.pwned=true</script>',
      })),
    };
    const html = exportFormHtml(hostile, 'Save', 'Invalid', 'en');
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    expect(dom.window.document.querySelectorAll('script')).toHaveLength(1);
    expect(dom.window.document.querySelectorAll('input')).toHaveLength(2);
    expect(dom.window.document.querySelectorAll('img')).toHaveLength(0);
    const email =
      dom.window.document.querySelector<HTMLInputElement>('input[type=email]')!;
    expect(email.disabled).toBe(true);
    const checkbox = dom.window.document.querySelector<HTMLInputElement>(
      'input[type=checkbox]',
    )!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(email.disabled).toBe(false);
    expect(email.required).toBe(true);
    dom.window.close();
  });
  it('calculates decimal amounts without binary rounding and rejects overflow', () => {
    expect(
      documentTotals(
        [{ id: 'a', name: 'A', quantity: '1.50', price: '0.33', unit: '' }],
        '10',
      ),
    ).toEqual({ lines: [50], subtotal: 50, tax: 5, total: 55 });
    expect(() =>
      documentTotals(
        [{ id: 'a', name: 'A', quantity: '-1', price: '1', unit: '' }],
        '0',
      ),
    ).toThrow();
    expect(() =>
      documentTotals(
        Array.from({ length: 100 }, (_, i) => ({
          id: String(i),
          name: 'A',
          quantity: '9999999.99',
          price: '9999999.99',
          unit: '',
        })),
        '100',
      ),
    ).toThrow();
  });
  it('round-trips escaped, folded UTF-8 vCards and repeated addresses', () => {
    const original = {
      ...contact('a', 'a@example.com\nb@example.com', '+86 123456789'),
      name: '张三'.repeat(40),
      company: 'A;B,C',
      notes: 'first\nsecond\\third',
    };
    const encoded = exportVcard([original]);
    expect(
      encoded
        .split('\r\n')
        .every((line) => new TextEncoder().encode(line).length <= 75),
    ).toBe(true);
    const [parsed] = parseVcard(encoded);
    expect({ ...parsed, id: original.id }).toEqual(original);
    expect(() =>
      parseVcard('BEGIN:VCARD\nVERSION:2.1\nFN:Test\nEND:VCARD'),
    ).toThrow('unsupportedVcard');
    expect(
      parseVcard(
        'BEGIN:VCARD\nVERSION:4.0\nFN:Test\nTEL;VALUE=uri:tel:+123456789\nEND:VCARD',
      )[0].phone,
    ).toBe('+123456789');
  });
  it('merges transitive contact matches while preserving conflict values', () => {
    const result = mergeContacts([
      contact('a', 'x@ex.com'),
      contact('b', 'X@ex.com', '+1 234567'),
      contact('c', '', '001234567'),
      contact('d'),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('a\nb\nc');
    expect(result[1].name).toBe('d');
  });
  it('parses quoted CSV and escapes spreadsheet formula cells', async () => {
    const records = await parseContactsCsv(
      'name,email,company\n"Last, First",a@example.com,"=SUM(1,2)"',
    );
    expect(records[0].name).toBe('Last, First');
    const csv = await exportContactsCsv(records);
    expect(csv).toContain("'=SUM(1,2)");
    expect(await parseContactsCsv(csv)).toHaveLength(1);
  });
  it('preserves nested browser folders in import/export and merges matching paths', () => {
    const data = parseBookmarks(
      '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><H3>Work</H3><DL><p><DT><A HREF="https://example.com/">One</A><DT><H3>Nested</H3><DL><p><DT><A HREF="https://example.org/">Two</A></DL><p></DL><p><DT><A HREF="https://example.net/">Root</A></DL><p>',
    );
    expect(data.folders).toHaveLength(2);
    expect(data.bookmarks).toHaveLength(3);
    expect(data.bookmarks.find((b) => b.title === 'Root')?.folder).toBe('');
    const roundTrip = parseBookmarks(exportBookmarks(data));
    expect(roundTrip.folders.map((f) => f.name)).toEqual(['Work', 'Nested']);
    expect(roundTrip.bookmarks.map((b) => b.url).sort()).toEqual(
      data.bookmarks.map((b) => b.url).sort(),
    );
    const merged = mergeBookmarks(data, roundTrip);
    expect(merged.folders).toHaveLength(2);
    expect(merged.bookmarks).toHaveLength(6);
    expect(bookmarkKey('HTTPS://EXAMPLE.COM:443')).toBe('https://example.com/');
  });
  it('rejects dangerous bookmarks and cyclic folders', () => {
    expect(() =>
      parseBookmarks('<DL><DT><A HREF="javascript:alert(1)">bad</A></DL>'),
    ).toThrow();
    const cyclic: BookmarkData = {
      folders: [
        { id: 'a', name: 'A', parent: 'b' },
        { id: 'b', name: 'B', parent: 'a' },
      ],
      bookmarks: [],
    };
    expect(validateBookmarks(cyclic)).toBe(false);
    const safe: BookmarkData = {
      folders: [],
      bookmarks: [
        {
          id: 'x',
          title: '<img onerror=alert(1)>',
          url: 'https://example.com/?x="test"',
          folder: '',
        },
      ],
    };
    const html = exportBookmarks(safe);
    expect(html).toContain('&lt;img');
    expect(
      new DOMParser().parseFromString(html, 'text/html').querySelector('img'),
    ).toBeNull();
  });
});
