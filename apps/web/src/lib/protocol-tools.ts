import 'reflect-metadata';
import { pemToJwk, type PublicJwk } from './jwk';

export type TraceContext = {
  version: string;
  traceId: string;
  parentId: string;
  flags: string;
  sampled: boolean;
};

export type TraceStateMember = { key: string; value: string };

export function parseTraceparent(input: string): TraceContext {
  const match = input
    .trim()
    .match(/^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/);
  if (!match || match[1] === 'ff') throw new Error('INVALID_TRACEPARENT');
  if (/^0+$/.test(match[2]) || /^0+$/.test(match[3]))
    throw new Error('ZERO_TRACE_ID');
  return {
    version: match[1],
    traceId: match[2],
    parentId: match[3],
    flags: match[4],
    sampled: (Number.parseInt(match[4], 16) & 1) === 1,
  };
}

export function parseTracestate(input: string): TraceStateMember[] {
  if (!input.trim()) return [];
  const members = input.split(',').map((part) => part.trim());
  if (members.length > 32) throw new Error('TRACESTATE_LIMIT');
  const seen = new Set<string>();
  return members.map((member) => {
    const separator = member.indexOf('=');
    if (separator < 1) throw new Error('INVALID_TRACESTATE');
    const key = member.slice(0, separator);
    const value = member.slice(separator + 1);
    const simpleKey = /^[a-z][_0-9a-z*\-/]{0,255}$/;
    const tenantKey = /^[a-z0-9][_0-9a-z*\-/]{0,240}@[a-z][_0-9a-z*\-/]{0,13}$/;
    const validValue =
      value.length <= 256 &&
      /^[\x20-\x2b\x2d-\x3c\x3e-\x7e]*[\x21-\x2b\x2d-\x3c\x3e-\x7e]$/.test(
        value,
      );
    if ((!simpleKey.test(key) && !tenantKey.test(key)) || !validValue)
      throw new Error('INVALID_TRACESTATE');
    if (seen.has(key)) throw new Error('DUPLICATE_TRACESTATE_KEY');
    seen.add(key);
    return { key, value };
  });
}

export type BaggageProperty = { key: string; value: string | null };
export type BaggageMember = {
  key: string;
  value: string;
  properties: BaggageProperty[];
};

const HTTP_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const BAGGAGE_VALUE = /^[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]*$/;

function decodeBaggageValue(value: string): string {
  if (!BAGGAGE_VALUE.test(value) || /%(?![0-9a-f]{2})/i.test(value))
    throw new Error('INVALID_BAGGAGE_VALUE');
  return decodeURIComponent(value);
}

export function parseBaggage(input: string): BaggageMember[] {
  if (new TextEncoder().encode(input).length > 8192)
    throw new Error('BAGGAGE_SIZE_LIMIT');
  if (!input.trim()) return [];
  const members = input.split(',');
  if (members.length > 64) throw new Error('BAGGAGE_MEMBER_LIMIT');
  return members.map((rawMember) => {
    const [pair, ...rawProperties] = rawMember.split(';');
    const separator = pair.indexOf('=');
    const key = pair.slice(0, separator).trim();
    if (separator < 1 || !HTTP_TOKEN.test(key))
      throw new Error('INVALID_BAGGAGE_KEY');
    const properties = rawProperties.map((rawProperty) => {
      const property = rawProperty.trim();
      const propertySeparator = property.indexOf('=');
      const propertyKey =
        propertySeparator < 0
          ? property
          : property.slice(0, propertySeparator).trim();
      if (!HTTP_TOKEN.test(propertyKey))
        throw new Error('INVALID_BAGGAGE_PROPERTY');
      return {
        key: propertyKey,
        value:
          propertySeparator < 0
            ? null
            : decodeBaggageValue(property.slice(propertySeparator + 1).trim()),
      };
    });
    return {
      key,
      value: decodeBaggageValue(pair.slice(separator + 1).trim()),
      properties,
    };
  });
}

export function serializeBaggage(members: BaggageMember[]): string {
  return members
    .map(({ key, value, properties }) => {
      if (!HTTP_TOKEN.test(key)) throw new Error('INVALID_BAGGAGE_KEY');
      return `${key}=${encodeURIComponent(value)}${properties
        .map((property) => {
          if (!HTTP_TOKEN.test(property.key))
            throw new Error('INVALID_BAGGAGE_PROPERTY');
          return `;${property.key}${
            property.value === null
              ? ''
              : `=${encodeURIComponent(property.value)}`
          }`;
        })
        .join('')}`;
    })
    .join(',');
}

