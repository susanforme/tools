export type JsonObject = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function inferJsonSchema(value: unknown): JsonObject {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) {
    const inferred = value.map(inferJsonSchema);
    const unique = [
      ...new Map(inferred.map((item) => [JSON.stringify(item), item])).values(),
    ];
    return {
      type: 'array',
      items:
        unique.length === 0
          ? {}
          : unique.length === 1
            ? unique[0]
            : { anyOf: unique },
    };
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    return {
      type: 'object',
      properties: Object.fromEntries(
        entries.map(([key, item]) => [key, inferJsonSchema(item)]),
      ),
      required: entries.map(([key]) => key),
    };
  }
  return {
    type:
      typeof value === 'number' && Number.isInteger(value)
        ? 'integer'
        : typeof value,
  };
}

function tsPropertyName(value: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(value) ? value : JSON.stringify(value);
}

function schemaType(schema: unknown, level: number): string {
  if (!isRecord(schema)) return 'unknown';
  if (Array.isArray(schema.enum)) {
    return (
      schema.enum.map((value) => JSON.stringify(value)).join(' | ') || 'never'
    );
  }
  const union = Array.isArray(schema.anyOf)
    ? schema.anyOf
    : Array.isArray(schema.oneOf)
      ? schema.oneOf
      : null;
  if (union) return union.map((item) => schemaType(item, level)).join(' | ');
  if (Array.isArray(schema.type)) {
    return schema.type
      .map((type) => schemaType({ ...schema, type }, level))
      .join(' | ');
  }
  if (schema.type === 'array')
    return `Array<${schemaType(schema.items, level)}>`;
  if (schema.type === 'object' || isRecord(schema.properties)) {
    const properties = isRecord(schema.properties) ? schema.properties : {};
    const required = new Set(
      Array.isArray(schema.required)
        ? schema.required.filter(
            (item): item is string => typeof item === 'string',
          )
        : [],
    );
    const indent = '  '.repeat(level + 1);
    const lines = Object.entries(properties).map(
      ([key, value]) =>
        `${indent}${tsPropertyName(key)}${required.has(key) ? '' : '?'}: ${schemaType(value, level + 1)};`,
    );
    if (schema.additionalProperties === true) {
      lines.push(`${indent}[key: string]: unknown;`);
    }
    return `{\n${lines.join('\n')}\n${'  '.repeat(level)}}`;
  }
  if (schema.type === 'string') return 'string';
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'null') return 'null';
  return 'unknown';
}

export function jsonSchemaToTypeScript(schema: unknown, name = 'Root'): string {
  return `export type ${name} = ${schemaType(schema, 0)};`;
}

export function jsonSchemaToInterface(schema: unknown, name = 'Root'): string {
  const body = schemaType(schema, 0);
  if (body.startsWith('{')) {
    return `export interface ${name} ${body}`;
  }
  return `export type ${name} = ${body};`;
}

function zodType(schema: unknown, level: number): string {
  if (!isRecord(schema)) return 'z.unknown()';
  if (Array.isArray(schema.enum)) {
    const values = schema.enum.map((value) => JSON.stringify(value));
    if (values.length === 0) return 'z.never()';
    if (values.length === 1) return `z.literal(${values[0]})`;
    return `z.enum([${values.join(', ')}])`;
  }
  const union = Array.isArray(schema.anyOf)
    ? schema.anyOf
    : Array.isArray(schema.oneOf)
      ? schema.oneOf
      : null;
  if (union) {
    return `z.union([${union.map((item) => zodType(item, level)).join(', ')}])`;
  }
  if (Array.isArray(schema.type)) {
    return `z.union([${schema.type
      .map((type) => zodType({ ...schema, type }, level))
      .join(', ')}])`;
  }
  if (schema.type === 'array') {
    return `z.array(${zodType(schema.items, level)})`;
  }
  if (schema.type === 'object' || isRecord(schema.properties)) {
    const properties = isRecord(schema.properties) ? schema.properties : {};
    const required = new Set(
      Array.isArray(schema.required)
        ? schema.required.filter(
            (item): item is string => typeof item === 'string',
          )
        : [],
    );
    const indent = '  '.repeat(level + 1);
    const lines = Object.entries(properties).map(([key, value]) => {
      const field = zodType(value, level + 1);
      const optional = required.has(key) ? field : `${field}.optional()`;
      return `${indent}${tsPropertyName(key)}: ${optional},`;
    });
    return `z.object({\n${lines.join('\n')}\n${'  '.repeat(level)}})`;
  }
  if (schema.type === 'string') return 'z.string()';
  if (schema.type === 'integer' || schema.type === 'number')
    return 'z.number()';
  if (schema.type === 'boolean') return 'z.boolean()';
  if (schema.type === 'null') return 'z.null()';
  return 'z.unknown()';
}

