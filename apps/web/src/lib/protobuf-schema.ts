import type { Field, Root, Type } from 'protobufjs';
import { isRecord, bytesToBase64 } from './developer-tools';
import { checkFormatSize, formatOutput, parseFormatJson } from './format-input';
import {
  decodeProtocolBytes,
  sourceText,
  type ProtocolSource,
} from './community-protocols';
export type ProtobufRequest = {
  kind: 'protobuf';
  schema: string;
  imports: Array<{ path: string; source: ProtocolSource }>;
  message: string;
  mode: 'inspect' | 'encode' | 'decode';
  input: string;
  encoding: string;
};
export type ProtobufResult = {
  messages: string[];
  output: string;
  binary?: Uint8Array;
};
function localPath(path: string): string {
  if (/^[a-z]+:|^[/\\]/i.test(path)) throw new Error('PROTO_LOCAL_IMPORT');
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (part === '..') {
      if (!parts.pop()) throw new Error('PROTO_LOCAL_IMPORT');
    } else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}
export async function processProtobuf(
  request: ProtobufRequest,
): Promise<ProtobufResult> {
  checkFormatSize(request.schema);
  if (request.imports.length > 30) throw new Error('STRUCTURE_LIMIT');
  const [protobuf, { default: Long }] = await Promise.all([
    import('protobufjs'),
    import('long'),
  ]);
  // CDN 的可选 Long 探测可能失效，显式配置后再生成 message 编解码器。
  protobuf.util.Long = Long;
  protobuf.configure();
  const root = new protobuf.Root();
  const sources = new Map<string, string>([['main.proto', request.schema]]);
  let size = request.schema.length;
  for (const item of request.imports) {
    const path = localPath(item.path),
      text = await sourceText(item.source);
    if (sources.has(path)) throw new Error(`PROTO_DUPLICATE:${path}`);
    size += text.length;
    if (size > 2 * 1024 * 1024) throw new Error('INPUT_TOO_LARGE');
    sources.set(path, text);
  }
  const visited = new Set<string>();
  const load = (path: string): void => {
    if (visited.has(path)) return;
    visited.add(path);
    const source = sources.get(path);
    if (source === undefined) throw new Error(`PROTO_IMPORT:${path}`);
    const parsed = protobuf.parse(source, root, { keepCase: true });
    for (const dependency of [
      ...(parsed.imports ?? []),
      ...(parsed.weakImports ?? []),
    ]) {
      const relative = localPath(
        `${path.slice(0, path.lastIndexOf('/') + 1)}${dependency}`,
      );
      const resolved = sources.has(relative) ? relative : localPath(dependency);
      if (!sources.has(resolved) && protobuf.common.get(dependency)) {
        const common = protobuf.common.get(dependency)!;
        if (!visited.has(dependency)) root.addJSON(common.nested ?? {});
        visited.add(dependency);
        continue;
      }
      load(resolved);
    }
  };
  load('main.proto');
  root.resolveAll();
  const messages: string[] = [];
  const walk = (
    namespace: Root | Type | InstanceType<typeof protobuf.Namespace>,
    depth = 0,
  ): void => {
    if (depth > 100 || messages.length > 1000)
      throw new Error('STRUCTURE_LIMIT');
    for (const child of namespace.nestedArray) {
      if (child instanceof protobuf.Type)
        messages.push(child.fullName.slice(1));
      if (child instanceof protobuf.Namespace) walk(child, depth + 1);
    }
  };
  walk(root);
  if (!messages.length) throw new Error('PROTO_NO_MESSAGES');
  if (request.mode === 'inspect')
    return { messages, output: formatOutput({ messages }) };
  if (!messages.includes(request.message)) throw new Error('PROTO_MESSAGE');
  const type = root.lookupType(request.message);
  if (request.mode === 'decode') {
    const decoded = type.decode(
      decodeProtocolBytes(request.input, request.encoding),
    );
    return {
      messages,
      output: formatOutput(
        type.toObject(decoded, {
          longs: String,
          enums: Number,
          bytes: String,
          json: true,
        }),
      ),
    };
  }
  const input = parseFormatJson(request.input);
  // fromObject 会强制转换值；先检查字段、范围和 oneof，避免静默截断。
  const validate = (
    messageType: Type,
    value: unknown,
    depth = 0,
  ): Record<string, unknown> => {
    if (depth > 100) throw new Error('STRUCTURE_LIMIT');
    if (!isRecord(value)) throw new Error('PROTO_OBJECT');
    for (const key of Object.keys(value))
      if (!messageType.fields[key]) throw new Error(`PROTO_FIELD:${key}`);
    for (const oneof of messageType.oneofsArray)
      if (oneof.oneof.filter((key) => value[key] != null).length > 1)
        throw new Error(`PROTO_ONEOF:${oneof.name}`);
    const scalar = (field: Field, item: unknown): void => {
      if (field.resolvedType instanceof protobuf.Type) {
        validate(field.resolvedType, item, depth + 1);
        return;
      }
      if (field.resolvedType instanceof protobuf.Enum) {
        if (
          typeof item !== 'number' ||
          !Number.isInteger(item) ||
          item < -2147483648 ||
          item > 2147483647
        )
          throw new Error(`PROTO_VALUE:${field.name}`);
        return;
      }
      if (/^(?:u?int|sint|s?fixed)(?:32|64)$/.test(field.type)) {
        const unsigned = /^(?:uint|fixed)/.test(field.type);
        const width = field.type.endsWith('64') ? 64n : 32n;
        if (
          !(typeof item === 'number' && Number.isSafeInteger(item)) &&
          !(
            width === 64n &&
            typeof item === 'string' &&
            /^-?(?:0|[1-9]\d*)$/.test(item)
          )
        )
          throw new Error(`PROTO_INTEGER:${field.name}`);
        const n = BigInt(item as number | string),
          min = unsigned ? 0n : -(1n << (width - 1n)),
          max = (1n << (unsigned ? width : width - 1n)) - 1n;
        if (n < min || n > max) throw new Error(`PROTO_RANGE:${field.name}`);
      } else if (field.type === 'bytes') {
        if (typeof item !== 'string')
          throw new Error(`PROTO_VALUE:${field.name}`);
        if (item) decodeProtocolBytes(item, 'base64');
      } else if (
        (field.type === 'string' && typeof item !== 'string') ||
        (field.type === 'bool' && typeof item !== 'boolean') ||
        (['double', 'float'].includes(field.type) &&
          (typeof item !== 'number' ||
            !Number.isFinite(item) ||
            (field.type === 'float' && !Number.isFinite(Math.fround(item)))))
      )
        throw new Error(`PROTO_VALUE:${field.name}`);
    };
    for (const field of messageType.fieldsArray) {
      const item = value[field.name];
      if (item == null) {
        if (field.required) throw new Error(`PROTO_REQUIRED:${field.name}`);
        continue;
      }
      if (field instanceof protobuf.MapField) {
        if (!isRecord(item)) throw new Error(`PROTO_VALUE:${field.name}`);
        const keyType = field.keyType;
        for (const [key, member] of Object.entries(item)) {
          if (keyType === 'bool' && key !== 'true' && key !== 'false')
            throw new Error(`PROTO_VALUE:${field.name}`);
          if (keyType !== 'string' && keyType !== 'bool') {
            const unsigned = /^(?:uint|fixed)/.test(keyType);
            const width = keyType.endsWith('64') ? 64n : 32n;
            if (!/^-?(?:0|[1-9]\d*)$/.test(key))
              throw new Error(`PROTO_VALUE:${field.name}`);
            const n = BigInt(key),
              min = unsigned ? 0n : -(1n << (width - 1n)),
              max = (1n << (unsigned ? width : width - 1n)) - 1n;
            if (n < min || n > max)
              throw new Error(`PROTO_RANGE:${field.name}`);
          }
          scalar(field, member);
        }
      } else if (field.repeated) {
        if (!Array.isArray(item)) throw new Error(`PROTO_VALUE:${field.name}`);
        for (const member of item) scalar(field, member);
      } else scalar(field, item);
    }
    return value;
  };
  const message = type.fromObject(validate(type, input));
  const error = type.verify(message);
  if (error) throw new Error(error);
  const binary = type.encode(message).finish();
  if (binary.length > 2 * 1024 * 1024) throw new Error('OUTPUT_TOO_LARGE');
  const output =
    request.encoding === 'hex'
      ? Array.from(binary, (byte) => byte.toString(16).padStart(2, '0')).join(
          ' ',
        )
      : bytesToBase64(binary);
  return { messages, output, binary };
}
