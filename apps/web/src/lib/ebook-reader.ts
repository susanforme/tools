export type BookBlock = { text: string; image: string | null };
export type BookChapter = { title: string; blocks: BookBlock[] };
export type ReaderBook = {
  id: string;
  title: string;
  chapters: BookChapter[];
  urls: string[];
};
export const BOOK_MAX_BYTES = 24 * 1024 * 1024;
export function resolveBookPath(base: string, href: string): string {
  if (
    /^[a-z][a-z\d+.-]*:/i.test(href) ||
    href.startsWith('/') ||
    href.includes('\\')
  )
    throw new Error('invalidBook');
  const path = decodeURIComponent(href.split('#')[0]!.split('?')[0]!);
  if (path.includes('\0') || path.includes('\\') || path.startsWith('/'))
    throw new Error('invalidBook');
  const parts = base.split('/').slice(0, -1);
  for (const part of path.split('/')) {
    if (part === '..') {
      if (!parts.length) throw new Error('invalidBook');
      parts.pop();
    } else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}
function paragraphs(text: string): BookBlock[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .flatMap((line) => {
      const value = line.trim();
      return value
        ? (value.match(/[\s\S]{1,2000}/gu) ?? []).map((text) => ({
            text,
            image: null,
          }))
        : [];
    });
}
function xml(source: string): Document {
  source = source.replace(/<!DOCTYPE[^>\[]*>/gi, '');
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('invalidBook');
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('invalidBook');
  return doc;
}
export async function readBook(file: File): Promise<ReaderBook> {
  if (!/\.(txt|epub)$/i.test(file.name)) throw new Error('fileType');
  if (file.size > BOOK_MAX_BYTES) throw new Error('bookLimit');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const id = Array.from(hash, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const book: ReaderBook = { id, title: file.name, chapters: [], urls: [] };
  if (/\.txt$/i.test(file.name)) {
    const text = new TextDecoder().decode(bytes);
    const blocks = paragraphs(text);
    if (!blocks.length) throw new Error('emptyBook');
    for (let i = 0; i < blocks.length; i += 100)
      book.chapters.push({
        title: `${Math.floor(i / 100) + 1}`,
        blocks: blocks.slice(i, i + 100),
      });
    return book;
  }
  if (bytes.length < 22) throw new Error('invalidBook');
  const { unzipTraceEntries } = await import('./playwright-trace');
  const entries = await unzipTraceEntries(bytes, () => true);
  const getText = (path: string) => {
    const data = entries.get(path);
    if (!data || data.length > 4 * 1024 * 1024) throw new Error('invalidBook');
    return new TextDecoder().decode(data);
  };
  // 字体混淆不影响本文本阅读器；加密正文（DRM）拒绝打开。
  if (entries.has('META-INF/encryption.xml')) {
    const encrypted = xml(getText('META-INF/encryption.xml'));
    for (const method of encrypted.getElementsByTagNameNS(
      '*',
      'EncryptionMethod',
    )) {
      if (
        ![
          'http://www.idpf.org/2008/embedding',
          'http://ns.adobe.com/pdf/enc#RC',
        ].includes(method.getAttribute('Algorithm') ?? '')
      )
        throw new Error('drm');
    }
  }
  const container = xml(getText('META-INF/container.xml'));
  const opfPath = resolveBookPath(
    '',
    container
      .getElementsByTagNameNS('*', 'rootfile')[0]
      ?.getAttribute('full-path') ?? '',
  );
  const opf = xml(getText(opfPath));
  book.title =
    opf.getElementsByTagNameNS('*', 'title')[0]?.textContent?.trim() ||
    file.name;
  const manifest = new Map(
    Array.from(opf.getElementsByTagNameNS('*', 'item'), (item) => [
      item.getAttribute('id') ?? '',
      {
        path: resolveBookPath(opfPath, item.getAttribute('href') ?? ''),
        type: item.getAttribute('media-type') ?? '',
        properties: item.getAttribute('properties') ?? '',
      },
    ]),
  );
  const titles = new Map<string, string>();
  const nav = [...manifest.values()].find((item) =>
    item.properties.split(/\s+/).includes('nav'),
  );
  if (nav) {
    const template = document.createElement('template');
    template.innerHTML = getText(nav.path);
    for (const link of template.content.querySelectorAll('a[href]')) {
      try {
        const path = resolveBookPath(nav.path, link.getAttribute('href')!);
        if (!titles.has(path)) titles.set(path, link.textContent?.trim() ?? '');
      } catch {
        /* 忽略外部目录链接。 */
      }
    }
  }
  const ncx = [...manifest.values()].find(
    (item) => item.type === 'application/x-dtbncx+xml',
  );
  if (ncx && !nav)
    for (const point of xml(getText(ncx.path)).getElementsByTagNameNS(
      '*',
      'navPoint',
    )) {
      const content = point.getElementsByTagNameNS('*', 'content')[0];
      if (content)
        titles.set(
          resolveBookPath(ncx.path, content.getAttribute('src') ?? ''),
          point.getElementsByTagNameNS('*', 'text')[0]?.textContent ?? '',
        );
    }
  const imageUrls = new Map<string, string>();
  const image = (path: string): string | null => {
    if (imageUrls.has(path)) return imageUrls.get(path)!;
    const data = entries.get(path);
    if (!data || data.length > 8 * 1024 * 1024) return null;
    // 仅允许有正确文件签名的栅格图片；SVG、外链及书中提供的 MIME 不可信。
    const mime =
      data[0] === 0x89 &&
      data[1] === 0x50 &&
      data[2] === 0x4e &&
      data[3] === 0x47
        ? 'image/png'
        : data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
          ? 'image/jpeg'
          : new TextDecoder().decode(data.subarray(0, 4)) === 'RIFF' &&
              new TextDecoder().decode(data.subarray(8, 12)) === 'WEBP'
            ? 'image/webp'
            : null;
    if (!mime) return null;
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(data)], { type: mime }),
    );
    imageUrls.set(path, url);
    book.urls.push(url);
    return url;
  };
  try {
    const spine = Array.from(opf.getElementsByTagNameNS('*', 'itemref'));
    if (spine.length > 1000) throw new Error('bookLimit');
    for (const ref of spine) {
      const item = manifest.get(ref.getAttribute('idref') ?? '');
      if (!item || !['application/xhtml+xml', 'text/html'].includes(item.type))
        continue;
      const template = document.createElement('template');
      template.innerHTML = getText(item.path);
      const blocks: BookBlock[] = [];
      let buffer = '';
      const flush = () => {
        blocks.push(...paragraphs(buffer));
        buffer = '';
      };
      const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          buffer += node.textContent ?? '';
          return;
        }
        if (!(node instanceof Element) && !(node instanceof DocumentFragment))
          return;
        if (node instanceof Element) {
          if (
            [
              'SCRIPT',
              'STYLE',
              'LINK',
              'META',
              'IFRAME',
              'OBJECT',
              'EMBED',
              'FORM',
              'SVG',
              'MATH',
              'HEAD',
              'TITLE',
              'TEMPLATE',
              'AUDIO',
              'VIDEO',
            ].includes(node.tagName.toUpperCase())
          )
            return;
          if (node.tagName.toUpperCase() === 'IMG') {
            flush();
            let url: string | null = null;
            try {
              url = image(
                resolveBookPath(item.path, node.getAttribute('src') ?? ''),
              );
            } catch {
              /* 外链图片不载入。 */
            }
            if (url)
              blocks.push({ text: node.getAttribute('alt') ?? '', image: url });
            return;
          }
          if (
            /^(P|DIV|H[1-6]|BR|LI|BLOCKQUOTE|TR|SECTION)$/.test(
              node.tagName.toUpperCase(),
            )
          )
            flush();
        }
        for (const child of node.childNodes) walk(child);
        if (
          node instanceof Element &&
          /^(P|DIV|H[1-6]|LI|BLOCKQUOTE|TR|SECTION)$/.test(
            node.tagName.toUpperCase(),
          )
        )
          flush();
      };
      walk(template.content);
      flush();
      if (blocks.length)
        book.chapters.push({
          title:
            titles.get(item.path) ||
            template.content.querySelector('h1,h2,h3')?.textContent?.trim() ||
            `${book.chapters.length + 1}`,
          blocks,
        });
    }
    if (!book.chapters.length) throw new Error('emptyBook');
    return book;
  } catch (cause) {
    book.urls.forEach(URL.revokeObjectURL);
    throw cause;
  }
}