export function jsonSchemaToZod(schema: unknown, name = 'Root'): string {
  return `import { z } from 'zod';\n\nexport const ${name}Schema = ${zodType(schema, 0)};\n\nexport type ${name} = z.infer<typeof ${name}Schema>;`;
}

export function exampleFromSchema(schema: unknown): unknown {
  if (!isRecord(schema)) return null;
  if ('example' in schema) return schema.example;
  if ('default' in schema) return schema.default;
  if (Array.isArray(schema.enum)) return schema.enum[0] ?? null;
  if (schema.type === 'object' || isRecord(schema.properties)) {
    return Object.fromEntries(
      Object.entries(isRecord(schema.properties) ? schema.properties : {}).map(
        ([key, value]) => [key, exampleFromSchema(value)],
      ),
    );
  }
  if (schema.type === 'array') return [exampleFromSchema(schema.items)];
  if (schema.type === 'integer' || schema.type === 'number') return 0;
  if (schema.type === 'boolean') return false;
  return 'string';
}

export type OpenApiEndpoint = {
  id: string;
  method: string;
  path: string;
  summary: string;
  operation: JsonObject;
};

const HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
  'trace',
]);

export function extractOpenApiEndpoints(document: unknown): OpenApiEndpoint[] {
  if (!isRecord(document) || !isRecord(document.paths)) return [];
  return Object.entries(document.paths).flatMap(([path, pathItem]) => {
    if (!isRecord(pathItem)) return [];
    return Object.entries(pathItem).flatMap(([method, operation]) => {
      if (!HTTP_METHODS.has(method.toLowerCase()) || !isRecord(operation))
        return [];
      return [
        {
          id: `${method.toUpperCase()} ${path}`,
          method: method.toUpperCase(),
          path,
          summary:
            typeof operation.summary === 'string'
              ? operation.summary
              : typeof operation.operationId === 'string'
                ? operation.operationId
                : '',
          operation,
        },
      ];
    });
  });
}

function firstContentSchema(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.content)) return null;
  const media = Object.values(value.content).find(isRecord);
  return media && 'schema' in media ? media.schema : null;
}

function resolveLocalRef(document: JsonObject, schema: unknown): unknown {
  if (
    !isRecord(schema) ||
    typeof schema.$ref !== 'string' ||
    !schema.$ref.startsWith('#/')
  )
    return schema;
  return schema.$ref
    .slice(2)
    .split('/')
    .reduce<unknown>(
      (value, key) =>
        isRecord(value)
          ? value[key.replaceAll('~1', '/').replaceAll('~0', '~')]
          : null,
      document,
    );
}

