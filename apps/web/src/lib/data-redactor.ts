export type RedactionKind =
  | 'EMAIL'
  | 'PHONE'
  | 'IP'
  | 'TOKEN'
  | 'SECRET'
  | 'FIELD';
export type RedactionMatch = {
  id: string;
  kind: RedactionKind;
  value: string;
  replacement: string;
  enabled: boolean;
  occurrences: number;
};
export type RedactionOptions = { format?: 'text' | 'json'; paths?: string[] };
export type RedactionResult = { output: string; matches: RedactionMatch[] };
export const MAX_REDACTION_LENGTH = 2 * 1024 * 1024;
// 与 HAR 的敏感 header / query 规则保持一致；此处额外覆盖 JSON 字段。
const SECRET_KEY =
  /^(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key|api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|passwd|client[_-]?secret)$/i;
type Span = { start: number; end: number; kind: RedactionKind; value: string };

function findSpans(source: string): Span[] {
  const spans: Span[] = [];
  const add = (pattern: RegExp, kind: RedactionKind, group = 0): void => {
    for (const match of source.matchAll(pattern)) {
      const value = match[group];
      if (!value) continue;
      if (kind === 'IP' && value.split('.').some((part) => Number(part) > 255))
        continue;
      const start = match.index + (group ? match[0].lastIndexOf(value) : 0);
      spans.push({ start, end: start + value.length, kind, value });
      if (spans.length > 20_000) throw new Error('TOO_MANY_MATCHES');
    }
  };
  add(
    /(?:^|\n)[ \t]*(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key)[ \t]*:[ \t]*([^\r\n]+)/gi,
    'SECRET',
    1,
  );
  add(/\b(?:Bearer|Basic)[ \t]+([A-Za-z0-9._~+\/-]+=*)/gi, 'TOKEN', 1);
  add(
    /(?<![?&])\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|token)[ \t]*=[ \t]*([^\s&\"']+)/gi,
    'SECRET',
    1,
  );
  add(
    /[?&](?:token|access_token|refresh_token|secret|password|api[_-]?key|auth)=([^\s&#"']+)/gi,
    'TOKEN',
    1,
  );
  add(
    /\b(?:sk-(?:ant-)?[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[A-Z0-9]{16})\b/g,
    'TOKEN',
  );
  add(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, 'TOKEN');
  add(
    /[A-Z0-9.!#$%&'*+\/=?^_`{|}~-]{1,64}@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?){1,10}/gi,
    'EMAIL',
  );
  add(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, 'IP');
  add(
    /(?<![\w.])(?:\+\d{1,3}[ ()-]*(?:\d[ ()-]*){7,13}\d|1[3-9]\d{9})(?![\w.])/g,
    'PHONE',
  );
  // ponytail: 模式检测有误报与漏报；保留逐项人工确认，更多格式按实际样本补规则。
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const accepted: Span[] = [];
  for (const span of spans) {
    if (!accepted.length || span.start >= accepted[accepted.length - 1].end)
      accepted.push(span);
  }
  return accepted;
}

export function analyzeRedaction(
  source: string,
  options: RedactionOptions = {},
  overrides: RedactionMatch[] = [],
): RedactionResult {
  if (source.length > MAX_REDACTION_LENGTH) throw new Error('INPUT_TOO_LARGE');
  const existing = new Map(overrides.map((match) => [match.id, match]));
  const matches = new Map<string, RedactionMatch>();
  const counts = new Map<RedactionKind, number>();
  const occupied = new Set(
    source.match(/\[(?:EMAIL|PHONE|IP|TOKEN|SECRET|FIELD)_\d+\]/g) ?? [],
  );
  const replace = (value: string, kind: RedactionKind): string => {
    const id = `${kind}:${value}`;
    let match = matches.get(id);
    if (!match) {
      if (matches.size >= 10_000) throw new Error('TOO_MANY_MATCHES');
      let count = (counts.get(kind) ?? 0) + 1;
      while (occupied.has(`[${kind}_${count}]`)) count += 1;
      counts.set(kind, count);
      const override = existing.get(id);
      match = {
        id,
        kind,
        value,
        replacement: override?.replacement ?? `[${kind}_${count}]`,
        enabled: override?.enabled ?? true,
        occurrences: 0,
      };
      matches.set(id, match);
    }
    match.occurrences += 1;
    return match.enabled ? match.replacement : value;
  };
  const text = (value: string): string => {
    let start = 0;
    const parts: string[] = [];
    for (const span of findSpans(value)) {
      parts.push(
        value.slice(start, span.start),
        replace(span.value, span.kind),
      );
      start = span.end;
    }
    return parts.join('') + value.slice(start);
  };
  let output: string;
  if (options.format === 'json') {
    const pointers = (options.paths ?? []).filter(Boolean).map((path) => {
      if (!path.startsWith('/') || /~(?![01])/u.test(path))
        throw new Error('INVALID_POINTER');
      return path
        .slice(1)
        .split('/')
        .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
    });
    const walk = (value: unknown, path: string[], depth: number): unknown => {
      if (depth > 100) throw new Error('TOO_DEEP');
      const custom = pointers.some(
        (parts) =>
          parts.length === path.length &&
          parts.every((part, i) => part === '*' || part === path[i]),
      );
      if (
        custom ||
        (path.length > 0 && SECRET_KEY.test(path[path.length - 1]))
      ) {
        const original =
          typeof value === 'string' ? value : JSON.stringify(value);
        const result = replace(original, custom ? 'FIELD' : 'SECRET');
        // 禁用对象字段脱敏时保留原始类型。
        return result === original ? value : result;
      }
      if (typeof value === 'string') {
        let embedded: unknown = null;
        if (/^\s*[\[{]/.test(value)) {
          try {
            embedded = JSON.parse(value) as unknown;
          } catch {
            /* 普通字符串按文本检测。 */
          }
        }
        if (embedded && typeof embedded === 'object')
          return JSON.stringify(walk(embedded, path, depth + 1));
        return text(value);
      }
      if (Array.isArray(value))
        return value.map((item, index) =>
          walk(item, [...path, String(index)], depth + 1),
        );
      if (value && typeof value === 'object')
        return Object.fromEntries(
          Object.entries(value).map(([key, item]) => {
            const headerName = (value as Record<string, unknown>).name;
            return [
              key,
              key === 'value' &&
              typeof item === 'string' &&
              typeof headerName === 'string' &&
              SECRET_KEY.test(headerName)
                ? replace(item, 'SECRET')
                : walk(item, [...path, key], depth + 1),
            ];
          }),
        );
      return value;
    };
    output = JSON.stringify(
      walk(JSON.parse(source) as unknown, [], 0),
      null,
      2,
    );
  } else {
    output = text(source);
  }
  return { output, matches: [...matches.values()] };
}

export function redactText(source: string): string {
  return analyzeRedaction(source).output;
}
