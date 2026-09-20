import type { Parser as AsyncParser } from '@asyncapi/parser';
import type { CelInput, CelValue } from '@bufbuild/cel';
export type SchemaKind = 'asyncapi' | 'cel' | 'spdx';
export interface SchemaRequest {
  kind: SchemaKind;
  source: string;
  data?: string;
  integers?: boolean;
}
export interface SchemaResult {
  output: string;
  tree?: string;
  valid?: boolean;
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
export async function analyzeAsyncApi(
  source: string,
  parserClass?: typeof AsyncParser,
): Promise<SchemaResult> {
  if (new TextEncoder().encode(source).length > 1024 * 1024)
    throw new Error('LIMIT');
  const { load, JSON_SCHEMA } = await import('js-yaml');
  const data: unknown = load(source, { schema: JSON_SCHEMA });
  if (!object(data) || typeof data.asyncapi !== 'string')
    throw new Error('ASYNC_FORMAT');
  const seen = new WeakSet<object>();
  let count = 0;
  function check(value: unknown, depth: number): void {
    if (++count > 30000 || depth > 64) throw new Error('LIMIT');
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) throw new Error('YAML_ALIAS');
    seen.add(value);
    for (const [key, item] of Object.entries(value)) {
      if (
        ['$ref', '$dynamicRef', '$recursiveRef'].includes(key) &&
        (typeof item !== 'string' || !item.startsWith('#'))
      )
        throw new Error('LOCAL_REFS');
      if (
        ['$id', 'id'].includes(key) &&
        typeof item === 'string' &&
        /^[a-z][\w+.-]*:/i.test(item) &&
        key === '$id'
      )
        throw new Error('SCHEMA_ID');
      check(item, depth + 1);
    }
  }
  check(data, 0);
  const Parser =
    parserClass ?? (await import('@asyncapi/parser/browser/index.js')).default;
  const parser = new Parser({
    __unstable: {
      resolver: {
        resolvers: ['http', 'https', 'file'].map((schema) => ({
          schema,
          order: -100,
          read: () => '{"externalReferencesBlocked":true}',
        })),
      },
    },
  });
  const result = await parser.parse(source);
  const document = result.document;
  const diagnostics = result.diagnostics.slice(0, 200).map((item) => ({
    severity: ['error', 'warning', 'information', 'hint'][item.severity],
    code: item.code,
    message: item.message,
    path: item.path.join('.'),
    line:
      item.range?.start.line === undefined ? null : item.range.start.line + 1,
  }));
  const valid =
    !!document && !result.diagnostics.some((item) => item.severity === 0);
  const output = {
    valid,
    version: document?.version() ?? data.asyncapi,
    title: document?.info().title(),
    channels:
      document?.channels().map((channel) => ({
        id: channel.id(),
        address: channel.address(),
        messages: channel.messages().length,
      })) ?? [],
    operations:
      document?.operations().map((operation) => ({
        action: operation.action(),
        channels: operation.channels().map((channel) => channel.id()),
        messages: operation.messages().length,
      })) ?? [],
    messages: document?.allMessages().length ?? 0,
    diagnostics,
    diagnosticCount: result.diagnostics.length,
  };
  return { valid, output: JSON.stringify(output, null, 2) };
}
export async function evaluateCel(
  source: string,
  data: string,
  integers: boolean,
): Promise<SchemaResult> {
  if (
    new TextEncoder().encode(source).length > 16384 ||
    new TextEncoder().encode(data).length > 262144
  )
    throw new Error('LIMIT');
  const json: unknown = JSON.parse(data);
  if (!object(json)) throw new Error('BINDINGS');
  const cel = await import('@bufbuild/cel');
  let count = 0;
  function input(value: unknown, depth = 0): CelInput {
    if (++count > 20000 || depth > 48) throw new Error('LIMIT');
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean'
    )
      return value;
    if (typeof value === 'number') {
      if (
        !Number.isFinite(value) ||
        (Number.isInteger(value) && !Number.isSafeInteger(value))
      )
        throw new Error('UNSAFE_NUMBER');
      return integers && Number.isInteger(value) ? BigInt(value) : value;
    }
    if (Array.isArray(value)) return value.map((v) => input(v, depth + 1));
    if (object(value))
      return new Map(
        Object.entries(value).map(([k, v]) => [k, input(v, depth + 1)]),
      );
    throw new Error('BINDINGS');
  }
  const bindings = Object.fromEntries(
    Object.entries(json).map(([key, value]) => [key, input(value)]),
  );
  const result = cel.run(source, bindings);
  if (cel.isCelError(result))
    throw new Error(
      `${result.message}${result.exprId === undefined ? '' : ` (expr ${result.exprId})`}`,
    );
  count = 0;
  function output(value: unknown, depth = 0): unknown {
    if (++count > 20000 || depth > 64) throw new Error('LIMIT');
    if (typeof value === 'bigint')
      return { type: 'int', value: value.toString() };
    if (cel.isCelUint(value))
      return { type: 'uint', value: value.value.toString() };
    if (cel.isCelList(value))
      return [...value].map((v) => output(v, depth + 1));
    if (cel.isCelMap(value))
      return {
        type: 'map',
        entries: [...value].map(([k, v]) => [
          output(k, depth + 1),
          output(v, depth + 1),
        ]),
      };
    if (cel.isCelType(value)) return { type: 'type', value: value.name };
    if (value instanceof Uint8Array)
      return {
        type: 'bytes',
        hex: [...value].map((v) => v.toString(16).padStart(2, '0')).join(''),
      };
    if (typeof value === 'number' && !Number.isFinite(value))
      return { type: 'double', value: String(value) };
    if (object(value)) {
      if (object(value.message) && '$typeName' in value.message)
        return output(value.message, depth + 1);
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, output(v, depth + 1)]),
      );
    }
    if (Array.isArray(value)) return value.map((v) => output(v, depth + 1));
    return value;
  }
  const text = JSON.stringify(
    { type: cel.celType(result as CelValue).name, value: output(result) },
    null,
    2,
  );
  if (text.length > 1024 * 1024) throw new Error('LIMIT');
  return { output: text };
}
export async function inspectSpdx(source: string): Promise<SchemaResult> {
  if (source.length > 8192) throw new Error('LIMIT');
  const { default: parse } = await import('spdx-expression-parse');
  const ast = parse(source.trim());
  const licenses = new Set<string>();
  const exceptions = new Set<string>();
  const lines: string[] = [];
  function walk(node: ReturnType<typeof parse>, depth: number): void {
    if (depth > 64 || lines.length > 1000) throw new Error('LIMIT');
    if ('conjunction' in node) {
      lines.push(`${'  '.repeat(depth)}${node.conjunction.toUpperCase()}`);
      walk(node.left, depth + 1);
      walk(node.right, depth + 1);
    } else {
      const label = node.license + (node.plus ? '+' : '');
      licenses.add(label);
      if (node.exception) {
        exceptions.add(node.exception);
        lines.push(
          `${'  '.repeat(depth)}WITH`,
          `${'  '.repeat(depth + 1)}${label}`,
          `${'  '.repeat(depth + 1)}${node.exception}`,
        );
      } else lines.push(`${'  '.repeat(depth)}${label}`);
    }
  }
  walk(ast, 0);
  return {
    valid: true,
    tree: lines.join('\n'),
    output: JSON.stringify(
      { licenses: [...licenses], exceptions: [...exceptions], ast },
      null,
      2,
    ),
  };
}