export function openApiRequestExample(
  document: unknown,
  endpoint: OpenApiEndpoint,
): string {
  const root = isRecord(document) ? document : {};
  const server =
    Array.isArray(root.servers) &&
    isRecord(root.servers[0]) &&
    typeof root.servers[0].url === 'string'
      ? root.servers[0].url
      : 'https://api.example.com';
  const parameters = Array.isArray(endpoint.operation.parameters)
    ? endpoint.operation.parameters.filter(isRecord)
    : [];
  let path = endpoint.path;
  const query = new URLSearchParams();
  for (const parameter of parameters) {
    if (typeof parameter.name !== 'string') continue;
    const value = exampleFromSchema(resolveLocalRef(root, parameter.schema));
    if (parameter.in === 'path')
      path = path.replace(`{${parameter.name}}`, String(value));
    if (parameter.in === 'query') query.set(parameter.name, String(value));
  }
  const url = `${server.replace(/\/$/, '')}${path}${query.size ? `?${query}` : ''}`;
  const body = resolveLocalRef(
    root,
    firstContentSchema(endpoint.operation.requestBody),
  );
  return [
    `curl -X ${endpoint.method} ${JSON.stringify(url)}`,
    body ? "  -H 'Content-Type: application/json' \\" : '',
    body
      ? `  -d ${JSON.stringify(JSON.stringify(exampleFromSchema(body)))}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function extractOpenApiSchemas(document: unknown): JsonObject {
  if (!isRecord(document) || !isRecord(document.components)) return {};
  return isRecord(document.components.schemas)
    ? document.components.schemas
    : {};
}

export type EnvEntry = { key: string; value: string };

export function parseEnv(text: string): EnvEntry[] {
  const values = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const index = normalized.indexOf('=');
    if (index <= 0) continue;
    const key = normalized.slice(0, index).trim();
    const value = normalized.slice(index + 1).trim();
    if (/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key)) values.set(key, value);
  }
  return [...values].map(([key, value]) => ({ key, value }));
}

export function isSensitiveEnvKey(key: string): boolean {
  return /(secret|token|password|passwd|pwd|private|credential|api[_-]?key)/i.test(
    key,
  );
}

export function formatEnv(text: string, revealSecrets: boolean): string {
  return parseEnv(text)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(
      ({ key, value }) =>
        `${key}=${!revealSecrets && isSensitiveEnvKey(key) ? '********' : value}`,
    )
    .join('\n');
}

export type EnvDiff = {
  key: string;
  left: string | null;
  right: string | null;
  status: 'same' | 'changed' | 'left-only' | 'right-only';
};

export function diffEnv(left: string, right: string): EnvDiff[] {
  const a = new Map(parseEnv(left).map(({ key, value }) => [key, value]));
  const b = new Map(parseEnv(right).map(({ key, value }) => [key, value]));
  return [...new Set([...a.keys(), ...b.keys()])].sort().map((key) => {
    const leftValue = a.get(key) ?? null;
    const rightValue = b.get(key) ?? null;
    return {
      key,
      left: leftValue,
      right: rightValue,
      status:
        leftValue === null
          ? 'right-only'
          : rightValue === null
            ? 'left-only'
            : leftValue === rightValue
              ? 'same'
              : 'changed',
    };
  });
}

function sqlValue(value: unknown): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replaceAll("'", "''")}'`;
}

export type SqlColumn = { name: string; type: string };

export function parseCreateTable(sql: string): {
  table: string;
  columns: SqlColumn[];
} {
  const match = sql.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"[]?([\w.-]+)[`"\]]?\s*\(([\s\S]+)\)/i,
  );
  if (!match) throw new Error('INVALID_CREATE_TABLE');
  const columns = match[2]
    .split(/,(?![^()]*\))/)
    .map((part) => part.trim())
    .filter(
      (part) => !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(part),
    )
    .map((part) => {
      const column = part.match(/^[`"[]?([\w.-]+)[`"\]]?\s+([^\s,]+)/);
      if (!column) return null;
      return { name: column[1], type: column[2].toUpperCase() };
    })
    .filter((column): column is SqlColumn => column !== null);
  if (columns.length === 0) throw new Error('NO_COLUMNS');
  return { table: match[1], columns };
}

export function generateSqlInserts(
  table: string,
  columns: SqlColumn[],
  rows: Array<Record<string, unknown>>,
): string {
  const names = columns.map(({ name }) => `\`${name}\``).join(', ');
  return rows
    .map(
      (row) =>
        `INSERT INTO \`${table}\` (${names}) VALUES (${columns.map(({ name }) => sqlValue(row[name])).join(', ')});`,
    )
    .join('\n');
}

export function mergeGitignore(inputs: string[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const input of inputs) {
    for (const raw of input.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || seen.has(line)) continue;
      seen.add(line);
      lines.push(line);
    }
  }
  return lines.join('\n');
}

