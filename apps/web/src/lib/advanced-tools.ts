import {
  base64ToBytes,
  bytesToBase64,
  isRecord,
  parseEnv,
} from './developer-tools';

export type SriAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

export async function createSri(
  bytes: Uint8Array,
  algorithm: SriAlgorithm,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    algorithm,
    new Uint8Array(bytes).buffer,
  );
  return `${algorithm.toLowerCase().replace('-', '')}-${bytesToBase64(
    new Uint8Array(digest),
  )}`;
}

export async function verifySri(
  bytes: Uint8Array,
  integrity: string,
): Promise<boolean> {
  const entries = integrity.trim().split(/\s+/);
  for (const entry of entries) {
    const match = entry.match(/^(sha(?:256|384|512))-(.+)$/i);
    if (!match) continue;
    const algorithm = `SHA-${match[1]!.slice(3)}` as SriAlgorithm;
    if ((await createSri(bytes, algorithm)) === entry) return true;
  }
  return false;
}

export type CodeLanguage = 'go' | 'rust' | 'python' | 'kotlin';

function words(value: string): string[] {
  return value.match(/[A-Za-z0-9]+/g) ?? ['value'];
}

function pascal(value: string): string {
  const result = words(value)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
  return /^\d/.test(result) ? `Type${result}` : result;
}

function snake(value: string): string {
  const result = words(value)
    .map((part) => part.toLowerCase())
    .join('_');
  return /^\d/.test(result) ? `field_${result}` : result;
}

function camel(value: string): string {
  const result = pascal(value);
  const next = result[0]!.toLowerCase() + result.slice(1);
  return /^\d/.test(next) ? `field${next}` : next;
}

function scalarType(value: unknown, language: CodeLanguage): string {
  if (value === null)
    return language === 'rust'
      ? 'serde_json::Value'
      : language === 'python'
        ? 'Any'
        : language === 'kotlin'
          ? 'Any?'
          : 'any';
  if (typeof value === 'string')
    return language === 'rust'
      ? 'String'
      : language === 'python'
        ? 'str'
        : language === 'kotlin'
          ? 'String'
          : 'string';
  if (typeof value === 'boolean')
    return language === 'python'
      ? 'bool'
      : language === 'kotlin'
        ? 'Boolean'
        : 'bool';
  if (typeof value === 'number') {
    if (language === 'go') return Number.isInteger(value) ? 'int' : 'float64';
    if (language === 'rust') return Number.isInteger(value) ? 'i64' : 'f64';
    if (language === 'python') return Number.isInteger(value) ? 'int' : 'float';
    return Number.isInteger(value) ? 'Int' : 'Double';
  }
  return language === 'python' ? 'Any' : language === 'kotlin' ? 'Any?' : 'any';
}

