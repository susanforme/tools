import { pemToJwk } from './jwk';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function splitOutside(value: string, separator: string): string[] {
  const result: string[] = [];
  let quoted = false;
  let angled = 0;
  let escaped = false;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\' && quoted) {
      escaped = true;
      continue;
    }
    if (character === '"') quoted = !quoted;
    else if (!quoted && character === '<') angled += 1;
    else if (!quoted && character === '>') angled = Math.max(0, angled - 1);
    else if (!quoted && angled === 0 && character === separator) {
      result.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(value.slice(start).trim());
  return result.filter(Boolean);
}

function parseHeaderLines(input: string): Map<string, string> {
  const headers = new Map<string, string>();
  for (const line of input.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    headers.set(
      name,
      headers.has(name) ? `${headers.get(name)}, ${value}` : value,
    );
  }
  return headers;
}

// ─── HTTP Message Signatures / Digest ──────────────────────────────────────

export type HttpSignatureAlgorithm = 'hmac-sha256' | 'rsa-pss-sha512';

export async function createContentDigest(
  content: string,
  algorithm: 'sha-256' | 'sha-512' = 'sha-256',
): Promise<string> {
  const digest = await crypto.subtle.digest(
    algorithm === 'sha-256' ? 'SHA-256' : 'SHA-512',
    new TextEncoder().encode(content),
  );
  return `${algorithm}=:${bytesToBase64(new Uint8Array(digest))}:`;
}

export async function verifyContentDigest(
  content: string,
  header: string,
): Promise<boolean> {
  const match = header.trim().match(/^(sha-256|sha-512)=:([^:]+):$/i);
  if (!match) throw new Error('INVALID_CONTENT_DIGEST');
  return (
    (await createContentDigest(
      content,
      match[1].toLowerCase() as 'sha-256' | 'sha-512',
    )) === `${match[1].toLowerCase()}=:${match[2]}:`
  );
}

export type HttpSignatureResult = {
  contentDigest: string;
  signatureInput: string;
  signature: string;
  signatureBase: string;
};

async function importRsaPssKey(
  pem: string,
  usage: 'sign' | 'verify',
): Promise<CryptoKey> {
  const source = await pemToJwk(pem);
  const jwk: JsonWebKey =
    usage === 'verify'
      ? { kty: source.kty, n: source.n, e: source.e }
      : { ...source };
  delete jwk.alg;
  delete jwk.key_ops;
  delete jwk.use;
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSA-PSS', hash: 'SHA-512' },
    false,
    [usage],
  );
}

async function signatureKey(
  algorithm: HttpSignatureAlgorithm,
  keyMaterial: string,
  usage: 'sign' | 'verify',
): Promise<CryptoKey> {
  if (algorithm === 'rsa-pss-sha512')
    return importRsaPssKey(keyMaterial, usage);
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keyMaterial),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}

export async function signHttpMessage(options: {
  method: string;
  url: string;
  body: string;
  keyMaterial: string;
  algorithm: HttpSignatureAlgorithm;
  keyId?: string;
  created?: number;
}): Promise<HttpSignatureResult> {
  const method = options.method.trim().toLowerCase();
  const url = new URL(options.url).toString();
  const created = options.created ?? Math.floor(Date.now() / 1000);
  const keyId = (options.keyId || 'tool-key').replaceAll('"', '\\"');
  const contentDigest = await createContentDigest(options.body);
  const parameters = `("@method" "@target-uri" "content-digest");created=${created};keyid="${keyId}";alg="${options.algorithm}"`;
  const signatureBase = [
    `"@method": ${method}`,
    `"@target-uri": ${url}`,
    `"content-digest": ${contentDigest}`,
    `"@signature-params": ${parameters}`,
  ].join('\n');
  const key = await signatureKey(
    options.algorithm,
    options.keyMaterial,
    'sign',
  );
  const signatureBytes = await crypto.subtle.sign(
    options.algorithm === 'rsa-pss-sha512'
      ? { name: 'RSA-PSS', saltLength: 64 }
      : 'HMAC',
    key,
    new TextEncoder().encode(signatureBase),
  );
  return {
    contentDigest,
    signatureInput: `sig1=${parameters}`,
    signature: `sig1=:${bytesToBase64(new Uint8Array(signatureBytes))}:`,
    signatureBase,
  };
}