function randomHex(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  if (bytes.every((value) => value === 0)) bytes[0] = 1;
  return [...bytes]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export function generateTraceparent(sampled: boolean): string {
  return `00-${randomHex(16)}-${randomHex(8)}-${sampled ? '01' : '00'}`;
}

export type StackMapping = {
  generated: { line: number; column: number };
  original: { source: string; line: number; column: number; name: string };
};

export async function restoreStackTrace(
  sourceMap: string,
  stack: string,
): Promise<{ stack: string; mappings: StackMapping[] }> {
  const { TraceMap, originalPositionFor } =
    await import('@jridgewell/trace-mapping');
  const map = new TraceMap(
    JSON.parse(sourceMap) as ConstructorParameters<typeof TraceMap>[0],
  );
  const mappings: StackMapping[] = [];
  const restored = stack
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/:(\d+):(\d+)(?=\)?(?:$|\s))/);
      if (!match) return line;
      const generatedLine = Number(match[1]);
      const generatedColumn = Math.max(0, Number(match[2]) - 1);
      const original = originalPositionFor(map, {
        line: generatedLine,
        column: generatedColumn,
      });
      if (original.source === null || original.line === null) return line;
      const item: StackMapping = {
        generated: { line: generatedLine, column: generatedColumn + 1 },
        original: {
          source: original.source,
          line: original.line,
          column: (original.column ?? 0) + 1,
          name: original.name ?? '',
        },
      };
      mappings.push(item);
      return `${line}\n    ↳ ${item.original.source}:${item.original.line}:${item.original.column}${item.original.name ? ` (${item.original.name})` : ''}`;
    })
    .join('\n');
  return { stack: restored, mappings };
}

function jsonSafe(value: unknown): unknown {
  if (value instanceof Map)
    return Object.fromEntries(
      [...value].map(([key, item]) => [String(key), jsonSafe(item)]),
    );
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value instanceof Date)
    return { type: 'date', value: value.toISOString() };
  if (value instanceof ArrayBuffer)
    return {
      type: 'binary',
      value: btoa(String.fromCharCode(...new Uint8Array(value))),
    };
  if (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    typeof Reflect.get(value, 'value') === 'string'
  )
    return {
      type: value.constructor.name,
      value: Reflect.get(value, 'value'),
    };
  return value;
}

export async function parseStructuredField(
  input: string,
  type: 'item' | 'list' | 'dictionary',
): Promise<unknown> {
  const module = await import('structured-headers');
  const parsed =
    type === 'item'
      ? module.parseItem(input)
      : type === 'list'
        ? module.parseList(input)
        : module.parseDictionary(input);
  return jsonSafe(parsed);
}

function parseHeaderBlock(input: string): Map<string, string> {
  const headers = new Map<string, string>();
  for (const line of input.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    headers.set(
      line.slice(0, separator).trim().toLowerCase(),
      line.slice(separator + 1).trim(),
    );
  }
  return headers;
}

export type RateLimitInfo = {
  limit: number | null;
  remaining: number | null;
  waitSeconds: number | null;
  resetAt: string;
  source: string;
};

function numberHeader(
  headers: Map<string, string>,
  name: string,
): number | null {
  const value = Number(headers.get(name));
  return Number.isFinite(value) ? value : null;
}

export function analyzeRateLimitHeaders(
  input: string,
  now = Date.now(),
): RateLimitInfo {
  const headers = parseHeaderBlock(input);
  const standard = headers.get('ratelimit') ?? '';
  const remainingMatch = standard.match(/(?:^|;)\s*r=(\d+)/i);
  const waitMatch = standard.match(/(?:^|;)\s*t=(\d+)/i);
  let remaining = remainingMatch ? Number(remainingMatch[1]) : null;
  let limit: number | null = null;
  let waitSeconds = waitMatch ? Number(waitMatch[1]) : null;
  let source = standard ? 'RateLimit' : '';
  const policy = headers.get('ratelimit-policy') ?? '';
  const quotaMatch = policy.match(/(?:^|;)\s*q=(\d+)/i);
  if (quotaMatch) limit = Number(quotaMatch[1]);
  if (!standard) {
    limit =
      numberHeader(headers, 'x-ratelimit-limit') ??
      numberHeader(headers, 'ratelimit-limit');
    remaining =
      numberHeader(headers, 'x-ratelimit-remaining') ??
      numberHeader(headers, 'ratelimit-remaining');
    const reset =
      numberHeader(headers, 'x-ratelimit-reset') ??
      numberHeader(headers, 'ratelimit-reset');
    if (reset !== null)
      waitSeconds =
        reset > 1_000_000_000 ? Math.max(0, reset - now / 1000) : reset;
    source = limit !== null || remaining !== null ? 'Legacy RateLimit' : '';
  }
  const retryAfter = headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const retrySeconds = Number.isFinite(seconds)
      ? seconds
      : Math.max(0, (Date.parse(retryAfter) - now) / 1000);
    if (Number.isFinite(retrySeconds)) waitSeconds = Math.ceil(retrySeconds);
    source = source ? `${source} + Retry-After` : 'Retry-After';
  }
  return {
    limit,
    remaining,
    waitSeconds:
      waitSeconds === null ? null : Math.max(0, Math.ceil(waitSeconds)),
    resetAt:
      waitSeconds === null
        ? ''
        : new Date(now + Math.max(0, waitSeconds) * 1000).toISOString(),
    source: source || 'none',
  };
}

