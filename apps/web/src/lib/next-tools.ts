import { bytesToBase64 } from './developer-tools';

function base64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

export async function generatePkce() {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return {
    verifier,
    challenge: base64Url(new Uint8Array(digest)),
    state: base64Url(crypto.getRandomValues(new Uint8Array(24))),
    nonce: base64Url(crypto.getRandomValues(new Uint8Array(24))),
  };
}

export function parseOAuthCallback(input: string): Record<string, string> {
  const url = new URL(input.trim(), 'https://callback.invalid');
  const result: Record<string, string> = {};
  for (const [key, value] of url.searchParams) result[key] = value;
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  for (const [key, value] of fragment) result[key] = value;
  return result;
}

function parseHeaders(input: string): Map<string, string> {
  const headers = new Map<string, string>();
  for (const line of input.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator > 0)
      headers.set(
        line.slice(0, separator).trim().toLowerCase(),
        line.slice(separator + 1).trim(),
      );
  }
  return headers;
}

export type CacheAnalysis = {
  cacheable: boolean;
  directives: Record<string, string | true>;
  freshnessSeconds: number | null;
  remainingSeconds: number | null;
  validators: string[];
  warnings: string[];
};

export function analyzeHttpCache(
  input: string,
  now = Date.now(),
): CacheAnalysis {
  const headers = parseHeaders(input);
  const directives: Record<string, string | true> = {};
  for (const item of (headers.get('cache-control') ?? '').split(',')) {
    const [name, rawValue] = item.trim().split('=', 2);
    if (name)
      directives[name.toLowerCase()] = rawValue?.replace(/^"|"$/g, '') ?? true;
  }
  const numberDirective = (name: string) => {
    const value = directives[name];
    return typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : null;
  };
  const date = Date.parse(headers.get('date') ?? '');
  const expires = Date.parse(headers.get('expires') ?? '');
  const freshnessSeconds =
    numberDirective('s-maxage') ??
    numberDirective('max-age') ??
    (Number.isFinite(date) && Number.isFinite(expires)
      ? Math.max(0, Math.floor((expires - date) / 1000))
      : null);
  const age = Number(headers.get('age') ?? '0');
  const apparentAge = Number.isFinite(date)
    ? Math.max(0, Math.floor((now - date) / 1000))
    : 0;
  const consumed = Math.max(Number.isFinite(age) ? age : 0, apparentAge);
  const warnings: string[] = [];
  if (!headers.has('cache-control') && !headers.has('expires'))
    warnings.push('missingPolicy');
  if (
    directives['no-cache'] &&
    !headers.has('etag') &&
    !headers.has('last-modified')
  )
    warnings.push('missingValidator');
  if (directives.public && headers.has('set-cookie'))
    warnings.push('publicCookie');
  return {
    cacheable: !directives['no-store'],
    directives,
    freshnessSeconds,
    remainingSeconds:
      freshnessSeconds === null
        ? null
        : Math.max(0, freshnessSeconds - consumed),
    validators: ['etag', 'last-modified'].filter((name) => headers.has(name)),
    warnings,
  };
}

export type UnicodeIssue = {
  code: 'bidi' | 'zeroWidth' | 'mixedScript' | 'notNfc' | 'notNfkc';
  detail: string;
};

export function inspectUnicodeSecurity(input: string): UnicodeIssue[] {
  const issues: UnicodeIssue[] = [];
  const bidi = [...input].filter((character) =>
    /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(character),
  );
  const zeroWidth = [...input].filter((character) =>
    /[\u200b-\u200d\u2060\ufeff]/u.test(character),
  );
  if (bidi.length)
    issues.push({ code: 'bidi', detail: bidi.map(codePoint).join(' ') });
  if (zeroWidth.length)
    issues.push({
      code: 'zeroWidth',
      detail: zeroWidth.map(codePoint).join(' '),
    });
  // ponytail: 只检测最常见的同形字脚本；需要全 Unicode 覆盖时接入 UTS #39 数据表。
  const scripts = [
    /[A-Za-z]/u.test(input) ? 'Latin' : '',
    /[\u0370-\u03ff]/u.test(input) ? 'Greek' : '',
    /[\u0400-\u04ff]/u.test(input) ? 'Cyrillic' : '',
  ].filter(Boolean);
  if (scripts.length > 1)
    issues.push({ code: 'mixedScript', detail: scripts.join(' + ') });
  if (input !== input.normalize('NFC'))
    issues.push({ code: 'notNfc', detail: input.normalize('NFC') });
  if (input !== input.normalize('NFKC'))
    issues.push({ code: 'notNfkc', detail: input.normalize('NFKC') });
  return issues;
}

