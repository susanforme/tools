import createDOMPurify, { type DOMPurify, type WindowLike } from 'dompurify';
import { marked, type Tokens } from 'marked';

let purifier: DOMPurify | null = null;

export function renderMarkdown(
  source: string,
  windowLike: WindowLike = window,
): string {
  purifier ??= createDOMPurify(windowLike);
  return purifier.sanitize(
    marked.parse(source, { async: false, breaks: true, gfm: true }),
  );
}

export function markdownToToc(source: string): string {
  const used = new Map<string, number>();
  const headings = marked
    .lexer(source, { gfm: true })
    .filter((token): token is Tokens.Heading => token.type === 'heading');
  const minDepth = Math.min(...headings.map(({ depth }) => depth), 1);
  return headings
    .map(({ depth, text }) => {
      const title = text.replace(/<[^>]+>|[`*_~[\]()]/g, '').trim();
      const base =
        title
          .normalize('NFKC')
          .toLowerCase()
          .replace(/[^\p{Letter}\p{Number}\s_-]/gu, '')
          .trim()
          .replace(/\s+/g, '-') || 'section';
      const count = used.get(base) ?? 0;
      used.set(base, count + 1);
      return `${'  '.repeat(depth - minDepth)}- [${title}](#${base}${count ? `-${count}` : ''})`;
    })
    .join('\n');
}