export function compareVersions(left: string, right: string): -1 | 0 | 1 {
  const parse = (value: string) => {
    const match = value
      .trim()
      .replace(/^v/, '')
      .match(
        /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/,
      );
    if (!match) throw new Error('INVALID_VERSION');
    return { numbers: match.slice(1, 4).map(Number), pre: match[4] ?? null };
  };
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index])
      return a.numbers[index] < b.numbers[index] ? -1 : 1;
  }
  if (a.pre === b.pre) return 0;
  if (a.pre === null) return 1;
  if (b.pre === null) return -1;
  const aParts = a.pre.split('.');
  const bParts = b.pre.split('.');
  for (
    let index = 0;
    index < Math.max(aParts.length, bParts.length);
    index += 1
  ) {
    const aPart = aParts[index];
    const bPart = bParts[index];
    if (aPart === undefined) return -1;
    if (bPart === undefined) return 1;
    if (aPart === bPart) continue;
    const aNumeric = /^\d+$/.test(aPart);
    const bNumeric = /^\d+$/.test(bPart);
    if (aNumeric && bNumeric) return Number(aPart) < Number(bPart) ? -1 : 1;
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return aPart < bPart ? -1 : 1;
  }
  return 0;
}

export type BundleEntry = { name: string; size: number };

export type UnixMode = { octal: string; symbolic: string };

const PERMISSION_BITS = [4, 2, 1] as const;

function permissionTriplet(value: number, special: number, scope: number) {
  const chars = PERMISSION_BITS.map((bit, index) =>
    value & bit ? 'rwx'[index] : '-',
  );
  if (special & scope) {
    const execute = chars[2] === 'x';
    chars[2] = scope === 1 ? (execute ? 't' : 'T') : execute ? 's' : 'S';
  }
  return chars.join('');
}

export function parseUnixMode(value: string): UnixMode {
  const input = value.trim();
  if (/^[0-7]{3,4}$/.test(input)) {
    const normalized = input.padStart(4, '0');
    const [special, owner, group, other] = [...normalized].map(Number);
    return {
      octal: special ? normalized : normalized.slice(1),
      symbolic:
        permissionTriplet(owner, special, 4) +
        permissionTriplet(group, special, 2) +
        permissionTriplet(other, special, 1),
    };
  }
  if (input.length === 10 && !/^[bcdlps-]/.test(input)) {
    throw new Error('INVALID_UNIX_MODE');
  }
  const symbolic = input.length === 10 ? input.slice(1) : input;
  if (!/^[r-][w-][xSs-][r-][w-][xSs-][r-][w-][xTt-]$/.test(symbolic)) {
    throw new Error('INVALID_UNIX_MODE');
  }
  const triples = [0, 3, 6].map((start) => {
    const chars = symbolic.slice(start, start + 3);
    return (
      Number(chars[0] === 'r') * 4 +
      Number(chars[1] === 'w') * 2 +
      Number(/[xst]/.test(chars[2]))
    );
  });
  const special =
    Number(/[sS]/.test(symbolic[2])) * 4 +
    Number(/[sS]/.test(symbolic[5])) * 2 +
    Number(/[tT]/.test(symbolic[8]));
  const octal = `${special}${triples.join('')}`;
  return { octal: special ? octal : octal.slice(1), symbolic };
}

export type SeoIssue = {
  code: string;
  level: 'error' | 'warning';
  line?: number;
};

