// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { createEpub, type BookDraft } from './epub-authoring';
it('creates an EPUB with uncompressed first mimetype, ordered navigation and safe XHTML', async () => {
  const draft: BookDraft = {
    title: 'A & B',
    author: 'Author',
    language: 'zh-CN',
    description: 'Book',
    chapters: [
      {
        title: 'Second',
        text: '**bold**\n\n<script>alert(1)</script>\n\n![remote](https://example.com/a.png)',
      },
      { title: 'First', text: 'Content' },
    ],
    assets: {},
    cover: null,
    coverType: 'image/png',
  };
  const data = await createEpub(draft);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  expect(view.getUint16(8, true)).toBe(0);
  expect(new TextDecoder().decode(data.subarray(30, 38))).toBe('mimetype');
  const files = unzipSync(data);
  expect(strFromU8(files.mimetype)).toBe('application/epub+zip');
  expect(strFromU8(files['OEBPS/package.opf'])).toContain('A &amp; B');
  const html = strFromU8(files['OEBPS/chapter-0.xhtml']);
  expect(html).toContain('<strong');
  expect(html).not.toContain('<script');
  expect(html).not.toContain('<img');
  expect(
    new DOMParser()
      .parseFromString(html, 'application/xml')
      .querySelector('parsererror'),
  ).toBeNull();
  const nav = strFromU8(files['OEBPS/nav.xhtml']);
  expect(nav.indexOf('Second')).toBeLessThan(nav.indexOf('First'));
});