export type ContentDispositionInfo = {
  disposition: string;
  filename: string;
  filenameFallback: string;
  parameters: Record<string, string>;
};

function splitHeaderParameters(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quoted = false;
  let escaped = false;
  for (const character of input) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === '\\' && quoted) {
      current += character;
      escaped = true;
    } else if (character === '"') {
      current += character;
      quoted = !quoted;
    } else if (character === ';' && !quoted) {
      parts.push(current.trim());
      current = '';
    } else current += character;
  }
  parts.push(current.trim());
  return parts;
}

function unquote(value: string): string {
  return value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1).replace(/\\(["\\])/g, '$1')
    : value;
}

export function parseContentDisposition(input: string): ContentDispositionInfo {
  const value = input.replace(/^content-disposition\s*:/i, '').trim();
  const [disposition, ...rawParameters] = splitHeaderParameters(value);
  if (!/^(?:inline|attachment|form-data)$/i.test(disposition ?? ''))
    throw new Error('INVALID_CONTENT_DISPOSITION');
  const parameters: Record<string, string> = {};
  for (const raw of rawParameters) {
    const separator = raw.indexOf('=');
    if (separator < 1) throw new Error('INVALID_CONTENT_DISPOSITION');
    parameters[raw.slice(0, separator).trim().toLowerCase()] = unquote(
      raw.slice(separator + 1).trim(),
    );
  }
  let filename = parameters.filename ?? '';
  if (parameters['filename*']) {
    const match = parameters['filename*'].match(/^UTF-8''(.+)$/i);
    if (!match) throw new Error('UNSUPPORTED_FILENAME_ENCODING');
    filename = decodeURIComponent(match[1]);
  }
  return {
    disposition: disposition.toLowerCase(),
    filename,
    filenameFallback: parameters.filename ?? '',
    parameters,
  };
}

export function buildContentDisposition(
  filename: string,
  disposition: 'attachment' | 'inline',
): string {
  if (!filename.trim()) throw new Error('MISSING_FILENAME');
  const fallback = filename
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}

export type MultipartPart = {
  name: string;
  filename: string;
  contentType: string;
  size: number;
  headers: Record<string, string>;
  preview: string;
};

export function inspectMultipart(
  input: string,
  boundaryInput: string,
): MultipartPart[] {
  const boundary = boundaryInput
    .trim()
    .replace(/^.*boundary=(?:"([^"]+)"|([^;\s]+)).*$/i, '$1$2');
  if (!boundary || boundary.length > 200) throw new Error('INVALID_BOUNDARY');
  const delimiter = `--${boundary}`;
  const chunks = input.split(delimiter).slice(1);
  const parts: MultipartPart[] = [];
  for (let chunk of chunks) {
    if (chunk.startsWith('--')) break;
    chunk = chunk.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
    if (!chunk) continue;
    const separator = chunk.search(/\r?\n\r?\n/);
    if (separator < 0) throw new Error('INVALID_MULTIPART_PART');
    const headerText = chunk.slice(0, separator);
    const body = chunk.slice(separator).replace(/^\r?\n\r?\n/, '');
    const headers = Object.fromEntries(parseHeaderBlock(headerText));
    const disposition = headers['content-disposition']
      ? parseContentDisposition(headers['content-disposition'])
      : null;
    parts.push({
      name: disposition?.parameters.name ?? '',
      filename: disposition?.filename ?? '',
      contentType: headers['content-type'] ?? 'text/plain',
      size: new TextEncoder().encode(body).length,
      headers,
      preview: body.slice(0, 500),
    });
  }
  if (!parts.length) throw new Error('NO_MULTIPART_PARTS');
  return parts;
}

function publicJwkMatches(left: PublicJwk, right: PublicJwk): boolean {
  if (left.kty !== right.kty) return false;
  if (left.kty === 'RSA') return left.n === right.n && left.e === right.e;
  return left.crv === right.crv && left.x === right.x && left.y === right.y;
}

export async function matchCertificateKey(
  certificateOrRequest: string,
  privateKey: string,
): Promise<{ matches: boolean; type: string; publicJwk: PublicJwk }> {
  const x509 = await import('@peculiar/x509');
  const container = certificateOrRequest.includes('CERTIFICATE REQUEST')
    ? new x509.Pkcs10CertificateRequest(certificateOrRequest)
    : new x509.X509Certificate(certificateOrRequest);
  const publicKey = await container.publicKey.export();
  const publicJwk = (await crypto.subtle.exportKey(
    'jwk',
    publicKey,
  )) as PublicJwk;
  const privateJwk = await pemToJwk(privateKey);
  return {
    matches: publicJwkMatches(publicJwk, privateJwk),
    type: publicJwk.kty ?? '',
    publicJwk,
  };
}

const DNS_TYPES = new Set([
  'A',
  'AAAA',
  'CAA',
  'CNAME',
  'MX',
  'NAPTR',
  'NS',
  'PTR',
  'SOA',
  'SRV',
  'TXT',
]);

export type ZoneRecord = {
  line: number;
  owner: string;
  ttl: number | null;
  type: string;
  value: string;
};

export type ZoneIssue = { line: number; code: string; detail: string };

function stripZoneComment(line: string): string {
  let quoted = false;
  let escaped = false;
  let output = '';
  for (const character of line) {
    if (escaped) {
      output += character;
      escaped = false;
    } else if (character === '\\') {
      output += character;
      escaped = true;
    } else if (character === '"') {
      quoted = !quoted;
      output += character;
    } else if (character === ';' && !quoted) break;
    else output += character;
  }
  return output;
}

export function inspectDnsZone(input: string): {
  records: ZoneRecord[];
  issues: ZoneIssue[];
} {
  // ponytail: 支持常用主文件语法；遇到 $INCLUDE 时应由权威 DNS 解析器展开。
  const records: ZoneRecord[] = [];
  const issues: ZoneIssue[] = [];
  const lines = input.split(/\r?\n/);
  let previousOwner = '@';
  let logical = '';
  let logicalLine = 0;
  let depth = 0;
  const process = (source: string, line: number, omittedOwner: boolean) => {
    const trimmed = source.replace(/[()]/g, ' ').trim();
    if (!trimmed || trimmed.startsWith('$ORIGIN') || trimmed.startsWith('$TTL'))
      return;
    if (trimmed.startsWith('$')) {
      issues.push({ line, code: 'unsupportedDirective', detail: trimmed });
      return;
    }
    const tokens = trimmed.match(/"(?:\\.|[^"])*"|\S+/g) ?? [];
    let index = 0;
    let owner = previousOwner;
    if (
      !omittedOwner &&
      tokens[0] &&
      !/^\d+$/.test(tokens[0]) &&
      tokens[0].toUpperCase() !== 'IN' &&
      !DNS_TYPES.has(tokens[0].toUpperCase())
    )
      owner = tokens[index++]!;
    let ttl: number | null = null;
    if (/^\d+$/.test(tokens[index] ?? '')) ttl = Number(tokens[index++]);
    if ((tokens[index] ?? '').toUpperCase() === 'IN') index += 1;
    const type = (tokens[index++] ?? '').toUpperCase();
    if (!DNS_TYPES.has(type)) {
      issues.push({ line, code: 'unknownType', detail: type || trimmed });
      return;
    }
    const value = tokens.slice(index).join(' ');
    if (!value) issues.push({ line, code: 'missingValue', detail: type });
    previousOwner = owner;
    records.push({ line, owner, ttl, type, value });
  };
  lines.forEach((raw, index) => {
    const clean = stripZoneComment(raw);
    if (!logical) logicalLine = index + 1;
    logical += `${logical ? ' ' : ''}${clean}`;
    depth +=
      (clean.match(/\(/g)?.length ?? 0) - (clean.match(/\)/g)?.length ?? 0);
    if (depth <= 0) {
      process(logical, logicalLine, /^\s/.test(raw));
      logical = '';
      depth = 0;
    }
  });
  if (logical.trim())
    issues.push({ line: logicalLine, code: 'unclosedGroup', detail: logical });
  const soa = records.filter((record) => record.type === 'SOA');
  if (soa.length !== 1)
    issues.push({
      line: soa[0]?.line ?? 0,
      code: 'soaCount',
      detail: String(soa.length),
    });
  if (!records.some((record) => record.type === 'NS'))
    issues.push({ line: 0, code: 'missingNs', detail: '' });
  const recordsByOwner = new Map<string, ZoneRecord[]>();
  for (const record of records)
    recordsByOwner.set(record.owner, [
      ...(recordsByOwner.get(record.owner) ?? []),
      record,
    ]);
  for (const [owner, ownerRecords] of recordsByOwner) {
    if (
      ownerRecords.some((record) => record.type === 'CNAME') &&
      ownerRecords.length > 1
    )
      issues.push({
        line: ownerRecords[0]!.line,
        code: 'cnameConflict',
        detail: owner,
      });
  }
  for (const record of records.filter((item) => item.type === 'MX')) {
    if (!/^\d+\s+\S+/.test(record.value))
      issues.push({
        line: record.line,
        code: 'invalidMx',
        detail: record.value,
      });
  }
  return { records, issues };
}

export type EmailPolicyReport = {
  spfLookups: number;
  spfIssues: string[];
  dmarc: Record<string, string>;
  dmarcIssues: string[];
};

export function inspectEmailPolicies(
  spf: string,
  dmarc: string,
): EmailPolicyReport {
  const spfTerms = spf.trim().split(/\s+/).filter(Boolean);
  const lookupTerms = spfTerms.filter((term) =>
    /^[+?~-]?(?:include:|a(?::|$)|mx(?::|$)|ptr(?::|$)|exists:)/i.test(term),
  );
  if (spfTerms.some((term) => /^redirect=/i.test(term)))
    lookupTerms.push('redirect');
  const spfIssues: string[] = [];
  if (spfTerms[0]?.toLowerCase() !== 'v=spf1')
    spfIssues.push('missingSpfVersion');
  if (lookupTerms.length > 10) spfIssues.push('tooManySpfLookups');
  if (!spfTerms.some((term) => /^[+?~-]all$/i.test(term)))
    spfIssues.push('missingAll');
  const tags = Object.fromEntries(
    dmarc
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        return [
          part.slice(0, separator).toLowerCase(),
          part.slice(separator + 1),
        ];
      }),
  );
  const dmarcIssues: string[] = [];
  if (tags.v?.toUpperCase() !== 'DMARC1')
    dmarcIssues.push('missingDmarcVersion');
  if (!['none', 'quarantine', 'reject'].includes(tags.p ?? ''))
    dmarcIssues.push('invalidDmarcPolicy');
  if (tags.pct && (!/^\d+$/.test(tags.pct) || Number(tags.pct) > 100))
    dmarcIssues.push('invalidDmarcPercent');
  return {
    spfLookups: lookupTerms.length,
    spfIssues,
    dmarc: tags,
    dmarcIssues,
  };
}