export type SeoFileReport = {
  entries: number;
  issues: SeoIssue[];
  sitemaps: number;
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function inspectRobotsTxt(input: string): SeoFileReport {
  const issues: SeoIssue[] = [];
  let groups = 0;
  let rules = 0;
  let sitemaps = 0;
  input.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) return;
    const separator = line.indexOf(':');
    if (separator < 1) {
      issues.push({ code: 'missingColon', level: 'error', line: index + 1 });
      return;
    }
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (name === 'user-agent') {
      groups += 1;
      if (!value)
        issues.push({
          code: 'emptyUserAgent',
          level: 'error',
          line: index + 1,
        });
    }
    if (name === 'allow' || name === 'disallow') {
      rules += 1;
      if (groups === 0)
        issues.push({
          code: 'ruleBeforeUserAgent',
          level: 'warning',
          line: index + 1,
        });
    }
    if (name === 'sitemap') {
      sitemaps += 1;
      if (!isHttpUrl(value))
        issues.push({ code: 'invalidUrl', level: 'error', line: index + 1 });
    }
  });
  if (groups === 0) issues.push({ code: 'missingUserAgent', level: 'warning' });
  return { entries: rules, issues, sitemaps };
}

export function inspectSitemapXml(input: string): SeoFileReport {
  const document = new DOMParser().parseFromString(input, 'application/xml');
  if (document.querySelector('parsererror')) {
    return {
      entries: 0,
      issues: [{ code: 'invalidXml', level: 'error' }],
      sitemaps: 0,
    };
  }
  const root = document.documentElement.localName;
  if (root !== 'urlset' && root !== 'sitemapindex') {
    return {
      entries: 0,
      issues: [{ code: 'invalidRoot', level: 'error' }],
      sitemaps: 0,
    };
  }
  const entries = [
    ...document.getElementsByTagNameNS(
      '*',
      root === 'urlset' ? 'url' : 'sitemap',
    ),
  ];
  const issues = entries.flatMap((entry): SeoIssue[] => {
    const location = [...entry.children]
      .find((child) => child.localName === 'loc')
      ?.textContent?.trim();
    if (!location) return [{ code: 'missingLocation', level: 'error' }];
    return isHttpUrl(location) ? [] : [{ code: 'invalidUrl', level: 'error' }];
  });
  return {
    entries: root === 'urlset' ? entries.length : 0,
    issues,
    sitemaps: root === 'sitemapindex' ? entries.length : 0,
  };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const raw = value
    .trim()
    .replace(/^data:[^,]*;base64,/, '')
    .replace(/\s/g, '');
  const binary = atob(raw);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encodeBasicAuth(username: string, password: string): string {
  return `Basic ${bytesToBase64(new TextEncoder().encode(`${username}:${password}`))}`;
}

export function decodeBasicAuth(value: string): {
  username: string;
  password: string;
} {
  const encoded = value.trim().replace(/^Basic\s+/i, '');
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(
    base64ToBytes(encoded),
  );
  const separator = decoded.indexOf(':');
  if (separator < 0) throw new Error('INVALID_BASIC_AUTH');
  return {
    username: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  };
}

export function wifiQrValue(
  ssid: string,
  password: string,
  security: 'WPA' | 'WEP' | 'nopass',
  hidden: boolean,
): string {
  const escape = (value: string) => value.replace(/[\\;,:]/g, '\\$&');
  return `WIFI:T:${security};S:${escape(ssid)};P:${escape(password)};H:${hidden};;`;
}

function parseIpv6(value: string): bigint {
  let input = value.toLowerCase();
  if (input.includes('.')) {
    const separator = input.lastIndexOf(':');
    const parts = input
      .slice(separator + 1)
      .split('.')
      .map(Number);
    if (
      parts.length !== 4 ||
      parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
      throw new Error('INVALID_IPV6');
    }
    input = `${input.slice(0, separator)}:${((parts[0]! << 8) | parts[1]!).toString(16)}:${((parts[2]! << 8) | parts[3]!).toString(16)}`;
  }
  if ((input.match(/::/g) ?? []).length > 1) throw new Error('INVALID_IPV6');
  const [leftRaw, rightRaw] = input.split('::');
  const left = leftRaw ? leftRaw.split(':') : [];
  const right = rightRaw ? rightRaw.split(':') : [];
  const missing = 8 - left.length - right.length;
  if (input.includes('::') ? missing < 1 : missing !== 0) {
    throw new Error('INVALID_IPV6');
  }
  const groups = [...left, ...Array(missing).fill('0'), ...right];
  if (
    groups.length !== 8 ||
    groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))
  ) {
    throw new Error('INVALID_IPV6');
  }
  return groups.reduce(
    (result, group) => (result << 16n) | BigInt(`0x${group}`),
    0n,
  );
}

