export type BinaryFormat = { name: string; mime: string };

export type MimeTypeEntry = {
  extension: string;
  mime: string;
  description: string;
};

// ponytail: 内置常用 Web MIME；需要完整 IANA 数据时再改为生成表。
export const MIME_TYPES: MimeTypeEntry[] = [
  ['html', 'text/html', 'HTML'],
  ['css', 'text/css', 'CSS'],
  ['js,mjs', 'text/javascript', 'JavaScript'],
  ['json,map', 'application/json', 'JSON'],
  ['xml', 'application/xml', 'XML'],
  ['txt,log', 'text/plain', 'Text'],
  ['csv', 'text/csv', 'CSV'],
  ['pdf', 'application/pdf', 'PDF'],
  ['png', 'image/png', 'PNG'],
  ['jpg,jpeg', 'image/jpeg', 'JPEG'],
  ['gif', 'image/gif', 'GIF'],
  ['webp', 'image/webp', 'WebP'],
  ['svg', 'image/svg+xml', 'SVG'],
  ['ico', 'image/x-icon', 'Icon'],
  ['mp3', 'audio/mpeg', 'MP3'],
  ['wav', 'audio/wav', 'WAV'],
  ['mp4', 'video/mp4', 'MP4'],
  ['webm', 'video/webm', 'WebM'],
  ['zip', 'application/zip', 'ZIP'],
  ['gz', 'application/gzip', 'Gzip'],
  ['7z', 'application/x-7z-compressed', '7-Zip'],
  ['wasm', 'application/wasm', 'WebAssembly'],
  ['woff', 'font/woff', 'WOFF'],
  ['woff2', 'font/woff2', 'WOFF2'],
].map(([extension, mime, description]) => ({ extension, mime, description }));

export function findMimeTypes(query: string): MimeTypeEntry[] {
  const value = query.trim().toLowerCase().replace(/^\./, '');
  return MIME_TYPES.filter((entry) =>
    [entry.extension, entry.mime, entry.description.toLowerCase()].some(
      (field) => field.includes(value),
    ),
  );
}

const SIGNATURES: Array<{
  bytes: number[];
  offset?: number;
  format: BinaryFormat;
}> = [
  {
    bytes: [0x89, 0x50, 0x4e, 0x47],
    format: { name: 'PNG', mime: 'image/png' },
  },
  { bytes: [0xff, 0xd8, 0xff], format: { name: 'JPEG', mime: 'image/jpeg' } },
  {
    bytes: [0x47, 0x49, 0x46, 0x38],
    format: { name: 'GIF', mime: 'image/gif' },
  },
  {
    bytes: [0x25, 0x50, 0x44, 0x46],
    format: { name: 'PDF', mime: 'application/pdf' },
  },
  {
    bytes: [0x50, 0x4b, 0x03, 0x04],
    format: { name: 'ZIP', mime: 'application/zip' },
  },
  { bytes: [0x1f, 0x8b], format: { name: 'GZIP', mime: 'application/gzip' } },
  {
    bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c],
    format: { name: '7-Zip', mime: 'application/x-7z-compressed' },
  },
  {
    bytes: [0x7f, 0x45, 0x4c, 0x46],
    format: { name: 'ELF', mime: 'application/x-elf' },
  },
  {
    bytes: [0x4d, 0x5a],
    format: {
      name: 'PE',
      mime: 'application/vnd.microsoft.portable-executable',
    },
  },
  {
    bytes: [0x52, 0x49, 0x46, 0x46],
    format: { name: 'RIFF', mime: 'application/octet-stream' },
  },
];

export function detectBinaryFormat(bytes: Uint8Array): BinaryFormat {
  const match = SIGNATURES.find(({ bytes: signature, offset = 0 }) =>
    signature.every((value, index) => bytes[offset + index] === value),
  );
  if (!match) return { name: 'Unknown', mime: 'application/octet-stream' };
  if (
    match.format.name === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return { name: 'WebP', mime: 'image/webp' };
  }
  return match.format;
}

export function hexDump(
  bytes: Uint8Array,
  columns = 16,
  startOffset = 0,
): string {
  const lines: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += columns) {
    const chunk = bytes.slice(offset, offset + columns);
    const hex = [...chunk]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join(' ')
      .padEnd(columns * 3 - 1);
    const ascii = [...chunk]
      .map((value) =>
        value >= 32 && value <= 126 ? String.fromCharCode(value) : '.',
      )
      .join('');
    lines.push(
      `${(startOffset + offset).toString(16).padStart(8, '0')}  ${hex}  |${ascii}|`,
    );
  }
  return lines.join('\n');
}

export function parseHexPattern(value: string): Uint8Array {
  const compact = value.replace(/0x|[^0-9a-f]/gi, '');
  if (!compact || compact.length % 2 !== 0)
    throw new Error('请输入完整的十六进制字节');
  return Uint8Array.from(compact.match(/.{2}/g) ?? [], (pair) =>
    parseInt(pair, 16),
  );
}

export function findBytes(bytes: Uint8Array, pattern: Uint8Array): number[] {
  const offsets: number[] = [];
  for (let index = 0; index <= bytes.length - pattern.length; index += 1) {
    if (pattern.every((value, offset) => bytes[index + offset] === value))
      offsets.push(index);
  }
  return offsets;
}

export function extractAsciiStrings(bytes: Uint8Array, minimum = 4): string[] {
  return new TextDecoder('ascii')
    .decode(bytes)
    .split(/[^\x20-\x7e]+/)
    .filter((value) => value.length >= minimum);
}

export function readBinaryValue(
  bytes: Uint8Array,
  offset: number,
  type: 'uint16' | 'uint32' | 'int32' | 'float32' | 'float64',
  littleEndian: boolean,
): number {
  const sizes = {
    uint16: 2,
    uint32: 4,
    int32: 4,
    float32: 4,
    float64: 8,
  } as const;
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset + sizes[type] > bytes.length
  ) {
    throw new Error('读取范围超出文件');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === 'uint16') return view.getUint16(offset, littleEndian);
  if (type === 'uint32') return view.getUint32(offset, littleEndian);
  if (type === 'int32') return view.getInt32(offset, littleEndian);
  if (type === 'float32') return view.getFloat32(offset, littleEndian);
  return view.getFloat64(offset, littleEndian);
}