export function buildEmailPolicies(options: {
  domains: string[];
  includeMx: boolean;
  policy: 'none' | 'quarantine' | 'reject';
  rua: string;
}): { spf: string; dmarc: string } {
  const spf = [
    'v=spf1',
    options.includeMx ? 'mx' : '',
    ...options.domains.map((domain) => `include:${domain}`),
    '-all',
  ]
    .filter(Boolean)
    .join(' ');
  const dmarc = [
    'v=DMARC1',
    `p=${options.policy}`,
    options.rua ? `rua=mailto:${options.rua.replace(/^mailto:/i, '')}` : '',
    'adkim=s',
    'aspf=s',
  ]
    .filter(Boolean)
    .join('; ');
  return { spf, dmarc };
}

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let output = '';
  while (value > 0n) {
    output = BASE58_ALPHABET[Number(value % 58n)] + output;
    value /= 58n;
  }
  const zeros = bytes.findIndex((byte) => byte !== 0);
  const leading = zeros < 0 ? bytes.length : zeros;
  return '1'.repeat(leading) + output;
}

export function base58Decode(input: string): Uint8Array {
  let value = 0n;
  for (const character of input.trim()) {
    const digit = BASE58_ALPHABET.indexOf(character);
    if (digit < 0) throw new Error('INVALID_BASE58');
    value = value * 58n + BigInt(digit);
  }
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value & 255n));
    value >>= 8n;
  }
  const leading = input.match(/^1*/)?.[0].length ?? 0;
  return Uint8Array.from([...Array<number>(leading).fill(0), ...bytes]);
}

