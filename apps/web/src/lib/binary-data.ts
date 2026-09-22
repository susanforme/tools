import { decodeProtocolBytes } from './community-protocols';
import { bytesToBase64, isRecord } from './developer-tools';
export type BinaryKind = 'bson' | 'ion';
export async function convertBinaryData(
  kind: BinaryKind,
  direction: string,
  input: string,
  file: Uint8Array | null = null,
) {
  if (input.length > 2_000_000 || (file?.byteLength ?? 0) > 2_000_000)
    throw new Error('输入不能超过 2 MB');
  if (kind === 'bson') {
    const { EJSON, serialize, deserialize } = await import('bson');
    if (direction === 'encode') {
      const value: unknown = EJSON.parse(input, { relaxed: false });
      if (!isRecord(value)) throw new Error('BSON 顶层必须是对象');
      const bytes = new Uint8Array(serialize(value));
      return { text: bytesToBase64(bytes), bytes };
    }
    const bytes = file ?? decodeProtocolBytes(input, 'base64');
    const value = deserialize(bytes, {
      promoteLongs: false,
      promoteValues: false,
      allowObjectSmallerThanBufferSize: false,
    });
    return {
      text: EJSON.stringify(value, null, 2, { relaxed: false }),
      bytes: null,
    };
  }
  const ion = await import('ion-js');
  const source =
    direction === 'encode'
      ? input
      : (file ?? decodeProtocolBytes(input, 'base64'));
  const reader = ion.makeReader(source);
  const writer =
    direction === 'encode' ? ion.makeBinaryWriter() : ion.makePrettyWriter();
  writer.writeValues(reader);
  writer.close();
  const bytes = writer.getBytes();
  return {
    text:
      direction === 'encode'
        ? bytesToBase64(bytes)
        : new TextDecoder().decode(bytes),
    bytes: direction === 'encode' ? bytes : null,
  };
}