export async function verifyHttpMessageSignature(options: {
  signatureBase: string;
  signature: string;
  keyMaterial: string;
  algorithm: HttpSignatureAlgorithm;
}): Promise<boolean> {
  const match = options.signature.trim().match(/^sig1=:([^:]+):$/);
  if (!match) throw new Error('INVALID_SIGNATURE_HEADER');
  const key = await signatureKey(
    options.algorithm,
    options.keyMaterial,
    'verify',
  );
  return crypto.subtle.verify(
    options.algorithm === 'rsa-pss-sha512'
      ? { name: 'RSA-PSS', saltLength: 64 }
      : 'HMAC',
    key,
    base64ToBytes(match[1]),
    new TextEncoder().encode(options.signatureBase),
  );
}

// ─── Permissions Policy / Reporting ────────────────────────────────────────

export type PolicyIssue = { code: string; detail: string };

export function inspectPermissionsPolicy(
  policyInput: string,
  reportOnlyInput: string,
  reportingInput: string,
): {
  policy: Record<string, string[]>;
  reportOnly: Record<string, string[]>;
  endpoints: Record<string, string>;
  issues: PolicyIssue[];
} {
  const issues: PolicyIssue[] = [];
  const endpoints: Record<string, string> = {};
  const reportingValue = reportingInput.replace(
    /^Reporting-Endpoints:\s*/i,
    '',
  );
  for (const item of splitOutside(reportingValue, ',')) {
    const match = item.match(/^([a-zA-Z][\w-]*)\s*=\s*"([^"]+)"$/);
    if (!match)
      issues.push({ code: 'INVALID_REPORTING_ENDPOINT', detail: item });
    else {
      try {
        endpoints[match[1]] = new URL(match[2]).toString();
      } catch {
        issues.push({ code: 'INVALID_REPORTING_URL', detail: match[2] });
      }
    }
  }
  const parse = (input: string, header: string) => {
    const result: Record<string, string[]> = {};
    const value = input.replace(new RegExp(`^${header}:\\s*`, 'i'), '');
    for (const item of splitOutside(value, ',')) {
      const match = item.match(
        /^([a-z][\w-]*)\s*=\s*\(([^)]*)\)(?:\s*;\s*report-to=([a-zA-Z][\w-]*))?$/,
      );
      if (!match) {
        if (item)
          issues.push({ code: 'INVALID_POLICY_DIRECTIVE', detail: item });
        continue;
      }
      if (result[match[1]])
        issues.push({ code: 'DUPLICATE_POLICY_DIRECTIVE', detail: match[1] });
      result[match[1]] = match[2].match(/"[^"]*"|[^\s]+/g) ?? [];
      if (match[3] && !endpoints[match[3]])
        issues.push({ code: 'UNKNOWN_REPORTING_ENDPOINT', detail: match[3] });
    }
    return result;
  };
  return {
    policy: parse(policyInput, 'Permissions-Policy'),
    reportOnly: parse(reportOnlyInput, 'Permissions-Policy-Report-Only'),
    endpoints,
    issues,
  };
}

// ─── App / Universal Links ─────────────────────────────────────────────────

export type AppAssociationPlatform = 'android' | 'apple';

function globMatches(pattern: string, path: string): boolean {
  const expression = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replaceAll('*', '.*')
    .replaceAll('?', '.');
  return new RegExp(`^${expression}$`).test(path);
}

export function generateAppAssociation(
  platform: AppAssociationPlatform,
  appId: string,
  fingerprint: string,
  path: string,
): string {
  return JSON.stringify(
    platform === 'android'
      ? [
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: appId,
              sha256_cert_fingerprints: [fingerprint],
            },
          },
        ]
      : {
          applinks: {
            details: [
              {
                appIDs: [appId],
                components: [{ '/': path || '/*' }],
              },
            ],
          },
        },
    null,
    2,
  );
}

