import { COLOR_SPACES, DEFINITIONS, WEIGHTS } from './design-tokens-schema';

export interface TokenIssue {
  path: string;
  code: string;
  detail: string;
}
export interface DesignToken {
  path: string;
  type: string;
  css: string;
  color: string | null;
  spacing: number | null;
}
export interface TokensResult {
  tokens: DesignToken[];
  issues: TokenIssue[];
  css: string;
}
export interface TokensRequest {
  text?: string;
  file?: File;
  prefix: string;
}
type Obj = Record<string, unknown>;
interface RawToken {
  path: string;
  value: unknown;
  type: unknown;
  inherited: unknown;
}
const isObject = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const owns = (v: Obj, key: string): boolean => Object.hasOwn(v, key);
const TYPES = Object.keys(DEFINITIONS);
const FIELD_TYPES: Record<string, string> = {
  color: 'color',
  width: 'dimension',
  style: 'strokeStyle',
  duration: 'duration',
  delay: 'duration',
  timingFunction: 'cubicBezier',
  offsetX: 'dimension',
  offsetY: 'dimension',
  blur: 'dimension',
  spread: 'dimension',
  fontFamily: 'fontFamily',
  fontSize: 'dimension',
  fontWeight: 'fontWeight',
  letterSpacing: 'dimension',
  lineHeight: 'number',
  position: 'number',
  alpha: 'number',
  value: 'number',
};
function fail(code: string, detail = ''): never {
  throw new Error(`${code}|${detail}`);
}
const alias = (value: unknown): string | null =>
  typeof value === 'string' && /^\{[^{}]+\}$/.test(value)
    ? value.slice(1, -1)
    : null;
function pointerKeys(pointer: string): string[] {
  try {
    return decodeURIComponent(pointer.slice(2))
      .split('/')
      .map((key) => {
        if (/~(?![01])/.test(key)) fail('REFERENCE', pointer);
        return key.replace(/~1/g, '/').replace(/~0/g, '~');
      });
  } catch {
    return fail('REFERENCE', pointer);
  }
}
const quote = (text: string): string =>
  '"' +
  Array.from(text, (char) =>
    /["\\<>\u0000-\u001f\u007f]/u.test(char)
      ? `\\${char.codePointAt(0)!.toString(16)} `
      : char,
  ).join('') +
  '"';
const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
]);
const dimension = (v: unknown): string => {
  const item = v as Obj;
  return `${item.value}${item.unit}`;
};
function color(v: unknown): string {
  const value = v as {
    colorSpace: string;
    components: (number | string)[];
    alpha?: number;
  };
  const components = value.components
    .map((c, i) =>
      (value.colorSpace === 'hsl' || value.colorSpace === 'hwb') &&
      i > 0 &&
      c !== 'none'
        ? `${c}%`
        : c,
    )
    .join(' ');
  const body = `${components} / ${value.alpha ?? 1}`;
  return ['hsl', 'hwb', 'lab', 'lch', 'oklab', 'oklch'].includes(
    value.colorSpace,
  )
    ? `${value.colorSpace}(${body})`
    : `color(${value.colorSpace} ${body})`;
}
function cssValue(type: string, value: unknown): string {
  const v = value as Obj;
  switch (type) {
    case 'color':
      return color(value);
    case 'dimension':
    case 'duration':
      return dimension(value);
    case 'number':
      return String(value);
    case 'fontWeight':
      return String(typeof value === 'string' ? WEIGHTS[value] : value);
    case 'fontFamily':
      return (Array.isArray(value) ? value : [value])
        .map((name: string) =>
          GENERIC_FAMILIES.has(name.toLowerCase())
            ? name.toLowerCase()
            : quote(name),
        )
        .join(', ');
    case 'cubicBezier':
      return `cubic-bezier(${(value as number[]).join(', ')})`;
    case 'strokeStyle':
      return String(value);
    case 'border':
      return `${dimension(v.width)} ${v.style} ${color(v.color)}`;
    case 'transition':
      return `${dimension(v.duration)} ${cssValue('cubicBezier', v.timingFunction)} ${dimension(v.delay)}`;
    case 'shadow':
      return (Array.isArray(value) ? value : [value])
        .map(
          (s: Obj) =>
            `${s.inset ? 'inset ' : ''}${dimension(s.offsetX)} ${dimension(s.offsetY)} ${dimension(s.blur)} ${dimension(s.spread)} ${color(s.color)}`,
        )
        .join(', ');
    case 'gradient': {
      const stops = (value as Obj[]).map(
        (s) =>
          `${color(s.color)} ${Math.min(1, Math.max(0, s.position as number)) * 100}%`,
      );
      if (stops.length === 1) stops.push(stops[0]!);
      return `linear-gradient(${stops.join(', ')})`;
    }
    default:
      return '';
  }
}
function checkColors(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(checkColors);
    return;
  }
  if (!isObject(value)) return;
  if (
    typeof value.colorSpace === 'string' &&
    COLOR_SPACES.includes(value.colorSpace)
  ) {
    const space = value.colorSpace;
    (value.components as (number | string)[]).forEach((c, i) => {
      if (c === 'none') return;
      const n = c as number;
      let min = 0;
      let max = 1;
      let exclusive = false;
      if (space === 'hsl' || space === 'hwb') {
        max = i === 0 ? 360 : 100;
        exclusive = i === 0;
      } else if (space === 'lab' || space === 'oklab') {
        min = i === 0 ? 0 : -Infinity;
        max = i === 0 ? (space === 'lab' ? 100 : 1) : Infinity;
      } else if (space === 'lch' || space === 'oklch') {
        max = i === 0 ? (space === 'lch' ? 100 : 1) : i === 1 ? Infinity : 360;
        exclusive = i === 2;
      }
      if (n < min || (exclusive ? n >= max : n > max))
        fail('VALUE', `${space}.components[${i}]`);
    });
  }
  Object.values(value).forEach(checkColors);
}