export function jsonToLanguageTypes(
  value: unknown,
  language: CodeLanguage,
  rootName = 'Root',
): string {
  const definitions: string[] = [];
  const render = (item: unknown, name: string): string => {
    if (Array.isArray(item)) {
      // ponytail: 用首个非 null 元素推断数组；需要混合联合类型时改用 JSON Schema。
      const sample = item.find((entry) => entry !== null) ?? null;
      const child = render(sample, `${name}Item`);
      if (language === 'go') return `[]${child}`;
      if (language === 'rust') return `Vec<${child}>`;
      if (language === 'python') return `list[${child}]`;
      return `List<${child}>`;
    }
    if (!isRecord(item)) return scalarType(item, language);
    const typeName = pascal(name);
    const fields = Object.entries(item).map(([key, entry]) => ({
      key,
      type: render(entry, `${typeName}${pascal(key)}`),
    }));
    if (language === 'go') {
      definitions.push(
        `type ${typeName} struct {\n${fields
          .map(({ key, type }) => `  ${pascal(key)} ${type} \`json:"${key}"\``)
          .join('\n')}\n}`,
      );
    } else if (language === 'rust') {
      definitions.push(
        `#[derive(Debug, Serialize, Deserialize)]\npub struct ${typeName} {\n${fields
          .map(({ key, type }) => {
            const field = snake(key);
            const rename =
              field === key
                ? ''
                : `  #[serde(rename = ${JSON.stringify(key)})]\n`;
            return `${rename}  pub ${field}: ${type},`;
          })
          .join('\n')}\n}`,
      );
    } else if (language === 'python') {
      definitions.push(
        `@dataclass\nclass ${typeName}:\n${
          fields.length
            ? fields
                .map(({ key, type }) => `    ${snake(key)}: ${type}`)
                .join('\n')
            : '    pass'
        }`,
      );
    } else {
      definitions.push(
        `@Serializable\ndata class ${typeName}(\n${fields
          .map(({ key, type }) => {
            const field = camel(key);
            const rename =
              field === key ? '' : `  @SerialName(${JSON.stringify(key)}) `;
            return `${rename}val ${field}: ${type},`;
          })
          .join('\n')}\n)`,
      );
    }
    return typeName;
  };
  render(value, rootName);
  const prefix =
    language === 'rust'
      ? 'use serde::{Deserialize, Serialize};\n\n'
      : language === 'python'
        ? 'from dataclasses import dataclass\nfrom typing import Any\n\n'
        : language === 'kotlin'
          ? 'import kotlinx.serialization.SerialName\nimport kotlinx.serialization.Serializable\n\n'
          : '';
  return prefix + definitions.join('\n\n');
}

export type ComposeIssue = {
  code: string;
  level: 'error' | 'warning';
  detail?: string;
};

export function inspectCompose(
  document: unknown,
  source: string,
  envText: string,
): ComposeIssue[] {
  const issues: ComposeIssue[] = [];
  if (!isRecord(document) || !isRecord(document.services)) {
    return [{ code: 'missingServices', level: 'error' }];
  }
  const services = Object.entries(document.services);
  if (!services.length) issues.push({ code: 'emptyServices', level: 'error' });
  const hostPorts = new Set<string>();
  for (const [name, service] of services) {
    if (!isRecord(service)) {
      issues.push({ code: 'invalidService', level: 'error', detail: name });
      continue;
    }
    if (!service.image && !service.build) {
      issues.push({ code: 'missingImage', level: 'warning', detail: name });
    }
    if (service.ports !== undefined && !Array.isArray(service.ports)) {
      issues.push({ code: 'invalidPorts', level: 'error', detail: name });
    }
    for (const port of Array.isArray(service.ports) ? service.ports : []) {
      const parts = String(port)
        .replace(/\/(tcp|udp)$/i, '')
        .split(':');
      const hostPort = parts.length > 1 ? parts.at(-2)! : '';
      if (!hostPort) continue;
      if (hostPorts.has(hostPort)) {
        issues.push({
          code: 'duplicatePort',
          level: 'error',
          detail: hostPort,
        });
      }
      hostPorts.add(hostPort);
    }
    if (service.volumes !== undefined && !Array.isArray(service.volumes)) {
      issues.push({ code: 'invalidVolumes', level: 'error', detail: name });
    }
  }
  const env = new Set(parseEnv(envText).map(({ key }) => key));
  for (const match of source.matchAll(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)([^}]*)\}/g,
  )) {
    if (!env.has(match[1]!) && !match[2]!.startsWith(':-')) {
      issues.push({ code: 'missingEnv', level: 'warning', detail: match[1] });
    }
  }
  return issues;
}

export type StructuredQrKind = 'vcard' | 'email' | 'sms' | 'tel' | 'geo';

export function structuredQrValue(
  kind: StructuredQrKind,
  fields: Record<string, string>,
): string {
  const required = (name: string) => {
    const value = fields[name]?.trim();
    if (!value) throw new Error(`MISSING_${name.toUpperCase()}`);
    return value;
  };
  if (kind === 'email') {
    const query = new URLSearchParams();
    if (fields.subject) query.set('subject', fields.subject);
    if (fields.body) query.set('body', fields.body);
    return `mailto:${required('email')}${query.size ? `?${query}` : ''}`;
  }
  if (kind === 'sms') return `SMSTO:${required('phone')}:${fields.body ?? ''}`;
  if (kind === 'tel') return `tel:${required('phone')}`;
  if (kind === 'geo') {
    const latitude = required('latitude');
    const longitude = required('longitude');
    return `geo:${latitude},${longitude}${fields.query ? `?q=${latitude},${longitude}(${encodeURIComponent(fields.query)})` : ''}`;
  }
  const escape = (value: string) =>
    value.replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escape(required('name'))}`,
    fields.phone ? `TEL:${escape(fields.phone)}` : '',
    fields.email ? `EMAIL:${escape(fields.email)}` : '',
    fields.organization ? `ORG:${escape(fields.organization)}` : '',
    fields.url ? `URL:${escape(fields.url)}` : '',
    fields.address ? `ADR:;;${escape(fields.address)};;;;` : '',
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\n');
}

export type HeaderFinding = {
  header: string;
  state: 'present' | 'missing' | 'warning';
  value: string;
};

export function inspectSecurityHeaders(input: string): HeaderFinding[] {
  const headers = new Map<string, string>();
  for (const line of input.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    headers.set(
      line.slice(0, separator).trim().toLowerCase(),
      line.slice(separator + 1).trim(),
    );
  }
  const expected = [
    'content-security-policy',
    'strict-transport-security',
    'x-content-type-options',
    'x-frame-options',
    'referrer-policy',
    'permissions-policy',
    'cross-origin-opener-policy',
    'cross-origin-resource-policy',
  ];
  return expected.map((header): HeaderFinding => {
    const value = headers.get(header) ?? '';
    if (!value) return { header, state: 'missing', value: '' };
    const weak =
      (header === 'content-security-policy' &&
        /'unsafe-(inline|eval)'/.test(value)) ||
      (header === 'strict-transport-security' &&
        !/max-age=(?:[3-9]\d{7}|[1-9]\d{8,})/i.test(value)) ||
      (header === 'x-content-type-options' &&
        value.toLowerCase() !== 'nosniff');
    return { header, state: weak ? 'warning' : 'present', value };
  });
}

