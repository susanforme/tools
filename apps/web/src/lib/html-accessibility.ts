export const MAX_ACCESSIBILITY_HTML = 256 * 1024;
export const ACCESSIBILITY_TIMEOUT_MS = 20_000;
export type AccessibilityNode = {
  target: string[];
  html: string;
  summary: string;
};
export type AccessibilityRule = {
  id: string;
  help: string;
  helpUrl: string;
  impact: string | null;
  tags: string[];
  nodeCount: number;
  nodes: AccessibilityNode[];
};
export type AccessibilityReport = {
  version: string;
  timestamp: string;
  violations: AccessibilityRule[];
  incomplete: AccessibilityRule[];
  passes: number;
  nodeLimit: number;
};
export type AccessibilityMessage =
  | { type: 'accessibility-result'; nonce: string; report: AccessibilityReport }
  | { type: 'accessibility-error'; nonce: string; error: string };

type DocumentOptions = {
  html: string;
  nonce: string;
  axeSource: string;
  purifierSource: string;
  locale: unknown;
};

function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function createAccessibilityDocument({
  html,
  nonce,
  axeSource,
  purifierSource,
  locale,
}: DocumentOptions): string {
  if (html.length > MAX_ACCESSIBILITY_HTML) throw new Error('INPUT_TOO_LARGE');
  if (!/^[a-zA-Z0-9-]{20,80}$/.test(nonce)) throw new Error('INVALID_NONCE');
  const script = `${purifierSource}\n${axeSource}\n;
(() => {
  const nonce = ${scriptJson(nonce)};
  const raw = ${scriptJson(html)};
  const locale = ${scriptJson(locale)};
  const audit = window.axe;
  const purifier = window.DOMPurify;
  const send = (data) => parent.postMessage({ ...data, nonce }, '*');
  // 保留链接语义供 axe 检查，但阻止交互导航及表单提交。
  document.addEventListener('click', (event) => event.preventDefault(), true);
  document.addEventListener('submit', (event) => event.preventDefault(), true);
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (event.source !== parent || !data || data.nonce !== nonce || data.type !== 'accessibility-locate' || !Array.isArray(data.target)) return;
    try {
      let root = document;
      let node = null;
      for (const selector of data.target) {
        if (typeof selector !== 'string') return;
        node = root.querySelector(selector);
        if (!node) return;
        root = node.shadowRoot || node;
      }
      if (node) {
        document.querySelectorAll('[data-a11y-selected]').forEach((item) => item.removeAttribute('data-a11y-selected'));
        node.setAttribute('data-a11y-selected', '');
        node.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    } catch { /* axe selector 无法定位时保留检查结果。 */ }
  });
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const clean = purifier.sanitize(raw, {
        WHOLE_DOCUMENT: true,
        ADD_TAGS: ['style'],
        FORBID_TAGS: ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'base', 'meta', 'link'],
        FORBID_ATTR: ['srcdoc', 'nonce', 'autofocus'],
        ALLOW_DATA_ATTR: false,
      });
      const parsed = new DOMParser().parseFromString(clean, 'text/html');
      if (parsed.querySelectorAll('*').length > 5000) throw new Error('TOO_MANY_NODES');
      for (const attr of parsed.documentElement.attributes) document.documentElement.setAttribute(attr.name, attr.value);
      for (const attr of parsed.body.attributes) document.body.setAttribute(attr.name, attr.value);
      document.head.append(...parsed.head.childNodes);
      document.body.replaceChildren(...parsed.body.childNodes);
      if (locale) audit.configure({ locale });
      const results = await audit.run(document, { iframes: false, preload: false, resultTypes: ['violations', 'incomplete'] });
      const collect = (rules) => rules.map((rule) => ({
        id: rule.id, help: rule.help, helpUrl: rule.helpUrl, impact: rule.impact || null, tags: rule.tags,
        nodeCount: rule.nodes.length,
        nodes: rule.nodes.slice(0, 100).map((node) => ({ target: node.target.flat(Infinity), html: node.html, summary: node.failureSummary || [...node.any, ...node.all, ...node.none].map((check) => check.message).join('\\n') })),
      }));
      send({ type: 'accessibility-result', report: { version: results.testEngine.version, timestamp: results.timestamp, violations: collect(results.violations), incomplete: collect(results.incomplete), passes: results.passes.length, nodeLimit: 100 } });
      const highlight = document.createElement('style');
      highlight.textContent = '[data-a11y-selected] { outline: 3px solid #e11d48 !important; outline-offset: 3px !important; }';
      document.head.append(highlight);
    } catch (error) {
      send({ type: 'accessibility-error', error: error instanceof Error ? error.message : String(error) });
    }
  }, { once: true });
})();`;
  // CSP 在用户 HTML 解析前生效；nonce 限制脚本入口。axe 内置中文模板编译需要 eval。
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'${locale ? " 'unsafe-eval'" : ''}; script-src-attr 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><script nonce="${nonce}">${script.replace(/<\/script/gi, '<\\/script')}</script></head><body></body></html>`;
}

export function readAccessibilityMessage(
  event: Pick<MessageEvent<unknown>, 'source' | 'data'>,
  source: Window | null,
  nonce: string,
): AccessibilityMessage | null {
  if (
    !source ||
    event.source !== source ||
    !event.data ||
    typeof event.data !== 'object'
  )
    return null;
  const data = event.data as Record<string, unknown>;
  if (data.nonce !== nonce) return null;
  if (data.type === 'accessibility-error' && typeof data.error === 'string')
    return data as AccessibilityMessage;
  if (
    data.type !== 'accessibility-result' ||
    !data.report ||
    typeof data.report !== 'object'
  )
    return null;
  const report = data.report as Record<string, unknown>;
  if (
    !Array.isArray(report.violations) ||
    !Array.isArray(report.incomplete) ||
    typeof report.version !== 'string' ||
    typeof report.passes !== 'number'
  )
    return null;
  return data as AccessibilityMessage;
}