export function inspectAppAssociation(
  input: string,
  platform: AppAssociationPlatform,
  testPath: string,
): { issues: string[]; matched: boolean | null } {
  const value: unknown = JSON.parse(input);
  const issues: string[] = [];
  if (platform === 'android') {
    if (!Array.isArray(value) || value.length === 0)
      issues.push('ANDROID_ARRAY_REQUIRED');
    for (const [index, statement] of (Array.isArray(value)
      ? value
      : []
    ).entries()) {
      if (!isObject(statement) || !Array.isArray(statement.relation))
        issues.push(`INVALID_RELATION:${index}`);
      const target =
        isObject(statement) && isObject(statement.target)
          ? statement.target
          : null;
      if (
        !target ||
        target.namespace !== 'android_app' ||
        typeof target.package_name !== 'string'
      )
        issues.push(`INVALID_ANDROID_TARGET:${index}`);
      if (!target || !Array.isArray(target.sha256_cert_fingerprints))
        issues.push(`MISSING_FINGERPRINT:${index}`);
    }
    return { issues, matched: null };
  }
  const applinks =
    isObject(value) && isObject(value.applinks) ? value.applinks : null;
  const details =
    applinks && Array.isArray(applinks.details) ? applinks.details : [];
  if (details.length === 0) issues.push('APPLE_DETAILS_REQUIRED');
  let matched = false;
  for (const [index, detail] of details.entries()) {
    if (!isObject(detail)) {
      issues.push(`INVALID_APPLE_DETAIL:${index}`);
      continue;
    }
    if (typeof detail.appID !== 'string' && !Array.isArray(detail.appIDs))
      issues.push(`MISSING_APP_ID:${index}`);
    const paths = Array.isArray(detail.paths)
      ? detail.paths.filter((item): item is string => typeof item === 'string')
      : [];
    const components = Array.isArray(detail.components)
      ? detail.components.filter(isObject)
      : [];
    for (const pattern of paths) {
      const excluded = pattern.startsWith('NOT ');
      if (globMatches(excluded ? pattern.slice(4) : pattern, testPath)) {
        matched = !excluded;
        break;
      }
    }
    for (const component of components) {
      if (typeof component['/'] !== 'string') continue;
      if (globMatches(component['/'], testPath)) {
        matched = component.exclude !== true;
        break;
      }
    }
  }
  return { issues, matched };
}

// ─── OpenAPI diff ──────────────────────────────────────────────────────────

export type ApiChange = {
  level: 'breaking' | 'non-breaking';
  code: string;
  path: string;
};

const HTTP_METHODS = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

function openApiOperations(document: unknown): Map<string, JsonObject> {
  const result = new Map<string, JsonObject>();
  if (!isObject(document) || !isObject(document.paths)) return result;
  for (const [path, pathItem] of Object.entries(document.paths)) {
    if (!isObject(pathItem)) continue;
    for (const [method, operation] of Object.entries(pathItem))
      if (HTTP_METHODS.has(method) && isObject(operation))
        result.set(`${method.toUpperCase()} ${path}`, operation);
  }
  return result;
}

function operationParameters(operation: JsonObject): Map<string, JsonObject> {
  const parameters = new Map<string, JsonObject>();
  if (!Array.isArray(operation.parameters)) return parameters;
  for (const value of operation.parameters)
    if (
      isObject(value) &&
      typeof value.name === 'string' &&
      typeof value.in === 'string'
    )
      parameters.set(`${value.in}:${value.name}`, value);
  return parameters;
}

