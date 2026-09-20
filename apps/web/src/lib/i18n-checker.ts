export const TRANSLATION_LIMIT = 2 * 1024 * 1024;
export const TRANSLATION_RULES = [
  'missing',
  'extra',
  'empty',
  'type',
  'placeholder',
  'html',
  'newline',
] as const;
export type TranslationRule = (typeof TRANSLATION_RULES)[number];
export type TranslationIssue = {
  target: string;
  path: string;
  rule: TranslationRule;
  base: unknown;
  value: unknown;
};
export type TranslationSource = { name: string; text: string };
export type TranslationRequest = {
  base: string;
  sources: TranslationSource[];
  rules: TranslationRule[];
};

function flattenTranslation(text: string): Map<string, unknown> {
  if (text.length > TRANSLATION_LIMIT)
    throw new Error('JSON 文件不能超过 2 MB');
  const root: unknown = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (!root || typeof root !== 'object' || Array.isArray(root))
    throw new Error('翻译文件必须是 JSON 对象');
  const leaves = new Map<string, unknown>();
  const visit = (value: unknown, path: string, depth: number): void => {
    if (depth > 100) throw new Error('JSON 嵌套不能超过 100 层');
    if (value && typeof value === 'object' && Object.keys(value).length) {
      for (const [key, child] of Object.entries(value))
        visit(
          child,
          `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`,
          depth + 1,
        );
    } else if (path) leaves.set(path, value);
  };
  visit(root, '', 0);
  return leaves;
}

function placeholders(text: string): string[] {
  // ponytail: 检查常见插值和 printf；完整 ICU 分支语义需接入专用 ICU parser。
  return Array.from(
    text.matchAll(
      /\{\{\s*(-?\s*[\w.]+)(?:\s*,[^{}]+)?\s*\}\}|(?<!\{)\{([\w.]+)\}(?!\})|%%|%(?:\d+\$)?[-+#0 ]*(?:\d+)?(?:\.\d+)?[sdif]/g,
    ),
    ([token, double, single]) =>
      double
        ? `{{${double.replace(/\s/g, '')}}}`
        : single
          ? `{${single}}`
          : token,
  )
    .filter((token) => token !== '%%')
    .sort();
}

function tags(text: string): string[] {
  // 仅比较标签顺序与闭合标记，不渲染输入 HTML。
  return Array.from(
    text.matchAll(
      /<\s*(\/?)\s*([a-z][\w:-]*|\d+)((?:[^<>"']|"[^"]*"|'[^']*')*)>/gi,
    ),
    ([, closing, tag, attributes]) =>
      `${closing}${tag.toLowerCase()}${attributes.trimEnd().endsWith('/') && !/^(br|hr|img|input|meta|link|wbr)$/i.test(tag) ? '/' : ''}`,
  );
}

export function checkTranslations(
  baseText: string,
  targets: TranslationSource[],
  rules: readonly TranslationRule[] = TRANSLATION_RULES,
): TranslationIssue[] {
  const base = flattenTranslation(baseText);
  const issues: TranslationIssue[] = [];
  for (const target of targets) {
    let values: Map<string, unknown>;
    try {
      values = flattenTranslation(target.text);
    } catch (cause) {
      throw new Error(`${target.name}: ${(cause as Error).message}`);
    }
    const add = (path: string, rule: TranslationRule): void => {
      if (rules.includes(rule))
        issues.push({
          target: target.name,
          path,
          rule,
          base: base.get(path) ?? null,
          value: values.get(path) ?? null,
        });
    };
    for (const [path, expected] of base) {
      if (!values.has(path)) {
        add(path, 'missing');
        continue;
      }
      const actual = values.get(path);
      if (
        actual === null ||
        (typeof actual === 'string' && !actual.trim()) ||
        (typeof actual === 'object' &&
          actual !== null &&
          !Object.keys(actual).length)
      )
        add(path, 'empty');
      if (
        typeof actual !== typeof expected ||
        Array.isArray(actual) !== Array.isArray(expected) ||
        (actual === null) !== (expected === null)
      )
        add(path, 'type');
      if (typeof expected !== 'string' || typeof actual !== 'string') continue;
      if (
        JSON.stringify(placeholders(expected)) !==
        JSON.stringify(placeholders(actual))
      )
        add(path, 'placeholder');
      if (JSON.stringify(tags(expected)) !== JSON.stringify(tags(actual)))
        add(path, 'html');
      if (
        (expected.match(/\r\n|\r|\n/g)?.length ?? 0) !==
        (actual.match(/\r\n|\r|\n/g)?.length ?? 0)
      )
        add(path, 'newline');
    }
    for (const path of values.keys()) if (!base.has(path)) add(path, 'extra');
  }
  return issues;
}