export type ToolSuggestion = { path: string; code: string };

export function detectToolSuggestions(input: string): ToolSuggestion[] {
  const value = input.trim();
  if (!value) return [];
  const suggestions: ToolSuggestion[] = [];
  const add = (path: string, code: string) => {
    if (!suggestions.some((item) => item.path === path))
      suggestions.push({ path, code });
  };
  try {
    JSON.parse(value);
    add('/json', 'json');
  } catch {
    // 不是 JSON，继续检测其他格式。
  }
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value))
    add('/jwt', 'jwt');
  if (
    /-----BEGIN (?:CERTIFICATE|PUBLIC|PRIVATE|CERTIFICATE REQUEST)/.test(value)
  )
    add('/certificate-tool', 'pem');
  if (/^docker\s+run\b/.test(value)) add('/docker-compose', 'docker');
  if (/^(?:https?:\/\/|mailto:|tel:)/i.test(value)) add('/url-encode', 'url');
  if (/^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/.test(value))
    add('/ip-lookup', 'ipv4');
  if (value.includes(':') && /^[0-9a-f:]+(?:\/\d{1,3})?$/i.test(value))
    add('/ipv6', 'ipv6');
  if (/^(?:[0-9a-f]{2}[\s:-]?){6}$/i.test(value))
    add('/ip-lookup?tab=mac', 'mac');
  if (/^[0-9a-f\s]+$/i.test(value) && value.replace(/\s/g, '').length >= 8)
    add('/hex-inspector', 'hex');
  if (
    value.length >= 16 &&
    value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    try {
      atob(value);
      add('/base64', 'base64');
    } catch {
      // 非法 Base64。
    }
  }
  return suggestions.slice(0, 4);
}

export const PIPELINE_OPERATIONS = [
  'base64-encode',
  'base64-decode',
  'url-encode',
  'url-decode',
  'hex-encode',
  'hex-decode',
  'json-format',
  'json-minify',
  'uppercase',
  'lowercase',
  'sha256',
] as const;

export type PipelineOperation = (typeof PIPELINE_OPERATIONS)[number];

export async function runPipeline(
  input: string,
  operations: PipelineOperation[],
): Promise<string> {
  let output = input;
  for (const operation of operations) {
    if (operation === 'base64-encode')
      output = bytesToBase64(new TextEncoder().encode(output));
    else if (operation === 'base64-decode')
      output = new TextDecoder('utf-8', { fatal: true }).decode(
        base64ToBytes(output),
      );
    else if (operation === 'url-encode') output = encodeURIComponent(output);
    else if (operation === 'url-decode') output = decodeURIComponent(output);
    else if (operation === 'hex-encode')
      output = [...new TextEncoder().encode(output)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    else if (operation === 'hex-decode') {
      const compact = output.replace(/\s/g, '');
      if (!/^(?:[0-9a-f]{2})+$/i.test(compact)) throw new Error('INVALID_HEX');
      output = new TextDecoder('utf-8', { fatal: true }).decode(
        Uint8Array.from(compact.match(/.{2}/g)!, (pair) => parseInt(pair, 16)),
      );
    } else if (operation === 'json-format')
      output = JSON.stringify(JSON.parse(output), null, 2);
    else if (operation === 'json-minify')
      output = JSON.stringify(JSON.parse(output));
    else if (operation === 'uppercase') output = output.toUpperCase();
    else if (operation === 'lowercase') output = output.toLowerCase();
    else {
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(output),
      );
      output = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    }
  }
  return output;
}

export type WebhookProvider = 'github' | 'stripe' | 'generic';

async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function createWebhookSignature(
  provider: WebhookProvider,
  payload: string,
  secret: string,
  timestamp: string,
): Promise<string> {
  const signature = await hmacHex(
    secret,
    provider === 'stripe' ? `${timestamp}.${payload}` : payload,
  );
  if (provider === 'github') return `sha256=${signature}`;
  if (provider === 'stripe') return `t=${timestamp},v1=${signature}`;
  return signature;
}

export async function verifyWebhookSignature(
  provider: WebhookProvider,
  payload: string,
  secret: string,
  timestamp: string,
  received: string,
): Promise<boolean> {
  const expected = await createWebhookSignature(
    provider,
    payload,
    secret,
    timestamp,
  );
  if (expected.length !== received.trim().length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |=
      expected.charCodeAt(index) ^ received.trim().charCodeAt(index);
  }
  return difference === 0;
}