export function diffOpenApi(previous: unknown, next: unknown): ApiChange[] {
  const changes: ApiChange[] = [];
  const before = openApiOperations(previous);
  const after = openApiOperations(next);
  for (const [id, operation] of before) {
    const current = after.get(id);
    if (!current) {
      changes.push({ level: 'breaking', code: 'OPERATION_REMOVED', path: id });
      continue;
    }
    const oldParameters = operationParameters(operation);
    const newParameters = operationParameters(current);
    for (const key of oldParameters.keys())
      if (!newParameters.has(key))
        changes.push({
          level: 'breaking',
          code: 'PARAMETER_REMOVED',
          path: `${id} · ${key}`,
        });
    for (const [key, parameter] of newParameters)
      if (!oldParameters.has(key))
        changes.push({
          level: parameter.required === true ? 'breaking' : 'non-breaking',
          code:
            parameter.required === true
              ? 'REQUIRED_PARAMETER_ADDED'
              : 'OPTIONAL_PARAMETER_ADDED',
          path: `${id} · ${key}`,
        });
    const oldResponses = isObject(operation.responses)
      ? operation.responses
      : {};
    const newResponses = isObject(current.responses) ? current.responses : {};
    for (const status of Object.keys(oldResponses))
      if (!(status in newResponses))
        changes.push({
          level: 'breaking',
          code: 'RESPONSE_REMOVED',
          path: `${id} · ${status}`,
        });
  }
  for (const id of after.keys())
    if (!before.has(id))
      changes.push({
        level: 'non-breaking',
        code: 'OPERATION_ADDED',
        path: id,
      });

  const schemas = (document: unknown): JsonObject => {
    if (
      !isObject(document) ||
      !isObject(document.components) ||
      !isObject(document.components.schemas)
    )
      return {};
    return document.components.schemas;
  };
  const oldSchemas = schemas(previous);
  const newSchemas = schemas(next);
  for (const [name, schema] of Object.entries(oldSchemas)) {
    if (!(name in newSchemas)) {
      changes.push({ level: 'breaking', code: 'SCHEMA_REMOVED', path: name });
      continue;
    }
    const oldRequired =
      isObject(schema) && Array.isArray(schema.required) ? schema.required : [];
    const newSchema = newSchemas[name];
    const newRequired =
      isObject(newSchema) && Array.isArray(newSchema.required)
        ? newSchema.required
        : [];
    for (const property of newRequired)
      if (typeof property === 'string' && !oldRequired.includes(property))
        changes.push({
          level: 'breaking',
          code: 'REQUIRED_PROPERTY_ADDED',
          path: `${name}.${property}`,
        });
  }
  for (const name of Object.keys(newSchemas))
    if (!(name in oldSchemas))
      changes.push({ level: 'non-breaking', code: 'SCHEMA_ADDED', path: name });
  return changes;
}

// ─── Web App Manifest ──────────────────────────────────────────────────────

export type ManifestIssue = { level: 'error' | 'warning'; code: string };

export function inspectWebManifest(value: unknown): ManifestIssue[] {
  if (!isObject(value))
    return [{ level: 'error', code: 'MANIFEST_OBJECT_REQUIRED' }];
  const issues: ManifestIssue[] = [];
  if (typeof value.name !== 'string' && typeof value.short_name !== 'string')
    issues.push({ level: 'error', code: 'MANIFEST_NAME_REQUIRED' });
  if (typeof value.start_url !== 'string')
    issues.push({ level: 'error', code: 'START_URL_REQUIRED' });
  if (typeof value.display !== 'string')
    issues.push({ level: 'warning', code: 'DISPLAY_RECOMMENDED' });
  const icons = Array.isArray(value.icons) ? value.icons.filter(isObject) : [];
  if (
    !icons.some((icon) =>
      String(icon.sizes ?? '')
        .split(/\s+/)
        .includes('192x192'),
    )
  )
    issues.push({ level: 'error', code: 'ICON_192_REQUIRED' });
  if (
    !icons.some((icon) =>
      String(icon.sizes ?? '')
        .split(/\s+/)
        .includes('512x512'),
    )
  )
    issues.push({ level: 'error', code: 'ICON_512_REQUIRED' });
  if (
    !icons.some((icon) =>
      String(icon.purpose ?? '')
        .split(/\s+/)
        .includes('maskable'),
    )
  )
    issues.push({ level: 'warning', code: 'MASKABLE_ICON_RECOMMENDED' });
  if (typeof value.scope === 'string' && typeof value.start_url === 'string') {
    try {
      const scope = new URL(value.scope, 'https://example.invalid/');
      const start = new URL(value.start_url, 'https://example.invalid/');
      if (!start.pathname.startsWith(scope.pathname))
        issues.push({ level: 'error', code: 'START_URL_OUTSIDE_SCOPE' });
    } catch {
      issues.push({ level: 'error', code: 'INVALID_MANIFEST_URL' });
    }
  }
  if (Array.isArray(value.shortcuts))
    for (const shortcut of value.shortcuts)
      if (
        !isObject(shortcut) ||
        typeof shortcut.name !== 'string' ||
        typeof shortcut.url !== 'string'
      )
        issues.push({ level: 'error', code: 'INVALID_SHORTCUT' });
  return issues;
}

// ─── Link header / Cookie / Forwarded ──────────────────────────────────────

export type LinkHeaderEntry = {
  target: string;
  parameters: Record<string, string>;
};

