import createDOMPurify, { type DOMPurify, type WindowLike } from 'dompurify';
import { marked } from 'marked';

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