function codePoint(character: string): string {
  return `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;
}

function readSshString(
  bytes: Uint8Array,
  offset: number,
): [Uint8Array, number] {
  if (offset + 4 > bytes.length) throw new Error('INVALID_SSH_KEY');
  const length = new DataView(
    bytes.buffer,
    bytes.byteOffset + offset,
    4,
  ).getUint32(0);
  const start = offset + 4;
  const end = start + length;
  if (end > bytes.length) throw new Error('INVALID_SSH_KEY');
  return [bytes.slice(start, end), end];
}

export type SshKeyInfo = {
  type: string;
  comment: string;
  fingerprint: string;
  bits: number | null;
  curve: string;
};

export async function inspectSshPublicKey(input: string): Promise<SshKeyInfo> {
  const [declaredType, encoded, ...comment] = input.trim().split(/\s+/);
  if (!declaredType || !encoded) throw new Error('INVALID_SSH_KEY');
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const [typeBytes, next] = readSshString(bytes, 0);
  const type = new TextDecoder().decode(typeBytes);
  if (type !== declaredType) throw new Error('SSH_TYPE_MISMATCH');
  let offset = next;
  let bits: number | null = null;
  let curve = '';
  if (type === 'ssh-rsa') {
    [, offset] = readSshString(bytes, offset);
    const [modulus] = readSshString(bytes, offset);
    const first = modulus[0] === 0 ? modulus.slice(1) : modulus;
    bits = first.length * 8 - Math.clz32(first[0]!) + 24;
  } else if (type.startsWith('ecdsa-sha2-')) {
    const [curveBytes] = readSshString(bytes, offset);
    curve = new TextDecoder().decode(curveBytes);
  } else if (type === 'ssh-ed25519') {
    const [key] = readSshString(bytes, offset);
    bits = key.length * 8;
  }
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new Uint8Array(bytes).buffer,
  );
  return {
    type,
    comment: comment.join(' '),
    fingerprint: `SHA256:${base64Url(new Uint8Array(digest))}`,
    bits,
    curve,
  };
}

function readVarint(bytes: Uint8Array, start: number): [bigint, number] {
  let value = 0n;
  let shift = 0n;
  let offset = start;
  while (offset < bytes.length && shift <= 63n) {
    const byte = bytes[offset++]!;
    value |= BigInt(byte & 0x7f) << shift;
    if (!(byte & 0x80)) return [value, offset];
    shift += 7n;
  }
  throw new Error('INVALID_VARINT');
}

export type ProtobufField = {
  field: number;
  wireType: number;
  value: string;
};

export function decodeProtobufWire(bytes: Uint8Array): ProtobufField[] {
  // ponytail: 无 schema 仅展示 wire 字段；需要嵌套消息语义时再加载 .proto 描述符。
  const fields: ProtobufField[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    if (fields.length >= 1000) throw new Error('PROTOBUF_LIMIT');
    const [tag, afterTag] = readVarint(bytes, offset);
    offset = afterTag;
    const wireType = Number(tag & 7n);
    const field = Number(tag >> 3n);
    if (!field || wireType === 3 || wireType === 4 || wireType > 5)
      throw new Error('INVALID_PROTOBUF');
    let value = '';
    if (wireType === 0) {
      const [raw, next] = readVarint(bytes, offset);
      offset = next;
      value = raw.toString();
    } else if (wireType === 1 || wireType === 5) {
      const length = wireType === 1 ? 8 : 4;
      if (offset + length > bytes.length) throw new Error('INVALID_PROTOBUF');
      value = [...bytes.slice(offset, offset + length)].map(hexByte).join('');
      offset += length;
    } else {
      const [lengthValue, next] = readVarint(bytes, offset);
      const length = Number(lengthValue);
      offset = next;
      if (!Number.isSafeInteger(length) || offset + length > bytes.length)
        throw new Error('INVALID_PROTOBUF');
      const data = bytes.slice(offset, offset + length);
      offset += length;
      const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
      value = /^[\x20-\x7e\r\n\t]*$/.test(text)
        ? JSON.stringify(text)
        : [...data].map(hexByte).join('');
    }
    fields.push({ field, wireType, value });
  }
  return fields;
}

function hexByte(value: number): string {
  return value.toString(16).padStart(2, '0');
}

export type DataUriInfo = {
  mimeType: string;
  charset: string;
  base64: boolean;
  size: number;
  bytes: Uint8Array;
  text: string;
};

export function inspectDataUri(input: string): DataUriInfo {
  const match = input.trim().match(/^data:([^,]*),(.*)$/s);
  if (!match) throw new Error('INVALID_DATA_URI');
  const parts = match[1]!.split(';').filter(Boolean);
  const mimeType = parts[0]?.includes('/') ? parts.shift()! : 'text/plain';
  const base64 = parts.some((part) => part.toLowerCase() === 'base64');
  const charset =
    parts.find((part) => part.toLowerCase().startsWith('charset='))?.slice(8) ??
    'US-ASCII';
  const bytes = base64
    ? Uint8Array.from(atob(match[2]!), (character) => character.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(match[2]!));
  const text =
    mimeType.startsWith('text/') || /(?:json|xml|javascript)/.test(mimeType)
      ? new TextDecoder(charset === 'US-ASCII' ? 'utf-8' : charset).decode(
          bytes,
        )
      : '';
  return { mimeType, charset, base64, size: bytes.length, bytes, text };
}

export type HttpLogSummary = {
  requests: number;
  bytes: number;
  statuses: Record<string, number>;
  methods: Record<string, number>;
  paths: Array<{ path: string; count: number }>;
  invalidLines: number;
};

export function analyzeHttpLogs(input: string): HttpLogSummary {
  // ponytail: 当前覆盖 Apache/Nginx Common 与 Combined；自定义 log_format 再加模板解析。
  const statuses: Record<string, number> = {};
  const methods: Record<string, number> = {};
  const paths = new Map<string, number>();
  let requests = 0;
  let bytes = 0;
  let invalidLines = 0;
  for (const line of input.split(/\r?\n/).filter(Boolean)) {
    const match = line.match(
      /^\S+ \S+ \S+ \[[^\]]+\] "(\S+) ([^" ]+)(?: HTTP\/[^"]+)?" (\d{3}) (\d+|-)\b/,
    );
    if (!match) {
      invalidLines += 1;
      continue;
    }
    requests += 1;
    methods[match[1]!] = (methods[match[1]!] ?? 0) + 1;
    statuses[match[3]!] = (statuses[match[3]!] ?? 0) + 1;
    paths.set(match[2]!, (paths.get(match[2]!) ?? 0) + 1);
    if (match[4] !== '-') bytes += Number(match[4]);
  }
  return {
    requests,
    bytes,
    statuses,
    methods,
    paths: [...paths]
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    invalidLines,
  };
}

function rotl(value: number, count: number): number {
  return ((value << count) | (value >>> (32 - count))) >>> 0;
}

export function xxhash32(bytes: Uint8Array, seed = 0): number {
  const p1 = 0x9e3779b1,
    p2 = 0x85ebca77,
    p3 = 0xc2b2ae3d,
    p4 = 0x27d4eb2f,
    p5 = 0x165667b1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let hash: number;
  const round = (acc: number, value: number) =>
    Math.imul(rotl((acc + Math.imul(value, p2)) >>> 0, 13), p1) >>> 0;
  if (bytes.length >= 16) {
    let v1 = (seed + p1 + p2) >>> 0,
      v2 = (seed + p2) >>> 0,
      v3 = seed >>> 0,
      v4 = (seed - p1) >>> 0;
    while (offset <= bytes.length - 16) {
      v1 = round(v1, view.getUint32(offset, true));
      offset += 4;
      v2 = round(v2, view.getUint32(offset, true));
      offset += 4;
      v3 = round(v3, view.getUint32(offset, true));
      offset += 4;
      v4 = round(v4, view.getUint32(offset, true));
      offset += 4;
    }
    hash = (rotl(v1, 1) + rotl(v2, 7) + rotl(v3, 12) + rotl(v4, 18)) >>> 0;
  } else hash = (seed + p5) >>> 0;
  hash = (hash + bytes.length) >>> 0;
  while (offset <= bytes.length - 4) {
    hash =
      Math.imul(
        rotl((hash + Math.imul(view.getUint32(offset, true), p3)) >>> 0, 17),
        p4,
      ) >>> 0;
    offset += 4;
  }
  while (offset < bytes.length) {
    hash =
      Math.imul(
        rotl((hash + Math.imul(bytes[offset++]!, p5)) >>> 0, 11),
        p1,
      ) >>> 0;
  }
  hash ^= hash >>> 15;
  hash = Math.imul(hash, p2) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, p3) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

export function checksums(bytes: Uint8Array) {
  let crc = 0xffffffff;
  let a = 1,
    b = 0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const format = (value: number) => value.toString(16).padStart(8, '0');
  return {
    crc32: format((crc ^ 0xffffffff) >>> 0),
    adler32: format(((b << 16) | a) >>> 0),
    xxhash32: format(xxhash32(bytes)),
  };
}

export type SecurityTxtIssue = { code: string; level: 'error' | 'warning' };

export function inspectSecurityTxt(
  input: string,
  now = Date.now(),
): SecurityTxtIssue[] {
  const fields = new Map<string, string[]>();
  for (const line of input.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const values = fields.get(key) ?? [];
    values.push(line.slice(separator + 1).trim());
    fields.set(key, values);
  }
  const issues: SecurityTxtIssue[] = [];
  if (!fields.has('contact'))
    issues.push({ code: 'missingContact', level: 'error' });
  if (!fields.has('expires'))
    issues.push({ code: 'missingExpires', level: 'error' });
  const expires = Date.parse(fields.get('expires')?.[0] ?? '');
  if (fields.has('expires') && (!Number.isFinite(expires) || expires <= now))
    issues.push({ code: 'invalidExpires', level: 'error' });
  if (
    fields.get('contact')?.some((value) => !/^(?:mailto:|https:)/i.test(value))
  )
    issues.push({ code: 'invalidContact', level: 'warning' });
  if (!fields.has('canonical'))
    issues.push({ code: 'missingCanonical', level: 'warning' });
  return issues;
}