export function parseLinkHeader(input: string): LinkHeaderEntry[] {
  const value = input.replace(/^Link:\s*/i, '');
  return splitOutside(value, ',').map((item) => {
    const match = item.match(/^<([^>]*)>(.*)$/);
    if (!match) throw new Error('INVALID_LINK_HEADER');
    const parameters: Record<string, string> = {};
    for (const raw of splitOutside(match[2], ';')) {
      const separator = raw.indexOf('=');
      const name = (separator < 0 ? raw : raw.slice(0, separator))
        .trim()
        .toLowerCase();
      if (!name) continue;
      const source = separator < 0 ? '' : raw.slice(separator + 1).trim();
      parameters[name] =
        source.startsWith('"') && source.endsWith('"')
          ? source.slice(1, -1).replace(/\\(["\\])/g, '$1')
          : source;
    }
    return { target: match[1], parameters };
  });
}

export function serializeLinkHeader(entries: LinkHeaderEntry[]): string {
  return entries
    .map(
      ({ target, parameters }) =>
        `<${target}>${Object.entries(parameters)
          .map(
            ([name, value]) => `; ${name}="${value.replace(/["\\]/g, '\\$&')}"`,
          )
          .join('')}`,
    )
    .join(', ');
}

export type CookieIssue = { level: 'error' | 'warning'; code: string };

export function inspectModernCookie(input: string): CookieIssue[] {
  const issues: CookieIssue[] = [];
  if (
    !/^Set-Cookie:/im.test(input) &&
    !/;\s*(path|domain|expires|max-age|httponly|secure|samesite|partitioned)(?:[=;]|$)/i.test(
      input,
    )
  )
    return issues;
  for (const rawLine of input.split(/\r?\n/).filter(Boolean)) {
    const line = rawLine.replace(/^Set-Cookie:\s*/i, '');
    const [pair, ...rawAttributes] = line.split(';').map((item) => item.trim());
    const separator = pair.indexOf('=');
    if (separator < 1) {
      issues.push({ level: 'error', code: 'INVALID_COOKIE_PAIR' });
      continue;
    }
    const name = pair.slice(0, separator);
    const attributes = new Map<string, string>();
    for (const raw of rawAttributes) {
      const index = raw.indexOf('=');
      attributes.set(
        (index < 0 ? raw : raw.slice(0, index)).toLowerCase(),
        index < 0 ? '' : raw.slice(index + 1),
      );
    }
    const secure = attributes.has('secure');
    const httpOnly = attributes.has('httponly');
    if (attributes.get('samesite')?.toLowerCase() === 'none' && !secure)
      issues.push({ level: 'error', code: 'SAMESITE_NONE_REQUIRES_SECURE' });
    if (attributes.has('partitioned') && !secure)
      issues.push({ level: 'error', code: 'PARTITIONED_REQUIRES_SECURE' });
    if (name.startsWith('__Secure-') && !secure)
      issues.push({ level: 'error', code: 'SECURE_PREFIX_REQUIRES_SECURE' });
    if (name.startsWith('__Host-')) {
      if (!secure)
        issues.push({ level: 'error', code: 'HOST_PREFIX_REQUIRES_SECURE' });
      if (attributes.get('path') !== '/')
        issues.push({ level: 'error', code: 'HOST_PREFIX_REQUIRES_ROOT_PATH' });
      if (attributes.has('domain'))
        issues.push({ level: 'error', code: 'HOST_PREFIX_FORBIDS_DOMAIN' });
    }
    if (
      (name.startsWith('__Http-') || name.startsWith('__Host-Http-')) &&
      (!secure || !httpOnly)
    )
      issues.push({
        level: 'error',
        code: 'HTTP_PREFIX_REQUIRES_SECURE_HTTPONLY',
      });
    if (!httpOnly)
      issues.push({ level: 'warning', code: 'HTTPONLY_RECOMMENDED' });
  }
  return issues;
}

export function analyzeForwardedHeaders(
  input: string,
  trustedProxies: number,
): {
  forwarded: Array<Record<string, string>>;
  xForwardedFor: string[];
  via: string[];
  probableClient: string | null;
  warnings: string[];
} {
  const headers = parseHeaderLines(input);
  const forwarded = splitOutside(headers.get('forwarded') ?? '', ',').map(
    (hop) =>
      Object.fromEntries(
        splitOutside(hop, ';').map((item) => {
          const separator = item.indexOf('=');
          if (separator < 1) throw new Error('INVALID_FORWARDED');
          return [
            item.slice(0, separator).trim().toLowerCase(),
            item
              .slice(separator + 1)
              .trim()
              .replace(/^"|"$/g, ''),
          ];
        }),
      ),
  );
  const xForwardedFor = splitOutside(headers.get('x-forwarded-for') ?? '', ',');
  const via = splitOutside(headers.get('via') ?? '', ',');
  const index = xForwardedFor.length - trustedProxies - 1;
  const warnings: string[] = [];
  if (trustedProxies < 0 || !Number.isInteger(trustedProxies))
    warnings.push('INVALID_TRUST_COUNT');
  if (xForwardedFor.length > 0 && index < 0)
    warnings.push('TRUST_COUNT_EXCEEDS_CHAIN');
  if (!headers.has('forwarded') && !headers.has('x-forwarded-for'))
    warnings.push('NO_FORWARDING_CHAIN');
  return {
    forwarded,
    xForwardedFor,
    via,
    probableClient: index >= 0 ? xForwardedFor[index] : null,
    warnings,
  };
}

// ─── JCS / Content Negotiation ─────────────────────────────────────────────

function canonicalizeValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0))
      throw new Error('INVALID_JCS_NUMBER');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    if (
      /([\uD800-\uDBFF](?![\uDC00-\uDFFF]))|((?<![\uD800-\uDBFF])[\uDC00-\uDFFF])/.test(
        value,
      )
    )
      throw new Error('INVALID_JCS_UNICODE');
    return JSON.stringify(value);
  }
  if (Array.isArray(value))
    return `[${value.map(canonicalizeValue).join(',')}]`;
  if (isObject(value))
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) => `${canonicalizeValue(key)}:${canonicalizeValue(value[key])}`,
      )
      .join(',')}}`;
  throw new Error('INVALID_JCS_VALUE');
}

