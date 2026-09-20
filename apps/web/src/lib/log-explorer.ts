export const LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'unknown',
] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogEntry = {
  line: number;
  raw: string;
  message: string;
  level: LogLevel;
  timestamp: number | null;
};
export type LogFilters = {
  keyword: string;
  level: string;
  from: number | null;
  to: number | null;
};
export type LogScanResult = {
  rows: LogEntry[];
  scannedLines: number;
  scannedBytes: number;
  matches: number;
  skippedLongLines: number;
  retainedBytes: number;
  limited: boolean;
  errorGroups: Array<{ message: string; count: number }>;
  groupsLimited: boolean;
};
export type LogWorkerResponse =
  | { type: 'progress'; bytes: number; lines: number }
  | { type: 'result'; result: LogScanResult }
  | { type: 'error'; error: string };
export const MAX_LOG_ROWS = 10_000;
export const MAX_LOG_RESULT_BYTES = 8 * 1024 * 1024;
export const MAX_LOG_LINE_LENGTH = 64 * 1024;
const CHUNK_BYTES = 256 * 1024;

export function parseLogEntry(raw: string, line: number): LogEntry {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      data = parsed as Record<string, unknown>;
  } catch {
    /* 普通文本逐行保留。 */
  }
  const messageValue = data.message ?? data.msg ?? data.log;
  const message = typeof messageValue === 'string' ? messageValue : raw;
  const levelValue = data.level ?? data.severity ?? data.loglevel;
  const numericLevels: Record<number, LogLevel> = {
    10: 'trace',
    20: 'debug',
    30: 'info',
    40: 'warn',
    50: 'error',
    60: 'fatal',
  };
  const detected =
    typeof levelValue === 'number'
      ? numericLevels[levelValue]
      : String(
          levelValue ??
            raw.match(
              /\b(TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|CRITICAL)\b/i,
            )?.[1] ??
            '',
        ).toLowerCase();
  const normalized =
    detected === 'warning'
      ? 'warn'
      : detected === 'critical'
        ? 'fatal'
        : detected;
  const level: LogLevel = LOG_LEVELS.includes(normalized as LogLevel)
    ? (normalized as LogLevel)
    : 'unknown';
  const timeValue =
    data.timestamp ??
    data.time ??
    data.ts ??
    data['@timestamp'] ??
    raw.match(
      /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/,
    )?.[0];
  const time =
    typeof timeValue === 'number'
      ? timeValue < 1e11
        ? timeValue * 1000
        : timeValue
      : typeof timeValue === 'string'
        ? Date.parse(timeValue)
        : NaN;
  return {
    raw,
    line,
    message,
    level,
    timestamp: Number.isFinite(time) ? time : null,
  };
}

export function matchesLog(entry: LogEntry, filters: LogFilters): boolean {
  return (
    (filters.level === 'all' || filters.level === entry.level) &&
    (!filters.keyword ||
      entry.raw.toLowerCase().includes(filters.keyword.toLowerCase())) &&
    (filters.from === null ||
      (entry.timestamp !== null && entry.timestamp >= filters.from)) &&
    (filters.to === null ||
      (entry.timestamp !== null && entry.timestamp <= filters.to))
  );
}

export function errorSignature(message: string): string {
  return message
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '<id>')
    .replace(/\b\d+(?:\.\d+)*\b/g, '<n>')
    .slice(0, 500);
}

// ponytail: 扫描全文件，但只保留前 1 万条 / 8 MiB 命中；需要任意跳转时再加字节索引。
export async function scanLogFile(
  file: Blob,
  filters: LogFilters,
  progress?: (bytes: number, lines: number) => void,
): Promise<LogScanResult> {
  const result: LogScanResult = {
    rows: [],
    scannedLines: 0,
    scannedBytes: 0,
    matches: 0,
    skippedLongLines: 0,
    retainedBytes: 0,
    limited: false,
    errorGroups: [],
    groupsLimited: false,
  };
  const groups = new Map<string, number>();
  const decoder = new TextDecoder();
  let pending = '';
  let skipping = false;
  const consume = (raw: string): void => {
    result.scannedLines += 1;
    if (!raw.trim()) return;
    if (raw.length > MAX_LOG_LINE_LENGTH) {
      result.skippedLongLines += 1;
      return;
    }
    const entry = parseLogEntry(raw.replace(/\r$/, ''), result.scannedLines);
    if (!matchesLog(entry, filters)) return;
    result.matches += 1;
    if (entry.level === 'error' || entry.level === 'fatal') {
      const key = errorSignature(entry.message);
      if (groups.has(key) || groups.size < 1000)
        groups.set(key, (groups.get(key) ?? 0) + 1);
      else result.groupsLimited = true;
    }
    const bytes = raw.length * 2;
    if (
      !result.limited &&
      result.rows.length < MAX_LOG_ROWS &&
      result.retainedBytes + bytes <= MAX_LOG_RESULT_BYTES
    ) {
      result.rows.push(entry);
      result.retainedBytes += bytes;
    } else result.limited = true;
  };
  for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) {
    const bytes = await file.slice(offset, offset + CHUNK_BYTES).arrayBuffer();
    const chunk = decoder.decode(bytes, {
      stream: offset + CHUNK_BYTES < file.size,
    });
    let start = 0;
    for (
      let index = chunk.indexOf('\n');
      index !== -1;
      index = chunk.indexOf('\n', start)
    ) {
      if (skipping) {
        result.scannedLines += 1;
        skipping = false;
      } else consume(pending + chunk.slice(start, index));
      pending = '';
      start = index + 1;
    }
    if (!skipping) {
      pending += chunk.slice(start);
      if (pending.length > MAX_LOG_LINE_LENGTH) {
        pending = '';
        skipping = true;
        result.skippedLongLines += 1;
      }
    }
    result.scannedBytes = Math.min(offset + bytes.byteLength, file.size);
    progress?.(result.scannedBytes, result.scannedLines);
  }
  if (skipping) result.scannedLines += 1;
  else if (pending) consume(pending);
  result.errorGroups = [...groups]
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  return result;
}
