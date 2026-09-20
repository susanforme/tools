import type { Schema, Type } from 'avsc';
import { base64ToBytes, bytesToBase64 } from './developer-tools';
import {
  checkFormatSize,
  formatOutput,
  parseFormatJson,
  type FormatResult,
} from './format-input';
export type AvroMode =
  | 'schema'
  | 'validate'
  | 'encode'
  | 'decode'
  | 'compatible';
export type AvroRequest = {
  kind: 'avro';
  mode: AvroMode;
  schema: string;
  reader: string;
  input: string;
};
export async function processAvro(request: AvroRequest): Promise<FormatResult> {
  const schema = parseFormatJson(request.schema);
  const { Type } = await import('avsc/etc/browser/avsc-types');
  const writer = Type.forSchema(schema as Schema, {
    wrapUnions: true,
    noAnonymousTypes: true,
  });
  if (request.mode === 'schema')
    return {
      output: formatOutput({
        valid: true,
        schema: writer.schema({ exportAttrs: true }),
      }),
    };
  if (request.mode === 'compatible') {
    const reader = Type.forSchema(parseFormatJson(request.reader) as Schema, {
      wrapUnions: true,
      noAnonymousTypes: true,
    });
    const compatible = (
      read: Type,
      write: Type,
    ): { compatible: boolean; reason?: string } => {
      try {
        read.createResolver(write);
        return { compatible: true };
      } catch (error) {
        return { compatible: false, reason: (error as Error).message };
      }
    };
    return {
      output: formatOutput({
        readerReadsWriter: compatible(reader, writer),
        writerReadsReader: compatible(writer, reader),
      }),
    };
  }
  checkFormatSize(request.input);
  if (request.mode === 'decode') {
    const bytes = base64ToBytes(request.input);
    // 使用 avsc 自己的 Buffer，避免 CDN / Node / 浏览器 polyfill 副本混用。
    const buffer = Type.forSchema('bytes').clone(
      { type: 'Buffer', data: Array.from(bytes) },
      { coerceBuffers: true },
    );
    const value: unknown = writer.fromBuffer(buffer);
    return { output: formatOutput(parseFormatJson(writer.toString(value))) };
  }
  parseFormatJson(request.input);
  const value: unknown = writer.fromString(request.input);
  if (request.mode === 'validate')
    return {
      output: formatOutput({
        valid: writer.isValid(value),
        value: parseFormatJson(writer.toString(value)),
      }),
    };
  const binary = Uint8Array.from(writer.toBuffer(value));
  if (binary.byteLength > 5 * 1024 * 1024) throw new Error('OUTPUT_TOO_LARGE');
  return {
    output: bytesToBase64(binary),
    binary,
    info: formatOutput({ bytes: binary.byteLength }),
  };
}