export function canonicalizeJson(input: string): string {
  return canonicalizeValue(JSON.parse(input) as unknown);
}

export async function digestCanonicalJson(input: string): Promise<string> {
  const canonical = canonicalizeJson(input);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical),
  );
  return bytesToBase64(new Uint8Array(digest));
}

export type NegotiationKind = 'media' | 'language' | 'encoding';

export function negotiateContent(
  accept: string,
  availableInput: string,
  kind: NegotiationKind,
): {
  selected: string | null;
  candidates: Array<{ value: string; q: number; specificity: number }>;
} {
  const ranges = splitOutside(accept, ',').map((item, order) => {
    const [value, ...parameters] = item.split(';').map((part) => part.trim());
    const qValue = parameters.find((part) =>
      part.toLowerCase().startsWith('q='),
    );
    const q = qValue ? Number(qValue.slice(2)) : 1;
    if (!Number.isFinite(q) || q < 0 || q > 1)
      throw new Error('INVALID_QUALITY_VALUE');
    return { value: value.toLowerCase(), q, order };
  });
  const available = availableInput
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const match = (range: string, candidate: string): number => {
    const value = candidate.toLowerCase();
    if (range === '*' || range === '*/*') return 0;
    if (range === value) return 3;
    if (
      kind === 'media' &&
      range.endsWith('/*') &&
      value.startsWith(range.slice(0, -1))
    )
      return 2;
    if (
      kind === 'language' &&
      (value.startsWith(`${range}-`) || range.startsWith(`${value}-`))
    )
      return 2;
    return -1;
  };
  const candidates = available
    .map((value, availableOrder) => {
      const best = ranges
        .map((range) => ({ ...range, specificity: match(range.value, value) }))
        .filter((range) => range.specificity >= 0 && range.q > 0)
        .sort(
          (left, right) =>
            right.q - left.q ||
            right.specificity - left.specificity ||
            left.order - right.order,
        )[0];
      return {
        value,
        q: best?.q ?? 0,
        specificity: best?.specificity ?? -1,
        availableOrder,
      };
    })
    .sort(
      (left, right) =>
        right.q - left.q ||
        right.specificity - left.specificity ||
        left.availableOrder - right.availableOrder,
    )
    .map(({ value, q, specificity }) => ({ value, q, specificity }));
  return {
    selected: candidates[0]?.q ? candidates[0].value : null,
    candidates,
  };
}

// ─── Nginx location / DNSSEC ───────────────────────────────────────────────

export type NginxLocation = {
  modifier: '=' | '^~' | '~' | '~*' | '';
  pattern: string;
  line: number;
};

