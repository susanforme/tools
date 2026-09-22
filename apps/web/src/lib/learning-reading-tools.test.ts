// @vitest-environment jsdom
import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { readBook, resolveBookPath } from './ebook-reader';
import { typingStats } from './typing-practice';
function epub(body: string, extras: Record<string, Uint8Array> = {}): File {
  const bytes = zipSync({
    'META-INF/container.xml': strToU8(
      '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
    ),
    'OPS/book.opf': strToU8(
      '<package><metadata><title>Test</title></metadata><manifest><item id="c" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/></spine></package>',
    ),
    'OPS/chapter.xhtml': strToU8(body),
    ...extras,
  });
  return {
    name: 'test.epub',
    size: bytes.length,
    arrayBuffer: async () => bytes.buffer,
  } as File;
}
describe('learning and reading tools', () => {
  it('counts Unicode characters and mistakes and excludes wrong characters from speed', () => {
    expect(typingStats('你😀好', '你😀错', 60000)).toMatchObject({
      correct: 2,
      entered: 3,
      cpm: 2,
      mistakes: '好',
      complete: true,
    });
    expect(typingStats('é', 'e\u0301', 60000)).toMatchObject({
      correct: 1,
      accuracy: 100,
    });
    expect(typingStats('abc', '', 0).complete).toBe(false);
  });
  it('resolves book-relative paths and rejects traversal and remote resources', () => {
    expect(resolveBookPath('OPS/Text/a.xhtml', '../Images/a.png#x')).toBe(
      'OPS/Images/a.png',
    );
    for (const value of [
      '../../secret',
      'https://evil/a',
      '//evil/a',
      '%2fetc/passwd',
      '..\\secret',
      '%2e%2e/%2e%2e/secret',
    ])
      expect(() => resolveBookPath('OPS/a.xhtml', value)).toThrow();
  });
  it('extracts inert text and local raster images, never scripts or remote assets', async () => {
    const create = vi.fn(() => 'blob:test');
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = create;
        static revokeObjectURL = vi.fn();
      },
    );
    const book = await readBook(
      epub(
        '<html><head><script>bad()</script></head><body><h1>Chapter one</h1><p>Hello <b>world</b></p><img src="local.png" onerror="bad()"/><img src="https://evil/a.png"/><svg><script>bad()</script></svg><iframe src="https://evil"></iframe></body></html>',
        { 'OPS/local.png': new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) },
      ),
    );
    expect(book.chapters[0]?.blocks).toEqual([
      { text: 'Chapter one', image: null },
      { text: 'Hello world', image: null },
      { text: '', image: 'blob:test' },
    ]);
    expect(create).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
  it('rejects DRM, archive path traversal, and oversized declared input', async () => {
    await expect(
      readBook(
        epub('<p>Hello</p>', {
          'META-INF/encryption.xml': strToU8(
            '<encryption><EncryptionMethod Algorithm="urn:drm"/></encryption>',
          ),
        }),
      ),
    ).rejects.toThrow('drm');
    await expect(
      readBook(epub('<p>Hello</p>', { '../escape': strToU8('bad') })),
    ).rejects.toThrow('invalidZip');
    await expect(
      readBook({ name: 'huge.txt', size: 25 * 1024 * 1024 } as File),
    ).rejects.toThrow('bookLimit');
  });
});
