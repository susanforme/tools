export async function createSelectorPreview(source: string, selector: string) {
  if (
    new TextEncoder().encode(source).length > 256 * 1024 ||
    selector.length > 2000
  )
    throw new Error('LIMIT');
  // template 内容保持惰性；不会因输入中的图片、iframe 或脚本发起请求。
  const template = document.createElement('template');
  template.innerHTML = source;
  if (template.content.querySelectorAll('*').length > 5000)
    throw new Error('LIMIT');
  if (!selector.trim()) throw new Error('INVALID');
  const matches = Array.from(template.content.querySelectorAll(selector));
  const snippets = matches
    .slice(0, 100)
    .map((element) => element.outerHTML.slice(0, 10000));
  template.content
    .querySelectorAll('[data-tool-match]')
    .forEach((node) => node.removeAttribute('data-tool-match'));
  matches.forEach((element) => element.setAttribute('data-tool-match', 'true'));
  const { default: purify } = await import('dompurify');
  const content = purify.sanitize(template.innerHTML, {
    FORBID_TAGS: [
      'style',
      'link',
      'meta',
      'base',
      'iframe',
      'object',
      'embed',
      'script',
      'svg',
      'math',
      'video',
      'audio',
      'source',
    ],
    FORBID_ATTR: [
      'style',
      'src',
      'srcset',
      'href',
      'action',
      'formaction',
      'poster',
      'background',
    ],
  });
  return {
    count: matches.length,
    snippets,
    html: `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"><style>body{font:14px system-ui;padding:16px;overflow-wrap:anywhere;color:#111;background:#fff}[data-tool-match]{outline:2px solid #e11d48;background:#ffe4e6}img:empty{display:none}</style></head><body>${content}</body></html>`,
  };
}
