import { readBook, resolveBookPath } from './ebook-reader';
import {
  textChapters,
  xmlEscape,
  type EditableChapter,
} from './batch4-document-data';
export type BookDraft = {
  title: string;
  author: string;
  language: string;
  description: string;
  chapters: EditableChapter[];
  assets: Record<string, Uint8Array>;
  cover: Uint8Array | null;
  coverType: string;
};
export async function importBookDraft(file: File): Promise<BookDraft> {
  if (file.size > 20 * 1024 * 1024) throw new Error('size');
  const draft: BookDraft = {
    title: file.name.replace(/\.[^.]+$/, ''),
    author: '',
    language: 'zh',
    description: '',
    chapters: [],
    assets: {},
    cover: null,
    coverType: 'image/png',
  };
  if (/\.(txt|md)$/i.test(file.name)) {
    draft.chapters = textChapters(await file.text(), draft.title);
    return draft;
  }
  if (!/\.epub$/i.test(file.name)) throw new Error('type');
  const book = await readBook(file);
  try {
    draft.title = book.title;
    let n = 0;
    const images = new Map<string, string>();
    for (const chapter of book.chapters) {
      const lines: string[] = [];
      for (const block of chapter.blocks) {
        if (block.image) {
          let name = images.get(block.image);
          if (!name) {
            const response = await fetch(block.image);
            const blob = await response.blob();
            name = `image-${++n}.${blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'}`;
            draft.assets[name] = new Uint8Array(await blob.arrayBuffer());
            images.set(block.image, name);
          }
          lines.push(`![${block.text.replace(/[\[\]\n]/g, ' ')}](${name})`);
        } else
          lines.push(block.text.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
      }
      draft.chapters.push({ title: chapter.title, text: lines.join('\n\n') });
    }
    const { unzipTraceEntries } = await import('./playwright-trace');
    const entries = await unzipTraceEntries(
      new Uint8Array(await file.arrayBuffer()),
      () => true,
    );
    const decode = (name: string) => {
      const bytes = entries.get(name);
      if (!bytes) throw new Error('book');
      const source = new TextDecoder().decode(bytes);
      if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('book');
      return new DOMParser().parseFromString(source, 'application/xml');
    };
    const container = decode('META-INF/container.xml');
    const opfPath = resolveBookPath(
      '',
      container
        .getElementsByTagNameNS('*', 'rootfile')[0]
        ?.getAttribute('full-path') ?? '',
    );
    const opf = decode(opfPath);
    for (const [field, tag] of [
      ['author', 'creator'],
      ['language', 'language'],
      ['description', 'description'],
    ] as const)
      draft[field] =
        opf.getElementsByTagNameNS('*', tag)[0]?.textContent ?? draft[field];
    const coverId = Array.from(opf.getElementsByTagNameNS('*', 'meta'))
      .find((meta) => meta.getAttribute('name') === 'cover')
      ?.getAttribute('content');
    const coverItem = Array.from(opf.getElementsByTagNameNS('*', 'item')).find(
      (item) =>
        item.getAttribute('properties')?.split(/\s+/).includes('cover-image') ||
        (!!coverId && item.getAttribute('id') === coverId),
    );
    if (coverItem) {
      const mime = coverItem.getAttribute('media-type') ?? '';
      const bytes = entries.get(
        resolveBookPath(opfPath, coverItem.getAttribute('href') ?? ''),
      );
      if (bytes && ['image/png', 'image/jpeg'].includes(mime)) {
        draft.cover = bytes;
        draft.coverType = mime;
      }
    }
    if (
      draft.chapters.length > 100 ||
      draft.chapters.reduce((sum, c) => sum + c.text.length, 0) > 1000000
    )
      throw new Error('book');
    return draft;
  } finally {
    book.urls.forEach(URL.revokeObjectURL);
  }
}
export async function createEpub(draft: BookDraft): Promise<Uint8Array> {
  if (
    !draft.title.trim() ||
    !draft.chapters.length ||
    draft.chapters.length > 100 ||
    draft.chapters.some((c) => !c.title.trim() || !c.text.trim()) ||
    draft.chapters.reduce((sum, c) => sum + c.text.length, 0) > 1000000 ||
    draft.title.length > 300 ||
    draft.author.length > 300 ||
    draft.description.length > 3000 ||
    !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(draft.language)
  )
    throw new Error('book');
  const [{ zipSync, strToU8 }, { marked }, { default: DOMPurify }] =
    await Promise.all([
      import('fflate'),
      import('marked'),
      import('dompurify'),
    ]);
  const files: Record<string, Uint8Array> = {};
  const put = (name: string, contents: string) => {
    files[name] = strToU8(contents);
  };
  const xhtml = (title: string, body: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${xmlEscape(draft.language)}"><head><title>${xmlEscape(title)}</title><meta charset="utf-8"/></head><body>${body}</body></html>`;
  put('mimetype', 'application/epub+zip');
  put(
    'META-INF/container.xml',
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  const manifest: string[] = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
  ];
  const spine: string[] = [];
  for (const [name, bytes] of Object.entries(draft.assets)) {
    if (!/^image-\d+\.(png|jpg|webp)$/.test(name)) throw new Error('book');
    files[`OEBPS/${name}`] = bytes;
    manifest.push(
      `<item id="${name.replace('.', '-')}" href="${name}" media-type="image/${name.endsWith('.jpg') ? 'jpeg' : name.split('.').pop()}"/>`,
    );
  }
  if (draft.cover) {
    if (
      draft.cover.length > 5 * 1024 * 1024 ||
      !['image/png', 'image/jpeg'].includes(draft.coverType)
    )
      throw new Error('size');
    files['OEBPS/cover-image'] = draft.cover;
    manifest.push(
      `<item id="cover-image" href="cover-image" media-type="${draft.coverType}" properties="cover-image"/>`,
      '<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>',
    );
    spine.push('<itemref idref="cover"/>');
    put(
      'OEBPS/cover.xhtml',
      xhtml(draft.title, '<img src="cover-image" alt="Cover"/>'),
    );
  }
  for (let i = 0; i < draft.chapters.length; i++) {
    const chapter = draft.chapters[i];
    const html = DOMPurify.sanitize(await marked.parse(chapter.text), {
      ALLOWED_TAGS: [
        'p',
        'br',
        'h1',
        'h2',
        'h3',
        'h4',
        'strong',
        'em',
        'del',
        'ul',
        'ol',
        'li',
        'blockquote',
        'pre',
        'code',
        'hr',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'a',
        'img',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt'],
    });
    const template = document.createElement('template');
    template.innerHTML = html;
    for (const image of template.content.querySelectorAll('img')) {
      if (!Object.hasOwn(draft.assets, image.getAttribute('src') ?? ''))
        image.remove();
    }
    for (const link of template.content.querySelectorAll('a')) {
      if (!link.getAttribute('href')?.startsWith('#'))
        link.removeAttribute('href');
    }
    const body = Array.from(template.content.childNodes, (node) =>
      new XMLSerializer().serializeToString(node),
    ).join('');
    put(
      `OEBPS/chapter-${i}.xhtml`,
      xhtml(chapter.title, `<h1>${xmlEscape(chapter.title)}</h1>${body}`),
    );
    manifest.push(
      `<item id="chapter-${i}" href="chapter-${i}.xhtml" media-type="application/xhtml+xml"/>`,
    );
    spine.push(`<itemref idref="chapter-${i}"/>`);
  }
  put(
    'OEBPS/nav.xhtml',
    xhtml(
      draft.title,
      `<nav epub:type="toc"><h1>${xmlEscape(draft.title)}</h1><ol>${draft.chapters.map((c, i) => `<li><a href="chapter-${i}.xhtml">${xmlEscape(c.title)}</a></li>`).join('')}</ol></nav>`,
    ),
  );
  const id = `urn:uuid:${crypto.randomUUID()}`;
  put(
    'OEBPS/package.opf',
    `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${id}</dc:identifier><dc:title>${xmlEscape(draft.title)}</dc:title><dc:creator>${xmlEscape(draft.author)}</dc:creator><dc:language>${xmlEscape(draft.language)}</dc:language><dc:description>${xmlEscape(draft.description)}</dc:description><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest>${manifest.join('')}</manifest><spine>${spine.join('')}</spine></package>`,
  );
  return zipSync({ ...files, mimetype: [files.mimetype, { level: 0 }] });
}
