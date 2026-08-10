export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export type ParsedRequest = {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body: string | null;
};

function stripQuotes(value: string): string {
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const normalized = input
    .replace(/\\\r?\n/g, ' ')
    .replace(/\r?\n/g, ' ')
    .trim();
  const regex = /'([^']*)'|"([^"\\]|\\.)*"|[^\s]+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(normalized))) {
    tokens.push(stripQuotes(match[0].replace(/\\"/g, '"')));
  }
  return tokens;
}

export function parseCurl(input: string): ParsedRequest {
  const text = input.trim();
  if (!text) throw new Error('请粘贴 curl 命令');
  if (!/(?:^|\s)curl(?:\s|$)/i.test(text) && !text.startsWith('curl')) {
    // 允许直接粘贴无 curl 前缀的参数串，但通常以 curl 开头
  }

  const tokens = tokenize(text);
  if (tokens[0]?.toLowerCase() === 'curl') tokens.shift();

  let method: HttpMethod | null = null;
  let url = '';
  const headers: Record<string, string> = {};
  let body: string | null = null;
  let dataAsJson = false;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    const next = () => {
      const value = tokens[++i];
      if (value == null) throw new Error(`缺少参数：${token}`);
      return value;
    };

    if (token === '-X' || token === '--request') {
      method = next().toUpperCase() as HttpMethod;
      continue;
    }
    if (token === '-H' || token === '--header') {
      const header = next();
      const idx = header.indexOf(':');
      if (idx === -1) continue;
      const key = header.slice(0, idx).trim();
      const value = header.slice(idx + 1).trim();
      headers[key] = value;
      continue;
    }
    if (
      token === '-d' ||
      token === '--data' ||
      token === '--data-raw' ||
      token === '--data-binary' ||
      token === '--data-ascii'
    ) {
      body = next();
      if (!method) method = 'POST';
      continue;
    }
    if (token === '--json') {
      body = next();
      dataAsJson = true;
      if (!method) method = 'POST';
      continue;
    }
    if (token === '-u' || token === '--user') {
      const cred = next();
      headers.Authorization = `Basic ${btoa(cred)}`;
      continue;
    }
    if (token === '-A' || token === '--user-agent') {
      headers['User-Agent'] = next();
      continue;
    }
    if (token === '-e' || token === '--referer') {
      headers.Referer = next();
      continue;
    }
    if (token.startsWith('-') || token.startsWith('--')) {
      // 忽略其余布尔/未知参数
      if (
        ![
          '-s',
          '--silent',
          '-S',
          '--show-error',
          '-L',
          '--location',
          '-k',
          '--insecure',
          '-i',
          '--include',
          '-v',
          '--verbose',
          '-g',
          '--globoff',
          '--compressed',
        ].includes(token) &&
        !token.includes('=')
      ) {
        // 带值的未知选项跳过下一个 token
        if (tokens[i + 1] && !tokens[i + 1]!.startsWith('-')) i += 1;
      }
      continue;
    }
    if (!url) url = token;
  }

  if (!url) throw new Error('未解析到 URL');
  if (dataAsJson && !Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = 'application/json';
  }
  if (body && !Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  return {
    method: method ?? 'GET',
    url,
    headers,
    body,
  };
}

function escapeJs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

function headersObjectLiteral(headers: Record<string, string>): string {
  const entries = Object.entries(headers);
  if (entries.length === 0) return '{}';
  return `{\n${entries
    .map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
    .join('\n')}\n  }`;
}

export function toFetch(request: ParsedRequest): string {
  const hasBody = request.body != null && request.method !== 'GET' && request.method !== 'HEAD';
  const lines = [
    `fetch(${JSON.stringify(request.url)}, {`,
    `  method: ${JSON.stringify(request.method)},`,
  ];
  if (Object.keys(request.headers).length > 0) {
    lines.push(`  headers: ${headersObjectLiteral(request.headers)},`);
  }
  if (hasBody) {
    lines.push(`  body: ${JSON.stringify(request.body)},`);
  }
  lines.push('});');
  return lines.join('\n');
}

export function toAxios(request: ParsedRequest): string {
  const hasBody = request.body != null && request.method !== 'GET' && request.method !== 'HEAD';
  const lines = [
    'axios({',
    `  url: ${JSON.stringify(request.url)},`,
    `  method: ${JSON.stringify(request.method.toLowerCase())},`,
  ];
  if (Object.keys(request.headers).length > 0) {
    lines.push(`  headers: ${headersObjectLiteral(request.headers)},`);
  }
  if (hasBody) {
    const contentType =
      Object.entries(request.headers).find(
        ([key]) => key.toLowerCase() === 'content-type',
      )?.[1] ?? '';
    if (contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(request.body ?? '');
        lines.push(`  data: ${JSON.stringify(parsed, null, 2).replace(/\n/g, '\n  ')},`);
      } catch {
        lines.push(`  data: ${JSON.stringify(request.body)},`);
      }
    } else {
      lines.push(`  data: ${JSON.stringify(request.body)},`);
    }
  }
  lines.push('});');
  return lines.join('\n');
}