export function ascii85Encode(bytes: Uint8Array): string {
  let output = '';
  for (let offset = 0; offset < bytes.length; offset += 4) {
    const size = Math.min(4, bytes.length - offset);
    let value = 0;
    for (let index = 0; index < 4; index += 1)
      value = value * 256 + (bytes[offset + index] ?? 0);
    if (size === 4 && value === 0) {
      output += 'z';
      continue;
    }
    let group = '';
    for (let index = 0; index < 5; index += 1) {
      group = String.fromCharCode((value % 85) + 33) + group;
      value = Math.floor(value / 85);
    }
    output += group.slice(0, size + 1);
  }
  return output;
}

export function ascii85Decode(input: string): Uint8Array {
  const clean = input
    .trim()
    .replace(/^<~/, '')
    .replace(/~>$/, '')
    .replace(/\s/g, '');
  const output: number[] = [];
  let group = '';
  const flush = (final: boolean) => {
    if (!group) return;
    if (final && group.length === 1) throw new Error('INVALID_ASCII85');
    const originalLength = group.length;
    group = group.padEnd(5, 'u');
    let value = 0;
    for (const character of group) {
      const digit = character.charCodeAt(0) - 33;
      if (digit < 0 || digit > 84) throw new Error('INVALID_ASCII85');
      value = value * 85 + digit;
    }
    const bytes = [
      Math.floor(value / 256 ** 3) & 255,
      Math.floor(value / 256 ** 2) & 255,
      Math.floor(value / 256) & 255,
      value & 255,
    ];
    output.push(...bytes.slice(0, final ? originalLength - 1 : 4));
    group = '';
  };
  for (const character of clean) {
    if (character === 'z') {
      if (group) throw new Error('INVALID_ASCII85');
      output.push(0, 0, 0, 0);
    } else {
      group += character;
      if (group.length === 5) flush(false);
    }
  }
  flush(true);
  return Uint8Array.from(output);
}

