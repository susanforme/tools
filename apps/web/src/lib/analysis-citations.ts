import type { CSL } from '@citation-js/core';
export type CitationRequest = {
  source: string;
  input: string;
  output: string;
  style: string;
  locale: string;
  deduplicate: boolean;
  entry: number;
};
export type CitationResult = {
  output: string;
  bibliography: string;
  citation: string;
  count: number;
  removed: string[];
  titles: string[];
};
export function deduplicateCitations(entries: CSL[]): {
  entries: CSL[];
  removed: string[];
} {
  const seen = new Set<string>();
  const removed: string[] = [];
  const normalize = (value: string) =>
    value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  return {
    entries: entries.filter((entry, index) => {
      const doi =
        typeof entry.DOI === 'string'
          ? normalize(entry.DOI)
              .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '')
              .replace(/^doi:\s*/, '')
          : '';
      const title = normalize(entry.title ?? '');
      const authors = (entry.author ?? [])
        .map((name) =>
          normalize(name.literal ?? `${name.family ?? ''},${name.given ?? ''}`),
        )
        .join(';');
      const year = entry.issued?.['date-parts']?.[0]?.[0];
      const key = doi
        ? `doi:${doi}`
        : title && authors && year
          ? JSON.stringify([
              title,
              authors,
              year,
              entry.type,
              entry.edition ?? '',
            ])
          : `unique:${index}`;
      if (seen.has(key)) {
        removed.push(entry.title ?? String(entry.id));
        return false;
      }
      seen.add(key);
      return true;
    }),
    removed,
  };
}
export async function processCitations(
  request: CitationRequest,
): Promise<CitationResult> {
  if (
    !request.source.trim() ||
    request.source.length > 500000 ||
    !['bibtex', 'ris', 'json'].includes(request.input) ||
    !['bibtex', 'ris', 'json', 'bibliography'].includes(request.output) ||
    !['apa', 'vancouver', 'harvard1'].includes(request.style) ||
    !['en-US', 'fr-FR', 'de-DE', 'es-ES', 'nl-NL'].includes(request.locale) ||
    !Number.isInteger(request.entry) ||
    request.entry < 0
  )
    throw new Error('citationLimit');
  const { Cite } = await import('@citation-js/core');
  await Promise.all([
    import('@citation-js/plugin-bibtex'),
    import('@citation-js/plugin-ris'),
    import('@citation-js/plugin-csl'),
  ]);
  let source: unknown = request.source;
  if (request.input === 'json') {
    source = JSON.parse(request.source);
    if (
      !Array.isArray(source) ||
      source.some(
        (value: unknown) =>
          !value ||
          typeof value !== 'object' ||
          Array.isArray(value) ||
          !('type' in value) ||
          typeof value.type !== 'string',
      )
    )
      throw new Error('citationFormat');
  } else if (
    request.input === 'bibtex'
      ? !/^\s*@/.test(request.source)
      : !/^TY {2}- /m.test(request.source)
  )
    throw new Error('citationFormat');
  // 显式格式阻止 DOI/URL 自动识别为远程抓取请求。
  const parsed = new Cite(source, {
    forceType:
      request.input === 'json'
        ? '@csl/list+object'
        : request.input === 'bibtex'
          ? '@bibtex/text'
          : '@ris/file',
    generateGraph: false,
    maxChainLength: 10,
    strict: true,
    target: '@csl/list+object',
  });
  if (!parsed.data.length || parsed.data.length > 300)
    throw new Error('citationLimit');
  const deduplicated = request.deduplicate
    ? deduplicateCitations(parsed.data)
    : { entries: parsed.data, removed: [] };
  const ids = new Set<string>();
  const entries = deduplicated.entries.map((entry, index) => {
    let id = String(entry.id || `ref-${index + 1}`);
    if (ids.has(id)) id = `ref-${index + 1}-${id}`;
    ids.add(id);
    return { ...entry, id };
  });
  const cite = new Cite(entries, {
    forceType: '@csl/list+object',
    generateGraph: false,
    maxChainLength: 10,
    strict: true,
    target: '@csl/list+object',
  });
  const options = {
    style: request.style,
    lang: request.locale,
    format: 'text',
  };
  const bibliography = cite.format('bibliography', options);
  if (request.entry > entries.length) throw new Error('citationEntry');
  const selected =
    request.entry === 0
      ? entries.map((entry) => entry.id)
      : [entries[request.entry - 1].id];
  const citation = cite.format('citation', {
    ...options,
    entry: selected,
    citationsPre: [],
    citationsPost: [],
  });
  const output =
    request.output === 'json'
      ? JSON.stringify(entries, null, 2)
      : request.output === 'bibliography'
        ? bibliography
        : request.output === 'bibtex'
          ? cite.format('bibtex')
          : cite.format('ris');
  return {
    output,
    bibliography,
    citation,
    count: entries.length,
    removed: deduplicated.removed,
    titles: entries.map((entry) => entry.title ?? String(entry.id)),
  };
}