export async function analyzeDesignTokens(
  text: string,
  prefix = 'token',
): Promise<TokensResult> {
  if (new TextEncoder().encode(text).length > 2 * 1024 * 1024) fail('LIMIT');
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(prefix)) fail('PREFIX');
  let document: unknown;
  try {
    document = JSON.parse(text) as unknown;
  } catch {
    return {
      tokens: [],
      issues: [{ path: '/', code: 'JSON', detail: '' }],
      css: '',
    };
  }
  const { visit } = await import('jsonc-parser');
  const objectKeys: Set<string>[] = [];
  let jsonDepth = 0;
  const enter = () => {
    if (++jsonDepth > 100) fail('LIMIT');
  };
  let duplicate: string | null = null;
  visit(text, {
    onObjectBegin: () => {
      enter();
      objectKeys.push(new Set());
    },
    onObjectProperty: (name) => {
      const keys = objectKeys.at(-1)!;
      if (keys.has(name)) duplicate = name;
      keys.add(name);
    },
    onObjectEnd: () => {
      objectKeys.pop();
      jsonDepth--;
    },
    onArrayBegin: enter,
    onArrayEnd: () => {
      jsonDepth--;
    },
  });
  if (duplicate !== null)
    return {
      tokens: [],
      issues: [{ path: '/', code: 'DUPLICATE', detail: duplicate }],
      css: '',
    };
  const issues: TokenIssue[] = [];
  const add = (path: string, code: string, detail = '') => {
    if (issues.length < 100) issues.push({ path, code, detail });
  };
  const raw = new Map<string, RawToken>();
  let visits = 0;
  function collect(
    value: unknown,
    segments: string[],
    inherited: unknown,
    depth: number,
  ): void {
    if (++visits > 20000 || depth > 48 || raw.size >= 2000) fail('LIMIT');
    const path = segments.join('.');
    if (path.length > 512) fail('LIMIT');
    if (!isObject(value)) {
      add(path, 'STRUCTURE');
      return;
    }
    const token = owns(value, '$value');
    if (!segments.length && token) {
      add('/', 'STRUCTURE');
      return;
    }
    const allowed = token
      ? ['$value', '$type', '$description', '$extensions', '$deprecated']
      : ['$type', '$description', '$extensions', '$deprecated', '$extends'];
    for (const key of Object.keys(value)) {
      if (
        key.startsWith('$') &&
        !allowed.includes(key) &&
        !(key === '$root' && !token)
      )
        add(path, 'UNSUPPORTED', key);
      if (token && !key.startsWith('$')) add(path, 'STRUCTURE', key);
    }
    if (owns(value, '$extends')) add(path, 'UNSUPPORTED', '$extends');
    if (
      owns(value, '$type') &&
      (typeof value.$type !== 'string' || !TYPES.includes(value.$type))
    )
      add(path, 'UNSUPPORTED', String(value.$type));
    if (owns(value, '$description') && typeof value.$description !== 'string')
      add(path, 'STRUCTURE', '$description');
    if (owns(value, '$extensions') && !isObject(value.$extensions))
      add(path, 'STRUCTURE', '$extensions');
    if (
      owns(value, '$deprecated') &&
      typeof value.$deprecated !== 'boolean' &&
      typeof value.$deprecated !== 'string'
    )
      add(path, 'STRUCTURE', '$deprecated');
    if (token) {
      raw.set(path, {
        path,
        value: value.$value,
        type: value.$type,
        inherited,
      });
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith('$') && key !== '$root') continue;
      if (!key || /[{}.]/.test(key)) {
        add([...segments, key].join('.'), 'NAME');
        continue;
      }
      if (key === '$root' && (!isObject(child) || !owns(child, '$value'))) {
        add(path, 'STRUCTURE', '$root');
        continue;
      }
      collect(child, [...segments, key], value.$type ?? inherited, depth + 1);
    }
  }
  collect(document, [], null, 0);
  if (!raw.size) add('/', 'EMPTY');
  const { default: Ajv } = await import('ajv');
  const ajv = new Ajv({ allErrors: false, strict: true });
  const validators = new Map(
    TYPES.map((type) => [
      type,
      ajv.compile({ $ref: `#/definitions/${type}`, definitions: DEFINITIONS }),
    ]),
  );
  const cache = new Map<string, { type: string; value: unknown }>();
  let work = 0;
  function resolveToken(
    path: string,
    stack: string[],
  ): { type: string; value: unknown } {
    if (stack.includes(`token:${path}`)) fail('CYCLE', path);
    const cached = cache.get(path);
    if (cached) return cached;
    const item = raw.get(path);
    if (!item) fail('MISSING', path);
    const next = [...stack, `token:${path}`];
    let target = alias(item.value);
    if (
      isObject(item.value) &&
      typeof item.value.$ref === 'string' &&
      item.value.$ref.startsWith('#/')
    ) {
      const keys = pointerKeys(item.value.$ref);
      if (keys.at(-1) === '$value') target = keys.slice(0, -1).join('.');
    }
    const targetToken = target ? resolveToken(target, next) : null;
    const type = item.type ?? targetToken?.type ?? item.inherited;
    if (typeof type !== 'string' || !validators.has(type)) fail('TYPE', path);
    const value = resolveValue(item.value, type, next, 0);
    const validator = validators.get(type)!;
    if (!validator(value))
      fail(
        'VALUE',
        `${validator.errors?.[0]?.instancePath ?? ''} ${validator.errors?.[0]?.message ?? ''}`,
      );
    checkColors(value);
    const result = { type, value };
    cache.set(path, result);
    return result;
  }
  function resolveValue(
    value: unknown,
    expected: string | null,
    stack: string[],
    depth: number,
  ): unknown {
    if (++work > 100000 || depth > 64 || stack.length > 64) fail('LIMIT');
    const target = alias(value);
    if (target !== null) {
      const result = resolveToken(target, stack);
      if (expected && result.type !== expected)
        fail('TYPE', `${target}: ${result.type} → ${expected}`);
      return result.value;
    }
    if (
      typeof value === 'string' &&
      /[{}]/.test(value) &&
      expected !== 'fontFamily'
    )
      fail('REFERENCE', value);
    if (Array.isArray(value))
      return value.map((v) =>
        resolveValue(
          v,
          expected === 'shadow'
            ? 'shadow'
            : expected === 'cubicBezier'
              ? 'number'
              : expected === 'fontFamily'
                ? 'fontFamily'
                : null,
          stack,
          depth + 1,
        ),
      );
    if (!isObject(value)) return value;
    if (owns(value, '$ref')) {
      if (
        Object.keys(value).length !== 1 ||
        typeof value.$ref !== 'string' ||
        !value.$ref.startsWith('#/')
      )
        fail('REFERENCE', String(value.$ref));
      const pointer = value.$ref;
      if (stack.includes(pointer)) fail('CYCLE', pointer);
      const keys = pointerKeys(pointer);
      let current: unknown = document;
      for (const key of keys) {
        if (Array.isArray(current)) {
          if (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= current.length)
            fail('MISSING', pointer);
          current = current[Number(key)];
        } else if (isObject(current) && owns(current, key))
          current = current[key];
        else fail('MISSING', pointer);
      }
      if (keys.at(-1) === '$value') {
        const tokenPath = keys.slice(0, -1).join('.');
        if (raw.has(tokenPath)) {
          const resolved = resolveToken(tokenPath, [...stack, pointer]);
          if (expected && expected !== resolved.type) fail('TYPE', pointer);
          return resolved.value;
        }
      }
      return resolveValue(current, expected, [...stack, pointer], depth + 1);
    }
    if (expected === 'strokeStyle')
      fail('UNSUPPORTED', 'strokeStyle.dashArray');
    const result: Obj = Object.create(null) as Obj;
    for (const [key, child] of Object.entries(value))
      result[key] = resolveValue(
        child,
        FIELD_TYPES[key] ?? null,
        stack,
        depth + 1,
      );
    return result;
  }
  const tokens: DesignToken[] = [];
  const declarations: string[] = [];
  let outputSize = 0;
  const names = new Set<string>();
  const safeName = (path: string): string =>
    Array.from(path.replaceAll('.', '-'), (c) =>
      /[a-zA-Z0-9_-]/.test(c) ? c : `_${c.codePointAt(0)!.toString(16)}_`,
    ).join('');
  for (const path of raw.keys()) {
    try {
      const { type, value } = resolveToken(path, []);
      const base = `--${prefix}-${safeName(path)}`;
      const entries: [string, string][] =
        type === 'typography'
          ? Object.entries(value as Obj).map(([key, v]) => [
              `${base}-${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`,
              cssValue(FIELD_TYPES[key]!, v),
            ])
          : [[base, cssValue(type, value)]];
      for (const [name] of entries) {
        if (names.has(name)) fail('COLLISION', name);
        names.add(name);
      }
      const lines = entries.map(([name, css]) => `  ${name}: ${css};`);
      outputSize += lines.reduce((sum, line) => sum + line.length, 0);
      if (outputSize > 4 * 1024 * 1024) {
        add(path, 'LIMIT');
        break;
      }
      declarations.push(...lines);
      tokens.push({
        path,
        type,
        css: entries.map(([name, css]) => `${name}: ${css};`).join('\n'),
        color: type === 'color' ? color(value) : null,
        spacing:
          type === 'dimension'
            ? (value as { value: number }).value *
              ((value as Obj).unit === 'rem' ? 16 : 1)
            : null,
      });
    } catch (error) {
      const [code, ...detail] = (error as Error).message.split('|');
      add(path, code ?? 'VALUE', detail.join('|'));
    }
  }
  return {
    tokens,
    issues,
    css: issues.length ? '' : `:root {\n${declarations.join('\n')}\n}\n`,
  };
}
