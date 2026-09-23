import type { SearchDocument } from './batch4-document-data';
import { loadRuntimeAssetUrl } from './runtime-assets';
export async function extractSearchDocument(
  file: File,
): Promise<SearchDocument> {
  if (file.size > 20 * 1024 * 1024) throw new Error('size');
  const type = file.name.split('.').pop()!.toLowerCase();
  const sections: SearchDocument['sections'] = [];
  if (['txt', 'md'].includes(type)) {
    const text = await file.text();
    if (text.length > 2000000) throw new Error('size');
    sections.push({ label: '', text });
  } else if (type === 'docx') {
    const { unzipTraceEntries } = await import('./playwright-trace');
    const entries = await unzipTraceEntries(
      new Uint8Array(await file.arrayBuffer()),
      (name) =>
        /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(
          name,
        ),
    );
    if (!entries.has('word/document.xml')) throw new Error('document');
    for (const [name, bytes] of entries) {
      const source = new TextDecoder().decode(bytes);
      if (source.length > 4000000 || /<!DOCTYPE|<!ENTITY/i.test(source))
        throw new Error('document');
      const xml = new DOMParser().parseFromString(source, 'application/xml');
      if (xml.querySelector('parsererror')) throw new Error('document');
      const text = Array.from(xml.getElementsByTagNameNS('*', 'p'), (p) =>
        Array.from(
          p.getElementsByTagNameNS('*', 't'),
          (node) => node.textContent ?? '',
        ).join(''),
      ).join('\n');
      sections.push({ label: name.replace('word/', ''), text });
    }
  } else if (type === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = await loadRuntimeAssetUrl(
      'pdfWorker',
      'text/javascript',
    );
    const loading = pdfjs.getDocument({ data: await file.arrayBuffer() });
    try {
      const pdf = await loading.promise;
      if (pdf.numPages > 200) throw new Error('pages');
      let size = 0;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) =>
            'str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : '',
          )
          .join('');
        size += text.length;
        if (size > 2000000) throw new Error('size');
        sections.push({ label: String(i), text });
        page.cleanup();
      }
    } finally {
      await loading.destroy();
    }
  } else throw new Error('type');
  if (sections.reduce((sum, section) => sum + section.text.length, 0) > 2000000)
    throw new Error('size');
  if (!sections.some((s) => s.text.trim())) throw new Error('noText');
  return { name: file.name, type, sections };
}