const BECH32_ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Polymod(values: number[]): number {
  const generators = [
    0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3,
  ];
  let checksum = 1;
  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    generators.forEach((generator, index) => {
      if ((top >>> index) & 1) checksum ^= generator;
    });
  }
  return checksum >>> 0;
}

function expandHrp(hrp: string): number[] {
  return [
    ...[...hrp].map((character) => character.charCodeAt(0) >>> 5),
    0,
    ...[...hrp].map((character) => character.charCodeAt(0) & 31),
  ];
}

function convertBits(
  data: number[],
  from: number,
  to: number,
  pad: boolean,
): number[] {
  let accumulator = 0;
  let bits = 0;
  const result: number[] = [];
  const maxValue = (1 << to) - 1;
  for (const value of data) {
    if (value < 0 || value >> from) throw new Error('INVALID_BECH32_DATA');
    accumulator = (accumulator << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      result.push((accumulator >> bits) & maxValue);
    }
  }
  if (pad && bits) result.push((accumulator << (to - bits)) & maxValue);
  if (!pad && (bits >= from || (accumulator << (to - bits)) & maxValue))
    throw new Error('INVALID_BECH32_PADDING');
  return result;
}

export function bech32Encode(hrp: string, bytes: Uint8Array): string {
  const normalized = hrp.trim().toLowerCase();
  if (!/^[!-~]{1,83}$/.test(normalized)) throw new Error('INVALID_BECH32_HRP');
  const data = convertBits([...bytes], 8, 5, true);
  const values = [...expandHrp(normalized), ...data, 0, 0, 0, 0, 0, 0];
  const polymod = bech32Polymod(values) ^ 1;
  const checksum = Array.from(
    { length: 6 },
    (_, index) => (polymod >>> (5 * (5 - index))) & 31,
  );
  return `${normalized}1${[...data, ...checksum].map((value) => BECH32_ALPHABET[value]).join('')}`;
}

export function bech32Decode(input: string): {
  hrp: string;
  bytes: Uint8Array;
} {
  const value = input.trim();
  if (value !== value.toLowerCase() && value !== value.toUpperCase())
    throw new Error('MIXED_CASE_BECH32');
  const normalized = value.toLowerCase();
  const separator = normalized.lastIndexOf('1');
  if (
    separator < 1 ||
    separator + 7 > normalized.length ||
    normalized.length > 90
  )
    throw new Error('INVALID_BECH32');
  const hrp = normalized.slice(0, separator);
  const data = [...normalized.slice(separator + 1)].map((character) => {
    const index = BECH32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('INVALID_BECH32');
    return index;
  });
  if (bech32Polymod([...expandHrp(hrp), ...data]) !== 1)
    throw new Error('INVALID_BECH32_CHECKSUM');
  return {
    hrp,
    bytes: Uint8Array.from(convertBits(data.slice(0, -6), 5, 8, false)),
  };
}

export type SnowflakeInfo = {
  id: string;
  timestamp: string;
  timestampMs: number;
  node: number;
  datacenter: number;
  worker: number;
  sequence: number;
};

export function decodeSnowflake(input: string, epoch: number): SnowflakeInfo {
  if (!/^\d+$/.test(input.trim())) throw new Error('INVALID_SNOWFLAKE');
  const id = BigInt(input.trim());
  const timestampMs = Number(id >> 22n) + epoch;
  if (!Number.isSafeInteger(timestampMs)) throw new Error('SNOWFLAKE_RANGE');
  const node = Number((id >> 12n) & 0x3ffn);
  return {
    id: id.toString(),
    timestamp: new Date(timestampMs).toISOString(),
    timestampMs,
    node,
    datacenter: node >> 5,
    worker: node & 31,
    sequence: Number(id & 0xfffn),
  };
}

export function generateSnowflake(
  epoch: number,
  node: number,
  sequence: number,
): string {
  if (node < 0 || node > 1023 || sequence < 0 || sequence > 4095)
    throw new Error('INVALID_SNOWFLAKE_PART');
  const timestamp = BigInt(Date.now() - epoch);
  if (timestamp < 0n) throw new Error('INVALID_SNOWFLAKE_EPOCH');
  return (
    (timestamp << 22n) |
    (BigInt(node) << 12n) |
    BigInt(sequence)
  ).toString();
}