function ipv6Groups(value: bigint): string[] {
  return Array.from({ length: 8 }, (_, index) =>
    Number((value >> BigInt((7 - index) * 16)) & 0xffffn).toString(16),
  );
}

export function expandIpv6(value: string | bigint): string {
  return ipv6Groups(typeof value === 'bigint' ? value : parseIpv6(value))
    .map((group) => group.padStart(4, '0'))
    .join(':');
}

export function compressIpv6(value: string | bigint): string {
  const groups = ipv6Groups(
    typeof value === 'bigint' ? value : parseIpv6(value),
  );
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < groups.length; ) {
    if (groups[index] !== '0') {
      index += 1;
      continue;
    }
    let end = index;
    while (groups[end] === '0') end += 1;
    if (end - index > bestLength) {
      bestStart = index;
      bestLength = end - index;
    }
    index = end;
  }
  if (bestLength < 2) return groups.join(':');
  const left = groups.slice(0, bestStart).join(':');
  const right = groups.slice(bestStart + bestLength).join(':');
  return `${left}::${right}`;
}

export type Ipv6Info = {
  address: string;
  expanded: string;
  prefix: number;
  network: string;
  lastAddress: string;
};

export function inspectIpv6(input: string): Ipv6Info {
  const [rawAddress, rawPrefix] = input.trim().split('/');
  const prefix = rawPrefix === undefined ? 128 : Number(rawPrefix);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) {
    throw new Error('INVALID_IPV6_PREFIX');
  }
  const address = parseIpv6(rawAddress!);
  const hostBits = 128 - prefix;
  const hostMask = hostBits === 0 ? 0n : (1n << BigInt(hostBits)) - 1n;
  const network = address & ~hostMask;
  return {
    address: compressIpv6(address),
    expanded: expandIpv6(address),
    prefix,
    network: `${compressIpv6(network)}/${prefix}`,
    lastAddress: compressIpv6(network | hostMask),
  };
}

export function generateIpv6Ula(): string {
  const random = crypto.getRandomValues(new Uint8Array(5));
  return `fd${random[0]!.toString(16).padStart(2, '0')}:${((random[1]! << 8) | random[2]!).toString(16).padStart(4, '0')}:${((random[3]! << 8) | random[4]!).toString(16).padStart(4, '0')}::/48`;
}

export type MacAddressInfo = {
  colon: string;
  hyphen: string;
  plain: string;
  multicast: boolean;
  locallyAdministered: boolean;
};

export function inspectMacAddress(input: string): MacAddressInfo {
  const plain = input.trim().replace(/[.:-]/g, '').toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(plain)) throw new Error('INVALID_MAC');
  const pairs = plain.match(/.{2}/g)!;
  const first = Number.parseInt(pairs[0]!, 16);
  return {
    colon: pairs.join(':'),
    hyphen: pairs.join('-'),
    plain,
    multicast: Boolean(first & 1),
    locallyAdministered: Boolean(first & 2),
  };
}

export function generateMacAddress(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  bytes[0] = (bytes[0]! | 2) & 0xfe;
  return [...bytes]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase();
}

