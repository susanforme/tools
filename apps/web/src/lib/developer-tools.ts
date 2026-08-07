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