function parseLogfmtLine(
  line: string,
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  const pattern = /([^\s=]+)=("(?:\\.|[^"])*"|[^\s]*)/g;
  for (const match of line.matchAll(pattern)) {
    let value = match[2];
    if (value.startsWith('"')) value = JSON.parse(value) as string;
    if (/^-?\d+(?:\.\d+)?$/.test(value)) result[match[1]] = Number(value);
    else if (/^(?:true|false)$/.test(value))
      result[match[1]] = value === 'true';
    else result[match[1]] = value;
  }
  if (!Object.keys(result).length) throw new Error('INVALID_LOGFMT');
  return result;
}

function parseSyslogLine(line: string): Record<string, string | number> {
  const priorityMatch = line.match(/^<(\d{1,3})>(.*)$/);
  if (!priorityMatch || Number(priorityMatch[1]) > 191)
    throw new Error('INVALID_SYSLOG');
  const priority = Number(priorityMatch[1]);
  const body = priorityMatch[2];
  const modern = body.match(/^(\d+) (\S+) (\S+) (\S+) (\S+) (\S+) (.+)$/);
  if (modern) {
    return {
      priority,
      facility: Math.floor(priority / 8),
      severity: priority % 8,
      version: Number(modern[1]),
      timestamp: modern[2],
      hostname: modern[3],
      app: modern[4],
      processId: modern[5],
      messageId: modern[6],
      message: modern[7],
    };
  }
  const legacy = body.match(
    /^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.+)$/,
  );
  if (!legacy) throw new Error('INVALID_SYSLOG');
  return {
    priority,
    facility: Math.floor(priority / 8),
    severity: priority % 8,
    timestamp: legacy[1],
    hostname: legacy[2],
    message: legacy[3],
  };
}

export function parseStructuredLogs(
  input: string,
  type: 'logfmt' | 'syslog',
): Array<Record<string, string | number | boolean>> {
  return input
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) =>
      type === 'logfmt' ? parseLogfmtLine(line) : parseSyslogLine(line),
    );
}

export function intlPreview(options: {
  locale: string;
  currency: string;
  number: number;
  date: Date;
}): Record<string, string> {
  const locale = Intl.getCanonicalLocales(options.locale)[0];
  if (!locale) throw new Error('INVALID_LOCALE');
  return {
    number: new Intl.NumberFormat(locale).format(options.number),
    currency: new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: options.currency,
    }).format(options.number),
    date: new Intl.DateTimeFormat(locale, {
      dateStyle: 'full',
      timeStyle: 'long',
    }).format(options.date),
    pluralCardinal: new Intl.PluralRules(locale).select(options.number),
    pluralOrdinal: new Intl.PluralRules(locale, { type: 'ordinal' }).select(
      options.number,
    ),
    relative: new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      Math.trunc(options.number),
      'day',
    ),
  };
}

export type MarkupMatch = { path: string; text: string };

function nodePath(node: Node): string {
  const parts: string[] = [];
  let current: Node | null = node;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const element = current as Element;
    const siblings = element.parentElement
      ? [...element.parentElement.children].filter(
          (item) => item.tagName === element.tagName,
        )
      : [];
    const index = siblings.indexOf(element);
    parts.unshift(
      `${element.tagName.toLowerCase()}${siblings.length > 1 ? `[${index + 1}]` : ''}`,
    );
    current = element.parentNode;
  }
  return `/${parts.join('/')}`;
}

export function queryMarkup(
  input: string,
  query: string,
  type: 'selector' | 'xpath',
): MarkupMatch[] {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(
    input,
    type === 'selector' ? 'text/html' : 'application/xml',
  );
  const parserError = documentNode.querySelector('parsererror');
  if (parserError) throw new Error(parserError.textContent ?? 'INVALID_MARKUP');
  const nodes: Node[] = [];
  if (type === 'selector') nodes.push(...documentNode.querySelectorAll(query));
  else {
    const result = documentNode.evaluate(
      query,
      documentNode,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    );
    for (let index = 0; index < result.snapshotLength; index += 1) {
      const node = result.snapshotItem(index);
      if (node) nodes.push(node);
    }
  }
  return nodes.slice(0, 500).map((node) => ({
    path: nodePath(
      node.nodeType === Node.ELEMENT_NODE ? node : (node.parentNode ?? node),
    ),
    text: (node.textContent ?? '').trim().slice(0, 500),
  }));
}

export type HreflangEntry = { locale: string; url: string };