function shellWords(command: string): string[] {
  const words: string[] = [];
  let word = '';
  let quote = '';
  let escaped = false;
  for (const character of command.trim()) {
    if (escaped) {
      word += character;
      escaped = false;
    } else if (character === '\\' && quote !== "'") {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = '';
      else word += character;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (/\s/.test(character)) {
      if (word) words.push(word);
      word = '';
    } else {
      word += character;
    }
  }
  if (quote || escaped) throw new Error('INVALID_SHELL_COMMAND');
  if (word) words.push(word);
  return words;
}

export function dockerRunToCompose(command: string): string {
  // ponytail: 只覆盖常用 docker run 参数；未知参数显式报错，实测需要完整 CLI 语法时再扩展。
  const words = shellWords(command);
  if (words[0] === 'docker') words.shift();
  if (words[0] === 'run') words.shift();
  const values: Record<string, string | string[] | boolean> = {
    ports: [],
    environment: [],
    volumes: [],
  };
  const takesValue: Record<string, string> = {
    '--name': 'name',
    '--restart': 'restart',
    '-p': 'ports',
    '--publish': 'ports',
    '-e': 'environment',
    '--env': 'environment',
    '-v': 'volumes',
    '--volume': 'volumes',
    '-w': 'working_dir',
    '--workdir': 'working_dir',
    '--network': 'network_mode',
    '--entrypoint': 'entrypoint',
    '-u': 'user',
    '--user': 'user',
    '--hostname': 'hostname',
  };
  while (words[0]?.startsWith('-')) {
    const raw = words.shift()!;
    const [flag, inline] = raw.split(/=(.*)/s, 2);
    if (['-d', '--detach', '-i', '-t', '-it', '--rm'].includes(flag!)) continue;
    if (flag === '--privileged') {
      values.privileged = true;
      continue;
    }
    const key = takesValue[flag!];
    if (!key) throw new Error(`UNSUPPORTED_OPTION:${flag}`);
    const value = inline ?? words.shift();
    if (!value) throw new Error(`MISSING_OPTION_VALUE:${flag}`);
    if (Array.isArray(values[key])) (values[key] as string[]).push(value);
    else values[key] = value;
  }
  const image = words.shift();
  if (!image) throw new Error('MISSING_IMAGE');
  const service =
    String(values.name ?? 'app').replace(/[^a-zA-Z0-9_-]/g, '-') || 'app';
  const lines = [
    'services:',
    `  ${service}:`,
    `    image: ${JSON.stringify(image)}`,
  ];
  const scalarKeys = [
    'restart',
    'working_dir',
    'network_mode',
    'entrypoint',
    'user',
    'hostname',
  ] as const;
  for (const key of scalarKeys) {
    if (typeof values[key] === 'string')
      lines.push(`    ${key}: ${JSON.stringify(values[key])}`);
  }
  if (values.privileged) lines.push('    privileged: true');
  for (const key of ['ports', 'environment', 'volumes'] as const) {
    const items = values[key] as string[];
    if (!items.length) continue;
    lines.push(
      `    ${key}:`,
      ...items.map((item) => `      - ${JSON.stringify(item)}`),
    );
  }
  if (words.length)
    lines.push(
      `    command: [${words.map((word) => JSON.stringify(word)).join(', ')}]`,
    );
  return lines.join('\n');
}

export async function analyzeBundleFiles(
  files: File[],
): Promise<BundleEntry[]> {
  const entries: BundleEntry[] = [];
  for (const file of files) {
    if (file.name.endsWith('.map')) {
      const map: unknown = JSON.parse(await file.text());
      if (isRecord(map) && Array.isArray(map.sources)) {
        const contents = Array.isArray(map.sourcesContent)
          ? map.sourcesContent
          : [];
        map.sources.forEach((source, index) => {
          if (typeof source !== 'string') return;
          const content =
            typeof contents[index] === 'string' ? contents[index] : '';
          entries.push({ name: source, size: new Blob([content]).size });
        });
        continue;
      }
    }
    entries.push({ name: file.name, size: file.size });
  }
  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.name, (totals.get(entry.name) ?? 0) + entry.size);
  }
  return [...totals]
    .map(([name, size]) => ({ name, size }))
    .sort((a, b) => b.size - a.size);
}
