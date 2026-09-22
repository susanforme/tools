export type CascadeCandidate = {
  selector: string;
  value: string;
  important: boolean;
  context: string;
  winner: boolean;
};
export type CascadeResult = {
  computed: string;
  candidates: CascadeCandidate[];
  matched: number;
  error?: string;
};

// 在 opaque-origin iframe 中执行；用同一浏览器的层叠算法选择命中的声明。
function cascadeRuntime(payload: {
  css: string;
  selector: string;
  property: string;
  id: string;
}) {
  try {
    const target = document.querySelector(payload.selector);
    if (!target) throw new Error('未找到目标元素');
    const source = document.createElement('style');
    source.textContent = payload.css;
    document.head.append(source);
    if (!source.sheet) throw new Error('CSS 无法读取');
    const candidates: CascadeCandidate[] = [];
    const marker = '--tool-cascade-' + payload.id;
    function walk(rules: CSSRuleList, context: string[]): void {
      Array.from(rules).forEach((rule): void => {
        if (rule instanceof CSSStyleRule) {
          if (rule.cssRules.length)
            throw new Error('暂不支持 CSS 嵌套，请展开规则后重试');
          const value = rule.style.getPropertyValue(payload.property);
          if (!value || !target?.matches(rule.selectorText)) return;
          const important =
            rule.style.getPropertyPriority(payload.property) === 'important';
          const index =
            candidates.push({
              selector: rule.selectorText,
              value,
              important,
              context: context.join(' → '),
              winner: false,
            }) - 1;
          const markerValue = [
            'revert-layer',
            'revert',
            'inherit',
            'initial',
            'unset',
          ].includes(value.trim())
            ? value
            : String(index);
          rule.style.setProperty(
            marker,
            markerValue,
            important ? 'important' : '',
          );
          return;
        }
        if ('cssRules' in rule) {
          const header = rule.cssText
            .slice(0, rule.cssText.indexOf('{'))
            .trim();
          // 只比较 author rules；动画和 keyframes 不参与声明来源定位。
          if (
            header.startsWith('@keyframes') ||
            header.startsWith('@-webkit-keyframes')
          )
            return;
          walk((rule as CSSGroupingRule).cssRules, [...context, header]);
        }
      });
    }
    const computed = getComputedStyle(target).getPropertyValue(
      payload.property,
    );
    // 直接在原 CSSOM 规则上标记，保留匿名 layer、scope 和条件的真实顺序。
    walk(source.sheet.cssRules, []);
    const winner = getComputedStyle(target).getPropertyValue(marker).trim();
    if (winner && candidates[Number(winner)])
      candidates[Number(winner)].winner = true;
    parent.postMessage(
      {
        id: payload.id,
        computed,
        candidates,
        matched: document.querySelectorAll(payload.selector).length,
      },
      '*',
    );
  } catch (cause) {
    parent.postMessage(
      { id: payload.id, error: (cause as Error).message },
      '*',
    );
  }
}

export async function createCascadeDocument(
  html: string,
  css: string,
  selector: string,
  property: string,
  id: string,
): Promise<string> {
  if (html.length + css.length > 200000 || selector.length > 2000)
    throw new Error('输入最多 200 KB');
  if (!/^(?:--[\w-]+|[a-z][a-z-]*)$/.test(property))
    throw new Error('CSS 属性名无效');
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error('运行标识无效');
  const { default: purify } = await import('dompurify');
  const content = purify.sanitize(html, {
    FORBID_TAGS: [
      'style',
      'script',
      'link',
      'meta',
      'base',
      'iframe',
      'object',
      'embed',
      'svg',
      'math',
    ],
    FORBID_ATTR: [
      'style',
      'src',
      'srcset',
      'href',
      'action',
      'formaction',
      'poster',
    ],
  });
  const payload = JSON.stringify({ css, selector, property, id }).replace(
    /</g,
    '\\u003c',
  );
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${id}'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"></head><body>${content}<script nonce="${id}">(${cascadeRuntime.toString()})(${payload})</script></body></html>`;
}