export function toCurl(request: ParsedRequest): string {
  const parts = [`curl -X ${request.method}`];
  for (const [key, value] of Object.entries(request.headers)) {
    parts.push(`-H ${JSON.stringify(`${key}: ${value}`)}`);
  }
  if (request.body != null && request.method !== 'GET' && request.method !== 'HEAD') {
    parts.push(`--data-raw ${JSON.stringify(request.body)}`);
  }
  parts.push(JSON.stringify(request.url));
  return parts.join(' \\\n  ');
}

/** 从简单 fetch(...) 代码中尽力提取请求（覆盖常见手写形态） */
export function parseFetchLike(input: string): ParsedRequest {
  const text = input.trim();
  const urlMatch =
    text.match(/fetch\s*\(\s*([`'"])([\s\S]*?)\1/) ??
    text.match(/url\s*:\s*([`'"])([\s\S]*?)\1/);
  if (!urlMatch) throw new Error('未能解析 URL，请粘贴 curl 或 fetch 代码');

  const methodMatch = text.match(/method\s*:\s*([`'"])(\w+)\1/i);
  const method = (methodMatch?.[2]?.toUpperCase() ?? 'GET') as HttpMethod;
  const headers: Record<string, string> = {};
  const headerBlock = text.match(/headers\s*:\s*\{([\s\S]*?)\}/);
  if (headerBlock) {
    const entryRegex = /([`'"])(.+?)\1\s*:\s*([`'"])([\s\S]*?)\3/g;
    let entry: RegExpExecArray | null;
    while ((entry = entryRegex.exec(headerBlock[1]!))) {
      headers[entry[2]!] = entry[4]!;
    }
  }
  const bodyMatch =
    text.match(/body\s*:\s*([`'"])([\s\S]*?)\1/) ??
    text.match(/data\s*:\s*([`'"])([\s\S]*?)\1/);
  let body = bodyMatch?.[2] ?? null;
  if (!body) {
    const jsonData = text.match(/data\s*:\s*(\{[\s\S]*\})\s*,?\s*(?:\n|})/);
    if (jsonData) body = jsonData[1]!;
  }

  return {
    method,
    url: urlMatch[2]!,
    headers,
    body,
  };
}

export function convertHttpSnippet(
  input: string,
  target: 'fetch' | 'axios' | 'curl',
): string {
  const trimmed = input.trim();
  let request: ParsedRequest;
  if (/^\s*curl\b/i.test(trimmed) || trimmed.includes(' -H ') || trimmed.includes(' --data')) {
    try {
      request = parseCurl(trimmed.startsWith('curl') ? trimmed : `curl ${trimmed}`);
    } catch {
      request = parseFetchLike(trimmed);
    }
  } else {
    request = parseFetchLike(trimmed);
  }

  if (target === 'fetch') return toFetch(request);
  if (target === 'axios') return toAxios(request);
  return toCurl(request);
}

// 避免未使用告警（模板字符串转义辅助在复杂场景可复用）
void escapeJs;