export function matchNginxLocation(
  config: string,
  uri: string,
): {
  locations: NginxLocation[];
  matched: NginxLocation | null;
} {
  // ponytail: 只模拟同级 location；出现嵌套 location 时再升级为配置 AST。
  const locations: NginxLocation[] = [];
  for (const [index, line] of config.split(/\r?\n/).entries()) {
    const match = line.match(
      /\blocation\s+(?:(=|\^~|~\*|~)\s+)?([^\s{]+)\s*\{/,
    );
    if (match)
      locations.push({
        modifier: (match[1] ?? '') as NginxLocation['modifier'],
        pattern: match[2],
        line: index + 1,
      });
  }
  const exact = locations.find(
    (location) => location.modifier === '=' && location.pattern === uri,
  );
  if (exact) return { locations, matched: exact };
  const prefix = locations
    .filter(
      (location) =>
        (location.modifier === '' || location.modifier === '^~') &&
        uri.startsWith(location.pattern),
    )
    .sort((left, right) => right.pattern.length - left.pattern.length)[0];
  if (prefix?.modifier === '^~') return { locations, matched: prefix };
  for (const location of locations.filter(
    (item) => item.modifier === '~' || item.modifier === '~*',
  )) {
    try {
      if (
        new RegExp(
          location.pattern,
          location.modifier === '~*' ? 'i' : '',
        ).test(uri)
      )
        return { locations, matched: location };
    } catch {
      throw new Error(`INVALID_NGINX_REGEX:${location.line}`);
    }
  }
  return { locations, matched: prefix ?? null };
}

function dnsNameToWire(name: string): Uint8Array {
  const labels = name.toLowerCase().replace(/\.$/, '').split('.');
  const bytes: number[] = [];
  for (const label of labels) {
    const value = new TextEncoder().encode(label);
    if (!label || value.length > 63) throw new Error('INVALID_DNS_NAME');
    bytes.push(value.length, ...value);
  }
  bytes.push(0);
  return new Uint8Array(bytes);
}

export type DnskeyInfo = {
  flags: number;
  protocol: number;
  algorithm: number;
  keyTag: number;
  publicKeyBytes: number;
};

function dnskeyRdata(input: string): { bytes: Uint8Array; info: DnskeyInfo } {
  const parts = input
    .trim()
    .replace(/^.*?\s+IN\s+DNSKEY\s+/i, '')
    .split(/\s+/);
  if (parts.length < 4) throw new Error('INVALID_DNSKEY');
  const flags = Number(parts[0]);
  const protocol = Number(parts[1]);
  const algorithm = Number(parts[2]);
  if (![flags, protocol, algorithm].every(Number.isInteger) || protocol !== 3)
    throw new Error('INVALID_DNSKEY');
  const publicKey = base64ToBytes(parts.slice(3).join(''));
  const bytes = new Uint8Array(4 + publicKey.length);
  bytes[0] = flags >> 8;
  bytes[1] = flags & 0xff;
  bytes[2] = protocol;
  bytes[3] = algorithm;
  bytes.set(publicKey, 4);
  let accumulator = 0;
  for (let index = 0; index < bytes.length; index += 1)
    accumulator += index & 1 ? bytes[index] : bytes[index] << 8;
  accumulator += (accumulator >> 16) & 0xffff;
  const keyTag = accumulator & 0xffff;
  return {
    bytes,
    info: {
      flags,
      protocol,
      algorithm,
      keyTag,
      publicKeyBytes: publicKey.length,
    },
  };
}

export async function generateDsRecord(
  owner: string,
  dnskey: string,
  digestType: 2 | 4,
): Promise<{ info: DnskeyInfo; record: string; digest: string }> {
  const { bytes, info } = dnskeyRdata(dnskey);
  const ownerBytes = dnsNameToWire(owner);
  const input = new Uint8Array(ownerBytes.length + bytes.length);
  input.set(ownerBytes);
  input.set(bytes, ownerBytes.length);
  const digest = new Uint8Array(
    await crypto.subtle.digest(digestType === 2 ? 'SHA-256' : 'SHA-384', input),
  );
  const hex = [...digest]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return {
    info,
    digest: hex,
    record: `${owner.replace(/\.$/, '')}. IN DS ${info.keyTag} ${info.algorithm} ${digestType} ${hex}`,
  };
}
