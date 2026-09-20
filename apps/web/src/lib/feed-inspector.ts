import { checkFormatSize, formatOutput } from './format-input';
export type FeedItem = {
  id: string;
  title: string;
  link: string | null;
  summary: string;
  author: string;
  date: string;
};
export type FeedResult = {
  format: 'RSS 2.0' | 'Atom';
  title: string;
  description: string;
  link: string | null;
  updated: string;
  items: FeedItem[];
  issues: Array<{ path: string; code: string }>;
};
type Element = {
  local: string;
  namespace: string;
  attrs: Record<string, string>;
  children: Element[];
  text: string;
  base: string;
};
const ATOM = 'http://www.w3.org/2005/Atom';
export function safeFeedUrl(value: string, base = ''): string | null {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
export async function inspectFeed(xml: string): Promise<FeedResult> {
  checkFormatSize(xml);
  if (
    /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(
      xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/g, ''),
    )
  )
    throw new Error('XML_ENTITIES');
  const { XMLParser, XMLValidator } = await import('fast-xml-parser');
  const valid = XMLValidator.validate(xml);
  if (valid !== true) throw new Error(`XML_INVALID:${valid.err.msg}`);
  const raw: unknown = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    processEntities: true,
  }).parse(xml);
  let nodes = 0;
  const build = (
    rows: unknown,
    inherited: Record<string, string> = {},
    base = '',
    depth = 0,
  ): Element[] => {
    if (!Array.isArray(rows)) return [];
    if (depth > 100) throw new Error('STRUCTURE_LIMIT');
    const result: Element[] = [];
    for (const row of rows as Record<string, unknown>[]) {
      if (++nodes > 100000) throw new Error('STRUCTURE_LIMIT');
      const name = Object.keys(row).find(
        (key) => key !== ':@' && !key.startsWith('#') && !key.startsWith('?'),
      );
      if (!name) continue;
      const attrs = Object.fromEntries(
        Object.entries((row[':@'] ?? {}) as Record<string, string>).map(
          ([key, value]) => [key.slice(2), String(value)],
        ),
      );
      const namespaces = { ...inherited };
      for (const [key, value] of Object.entries(attrs)) {
        if (key === 'xmlns') namespaces[''] = value;
        else if (key.startsWith('xmlns:')) namespaces[key.slice(6)] = value;
      }
      const [prefix, local] = name.includes(':') ? name.split(':') : ['', name];
      const nextBase = attrs['xml:base']
        ? (safeFeedUrl(attrs['xml:base'], base) ?? '')
        : base;
      const children = build(row[name], namespaces, nextBase, depth + 1);
      let childIndex = 0;
      const text = Array.isArray(row[name])
        ? (row[name] as Record<string, unknown>[])
            .map((item) => {
              if (typeof item['#text'] === 'string') return item['#text'];
              if (
                Object.keys(item).some(
                  (key) =>
                    key !== ':@' &&
                    !key.startsWith('#') &&
                    !key.startsWith('?'),
                )
              )
                return children[childIndex++]?.text ?? '';
              return '';
            })
            .join('')
        : '';
      result.push({
        local: local!,
        namespace: namespaces[prefix!] ?? (prefix ? '?' : ''),
        attrs,
        children,
        text,
        base: nextBase,
      });
    }
    return result;
  };
  const roots = build(raw);
  if (roots.length !== 1) throw new Error('FEED_FORMAT');
  const root = roots[0]!;
  const atom = root.local === 'feed' && root.namespace === ATOM;
  if (
    !atom &&
    (root.local !== 'rss' ||
      root.namespace !== '' ||
      root.attrs.version !== '2.0')
  )
    throw new Error('FEED_FORMAT');
  const namespace = atom ? ATOM : '';
  const children = (node: Element, name: string): Element[] =>
    node.children.filter(
      (child) => child.local === name && child.namespace === namespace,
    );
  const first = (node: Element, name: string): Element | undefined =>
    children(node, name)[0];
  const text = (node: Element, name: string): string =>
    first(node, name)?.text.trim() ?? '';
  const channel = atom ? root : first(root, 'channel');
  if (!channel) throw new Error('FEED_CHANNEL');
  const issues: FeedResult['issues'] = [];
  const issue = (path: string, code: string): void => {
    if (issues.length >= 1000) throw new Error('FEED_ISSUES');
    issues.push({ path, code });
  };
  const required = (node: Element, names: string[], path: string): void => {
    for (const name of names)
      if (!text(node, name)) issue(`${path}/${name}`, 'required');
  };
  const link = (node: Element, path: string): string | null => {
    const element = atom
      ? children(node, 'link').find(
          (child) => !child.attrs.rel || child.attrs.rel === 'alternate',
        )
      : first(node, 'link');
    const value = element
      ? atom
        ? (element.attrs.href ?? '')
        : element.text.trim()
      : '';
    if (!value) return null;
    const url = safeFeedUrl(value, element!.base);
    if (!url) issue(`${path}/link`, 'unsafeLink');
    return url;
  };
  const author = (node: Element): string =>
    atom
      ? children(node, 'author')
          .map((item) => text(item, 'name'))
          .filter(Boolean)
          .join(', ')
      : text(node, 'author');
  const date = (value: string, path: string): void => {
    if (
      value &&
      (!Number.isFinite(Date.parse(value)) ||
        (atom &&
          !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(
            value,
          )))
    )
      issue(path, 'invalidDate');
  };
  required(
    channel,
    atom ? ['id', 'title', 'updated'] : ['title', 'link', 'description'],
    'feed',
  );
  if (!atom && children(root, 'channel').length !== 1)
    issue('feed/channel', 'duplicate');
  const records = children(channel, atom ? 'entry' : 'item');
  if (records.length > 10000) throw new Error('STRUCTURE_LIMIT');
  const ids = new Set<string>();
  const feedAuthor = author(channel);
  const items = records.map((node, index): FeedItem => {
    const path = `${atom ? 'entry' : 'item'}[${index + 1}]`;
    if (atom) required(node, ['id', 'title', 'updated'], path);
    else if (!text(node, 'title') && !text(node, 'description'))
      issue(path, 'itemContent');
    const id = text(node, atom ? 'id' : 'guid');
    if (id) {
      if (ids.has(id)) issue(`${path}/id`, 'duplicate');
      ids.add(id);
    }
    const updated = text(node, atom ? 'updated' : 'pubDate');
    date(updated, `${path}/date`);
    const itemLink = link(node, path);
    if (atom && !first(node, 'content') && !itemLink)
      issue(path, 'atomContent');
    const itemAuthor = author(node) || feedAuthor;
    if (atom && !itemAuthor) issue(`${path}/author`, 'required');
    return {
      id,
      title: text(node, 'title'),
      link: itemLink,
      summary:
        text(node, atom ? 'summary' : 'description') ||
        text(node, 'content') ||
        node.children.find(
          (child) =>
            child.local === 'encoded' &&
            child.namespace === 'http://purl.org/rss/1.0/modules/content/',
        )?.text ||
        '',
      author: itemAuthor,
      date: updated,
    };
  });
  if (atom && !feedAuthor && !records.length) issue('feed/author', 'required');
  const updated =
    text(channel, atom ? 'updated' : 'lastBuildDate') ||
    text(channel, 'pubDate');
  date(updated, 'feed/date');
  const result: FeedResult = {
    format: atom ? 'Atom' : 'RSS 2.0',
    title: text(channel, 'title'),
    description: text(channel, atom ? 'subtitle' : 'description'),
    link: link(channel, 'feed'),
    updated,
    items,
    issues,
  };
  formatOutput(result);
  return result;
}