export function parseHreflangEntries(input: string): {
  entries: HreflangEntry[];
  issues: string[];
} {
  const entries = input
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const [locale = '', ...urlParts] = line.trim().split(/\s+/);
      return { locale, url: urlParts.join(' ') };
    });
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!/^(?:[a-z]{2,3}(?:-[a-z0-9]{2,8})*|x-default)$/i.test(entry.locale))
      issues.push(`invalidLocale:${entry.locale}`);
    try {
      const url = new URL(entry.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
      issues.push(`invalidUrl:${entry.url}`);
    }
    const locale = entry.locale.toLowerCase();
    if (seen.has(locale)) issues.push(`duplicateLocale:${entry.locale}`);
    seen.add(locale);
  }
  if (!entries.length) issues.push('missingEntries');
  return { entries, issues };
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function generateHreflang(
  entries: HreflangEntry[],
  format: 'html' | 'header' | 'sitemap',
): string {
  if (format === 'html')
    return entries
      .map(
        (entry) =>
          `<link rel="alternate" hreflang="${escapeXml(entry.locale)}" href="${escapeXml(entry.url)}">`,
      )
      .join('\n');
  if (format === 'header')
    return `Link: ${entries.map((entry) => `<${entry.url}>; rel="alternate"; hreflang="${entry.locale}"`).join(',\n      ')}`;
  const links = entries
    .map(
      (entry) =>
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(entry.locale)}" href="${escapeXml(entry.url)}"/>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.map((entry) => `  <url>\n    <loc>${escapeXml(entry.url)}</loc>\n${links}\n  </url>`).join('\n')}\n</urlset>`;
}

type JsonSchema = Record<string, unknown>;

function resolveLocalRef(root: JsonSchema, reference: string): JsonSchema {
  if (!reference.startsWith('#/')) throw new Error('REMOTE_REF_UNSUPPORTED');
  const value = reference
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce<unknown>(
      (current, part) =>
        typeof current === 'object' && current !== null
          ? Reflect.get(current, part)
          : undefined,
      root,
    );
  if (typeof value !== 'object' || value === null)
    throw new Error('INVALID_REF');
  return value as JsonSchema;
}

function schemaExample(
  schema: JsonSchema,
  root: JsonSchema,
  depth: number,
): unknown {
  if (depth > 20) throw new Error('SCHEMA_DEPTH_LIMIT');
  if (typeof schema.$ref === 'string')
    return schemaExample(resolveLocalRef(root, schema.$ref), root, depth + 1);
  if ('const' in schema) return schema.const;
  if ('default' in schema) return schema.default;
  if (Array.isArray(schema.examples) && schema.examples.length)
    return schema.examples[0];
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  for (const choice of ['oneOf', 'anyOf'] as const) {
    const options = schema[choice];
    if (Array.isArray(options) && options[0] && typeof options[0] === 'object')
      return schemaExample(options[0] as JsonSchema, root, depth + 1);
  }
  if (Array.isArray(schema.allOf)) {
    return Object.assign(
      {},
      ...schema.allOf
        .filter(
          (item): item is JsonSchema =>
            typeof item === 'object' && item !== null,
        )
        .map((item) => schemaExample(item, root, depth + 1)),
    );
  }
  const inferredType =
    typeof schema.type === 'string'
      ? schema.type
      : schema.properties
        ? 'object'
        : schema.items
          ? 'array'
          : 'string';
  if (inferredType === 'object') {
    const properties =
      typeof schema.properties === 'object' && schema.properties !== null
        ? (schema.properties as Record<string, unknown>)
        : {};
    return Object.fromEntries(
      Object.entries(properties)
        .filter(
          (entry): entry is [string, JsonSchema] =>
            typeof entry[1] === 'object' && entry[1] !== null,
        )
        .map(([key, value]) => [key, schemaExample(value, root, depth + 1)]),
    );
  }
  if (inferredType === 'array') {
    const item =
      typeof schema.items === 'object' && schema.items !== null
        ? (schema.items as JsonSchema)
        : {};
    const count = Math.max(1, Math.min(Number(schema.minItems) || 1, 10));
    return Array.from({ length: count }, () =>
      schemaExample(item, root, depth + 1),
    );
  }
  if (inferredType === 'boolean') return true;
  if (inferredType === 'integer') return Math.ceil(Number(schema.minimum) || 0);
  if (inferredType === 'number') return Number(schema.minimum) || 0;
  if (inferredType === 'null') return null;
  const formats: Record<string, string> = {
    date: '2026-08-10',
    'date-time': '2026-08-10T12:00:00Z',
    email: 'user@example.com',
    hostname: 'example.com',
    ipv4: '192.0.2.1',
    uri: 'https://example.com/resource',
    uuid: '123e4567-e89b-42d3-a456-426614174000',
  };
  const base =
    formats[String(schema.format)] ??
    String(schema.pattern ? 'example' : (schema.title ?? 'string'));
  const minLength = Math.min(Number(schema.minLength) || 0, 100);
  return base.padEnd(minLength, 'x');
}

export function generateJsonSchemaExample(input: string): unknown {
  // ponytail: 只解析本地 $ref；需要远程 schema 时由调用方显式加载后再传入。
  const schema = JSON.parse(input) as JsonSchema;
  if (typeof schema !== 'object' || schema === null)
    throw new Error('INVALID_SCHEMA');
  return schemaExample(schema, schema, 0);
}
