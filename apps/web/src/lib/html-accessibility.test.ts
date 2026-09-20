// @vitest-environment node
import axeBrowserSource from 'axe-core/axe.min.js?raw';
import purifierSource from 'dompurify/purify.min.js?raw';
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';
import {
  createAccessibilityDocument,
  MAX_ACCESSIBILITY_HTML,
  readAccessibilityMessage,
} from './html-accessibility';
const nonce = '12345678-1234-1234-1234-123456789012';
const fakeAxe = `window.axe = { configure() {}, async run() { return { testEngine: { version: 'test' }, timestamp: 'now', violations: [], incomplete: [], passes: [] }; } };`;

it('keeps untrusted HTML inert in script data, sanitizes in the isolated frame and preserves audit semantics', async () => {
  const source = createAccessibilityDocument({
    nonce,
    purifierSource,
    axeSource: axeBrowserSource + '\n' + fakeAxe,
    locale: null,
    html: '<html lang="zh-CN"><head><base href="https://example.invalid"><meta http-equiv="refresh" content="0;url=https://example.invalid"><link rel="stylesheet" href="https://example.invalid/a.css"><style>p { color:red }</style></head><body><script>window.USER_EXECUTED=true</script><img id="bad" onerror="window.USER_EXECUTED=true" src="https://example.invalid/x"><iframe src="https://example.invalid"></iframe><a href="https://example.invalid">Link</a><input><button></button><p>Text</p></body></html>',
  });
  expect(source).toContain(`script-src 'nonce-${nonce}'`);
  expect(source).not.toContain("script-src 'unsafe-inline'");
  expect(source).toContain('\\u003cscript>window.USER_EXECUTED');
  const dom = new JSDOM(source, {
    runScripts: 'dangerously',
    url: 'https://isolated.invalid/',
  });
  await new Promise<void>((resolve) =>
    dom.window.addEventListener('load', () => resolve(), { once: true }),
  );
  expect(dom.window.document.documentElement.lang).toBe('zh-CN');
  expect(
    dom.window.document.body.querySelector('script,iframe,base,link,meta'),
  ).toBeNull();
  expect(
    dom.window.document.body.querySelector('img')?.hasAttribute('onerror'),
  ).toBe(false);
  expect(
    dom.window.document.body.querySelector('img')?.hasAttribute('alt'),
  ).toBe(false);
  expect(dom.window.document.body.querySelector('button')?.textContent).toBe(
    '',
  );
  expect(
    dom.window.document.body.querySelector('a')?.getAttribute('href'),
  ).toBe('https://example.invalid');
  expect(Reflect.get(dom.window, 'USER_EXECUTED')).toBeUndefined();
  const event = new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  });
  expect(
    dom.window.document.body.querySelector('a')?.dispatchEvent(event),
  ).toBe(false);
  dom.window.close();
});

it('rejects wrong frame, stale nonce, invalid result payloads and oversized input', () => {
  const source = {} as Window;
  const data = {
    type: 'accessibility-result',
    nonce,
    report: { version: '4.13', passes: 1, violations: [], incomplete: [] },
  };
  expect(readAccessibilityMessage({ source, data }, source, nonce)).toEqual(
    data,
  );
  expect(
    readAccessibilityMessage({ source: {} as Window, data }, source, nonce),
  ).toBeNull();
  expect(
    readAccessibilityMessage({ source, data }, source, 'old-run'),
  ).toBeNull();
  expect(
    readAccessibilityMessage(
      { source, data: { ...data, report: {} } },
      source,
      nonce,
    ),
  ).toBeNull();
  expect(() =>
    createAccessibilityDocument({
      html: 'x'.repeat(MAX_ACCESSIBILITY_HTML + 1),
      nonce,
      axeSource: '',
      purifierSource: '',
      locale: null,
    }),
  ).toThrow('INPUT_TOO_LARGE');
  expect(() =>
    createAccessibilityDocument({
      html: '',
      nonce: '<script>',
      axeSource: '',
      purifierSource: '',
      locale: null,
    }),
  ).toThrow('INVALID_NONCE');
});
