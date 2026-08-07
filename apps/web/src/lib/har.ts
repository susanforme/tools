export type HarEntry = {
  startedAt: number;
  duration: number;
  method: string;
  url: string;
  domain: string;
  status: number;
  statusText: string;
  mimeType: string;
  size: number;
  requestHeaders: Array<{ name: string; value: string }>;
  responseHeaders: Array<{ name: string; value: string }>;
  timings: Record<string, number>;
};

export type HarAnalysis = {
  entries: HarEntry[];
  startedAt: number;
  endedAt: number;
  failures: number;
  totalBytes: number;
  domains: Array<{ name: string; count: number; bytes: number }>;
  mimeTypes: Array<{ name: string; count: number; bytes: number }>;
};

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'proxy-authorization',
  'set-cookie',
  'x-api-key',
]);
const SENSITIVE_QUERY = /token|secret|password|passwd|api[_-]?key|auth/i;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('HAR 数据格式无效');
  }
  return value as Record<string, unknown>;
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function headers(value: unknown): Array<{ name: string; value: string }> {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const header = object(item);
    const name = text(header.name);
    return {
      name,
      value: SENSITIVE_HEADERS.has(name.toLowerCase())
        ? '••••••••'
        : text(header.value),
    };
  });
}

export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.searchParams.forEach((_, key) => {
      if (SENSITIVE_QUERY.test(key)) url.searchParams.set(key, '••••••••');
    });
    return url.toString();
  } catch {
    return value;
  }
}

function group(
  entries: HarEntry[],
  getName: (entry: HarEntry) => string,
): Array<{ name: string; count: number; bytes: number }> {
  const values = new Map<string, { count: number; bytes: number }>();
  entries.forEach((entry) => {
    const name = getName(entry) || 'unknown';
    const current = values.get(name) ?? { count: 0, bytes: 0 };
    current.count += 1;
    current.bytes += entry.size;
    values.set(name, current);
  });
  return [...values.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.bytes - a.bytes);
}

export function parseHar(source: string): HarAnalysis {
  const root = object(JSON.parse(source));
  const log = object(root.log);
  if (!Array.isArray(log.entries)) throw new Error('HAR 中没有请求记录');

  const entries = log.entries.map((raw): HarEntry => {
    const entry = object(raw);
    const request = object(entry.request);
    const response = object(entry.response);
    const content = object(response.content ?? {});
    const startedAt = Date.parse(text(entry.startedDateTime));
    const url = redactUrl(text(request.url));
    let domain = '';
    try {
      domain = new URL(url).host;
    } catch {
      domain = url;
    }
    const bodySize = Math.max(number(response.bodySize), 0);
    const contentSize = Math.max(number(content.size), 0);
    const transferSize = Math.max(number(response._transferSize), 0);
    const timingSource = object(entry.timings ?? {});
    const timings = Object.fromEntries(
      ['blocked', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive'].map(
        (name) => [name, Math.max(number(timingSource[name]), 0)],
      ),
    );
    return {
      startedAt: Number.isFinite(startedAt) ? startedAt : 0,
      duration: Math.max(number(entry.time), 0),
      method: text(request.method),
      url,
      domain,
      status: number(response.status),
      statusText: text(response.statusText),
      mimeType: text(content.mimeType).split(';')[0] ?? '',
      size: transferSize || bodySize || contentSize,
      requestHeaders: headers(request.headers),
      responseHeaders: headers(response.headers),
      timings,
    };
  });
  const times = entries.filter((entry) => entry.startedAt > 0);
  const startedAt = times.length
    ? Math.min(...times.map((entry) => entry.startedAt))
    : 0;
  const endedAt = times.length
    ? Math.max(...times.map((entry) => entry.startedAt + entry.duration))
    : 0;
  return {
    entries,
    startedAt,
    endedAt,
    failures: entries.filter(
      (entry) => entry.status === 0 || entry.status >= 400,
    ).length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.size, 0),
    domains: group(entries, (entry) => entry.domain),
    mimeTypes: group(entries, (entry) => entry.mimeType),
  };
}
