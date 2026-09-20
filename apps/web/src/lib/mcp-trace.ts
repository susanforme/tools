// mcp-tape v1: https://mcpreplay.dev/docs/format
export type TraceMessage = {
  t: string;
  dir: 'in' | 'out';
  raw: Record<string, unknown>;
};

export type TraceCall = {
  key: string;
  session: string;
  id: string | number | null;
  method: string;
  status: 'success' | 'error' | 'pending' | 'notification' | 'unmatched';
  duration: number | null;
  request: TraceMessage | null;
  response: TraceMessage | null;
};

export type TraceAnalysis = { calls: TraceCall[]; skipped: number };
export type TraceSource = { name: string; text: string };
export const TRACE_BYTE_LIMIT = 10 * 1024 * 1024;
const RECORD_LIMIT = 20_000;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function identifier(value: unknown): value is string | number {
  return (
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

export function analyzeMcpTraces(sources: TraceSource[]): TraceAnalysis {
  const calls: TraceCall[] = [];
  let skipped = 0;
  let records = 0;
  for (const [sourceIndex, source] of sources.entries()) {
    // 不同文件及双向请求的同名 ID 必须分别配对。
    const pending = new Map<string, TraceCall>();
    let session = source.name;
    for (const [lineIndex, line] of source.text
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .entries()) {
      if (!line.trim()) continue;
      if (++records > RECORD_LIMIT) throw new Error('recordLimit');
      if (line.length > 1_000_000) throw new Error('lineLimit');
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        throw new Error(`${source.name}:${lineIndex + 1}: invalidJson`);
      }
      if (!object(value))
        throw new Error(`${source.name}:${lineIndex + 1}: invalidRecord`);
      if (value.type === 'meta') {
        if (value.v !== 1) throw new Error('unsupportedVersion');
        pending.clear();
        session =
          typeof value.label === 'string'
            ? `${source.name} / ${value.label}`
            : source.name;
        continue;
      }
      if (value.type === 'end') {
        pending.clear();
        continue;
      }
      if (value.dir !== 'in' && value.dir !== 'out') {
        skipped++;
        continue;
      }
      if (
        !object(value.raw) ||
        value.raw.jsonrpc !== '2.0' ||
        typeof value.t !== 'string' ||
        !Number.isFinite(Date.parse(value.t))
      ) {
        throw new Error(`${source.name}:${lineIndex + 1}: invalidRecord`);
      }
      const message: TraceMessage = {
        t: value.t,
        dir: value.dir,
        raw: value.raw,
      };
      const raw = message.raw;
      const id = identifier(raw.id) ? raw.id : null;
      const key = `${sourceIndex}:${lineIndex}`;
      if (typeof raw.method === 'string') {
        if ('id' in raw && id === null) throw new Error('invalidId');
        const call: TraceCall = {
          key,
          session,
          id,
          method: raw.method,
          status: id === null ? 'notification' : 'pending',
          duration: null,
          request: message,
          response: null,
        };
        if (id !== null) {
          const pair = JSON.stringify([message.dir, id]);
          if (pending.has(pair)) throw new Error('duplicateId');
          pending.set(pair, call);
        }
        calls.push(call);
      } else if ('result' in raw !== 'error' in raw) {
        if (id === null && raw.id !== null) throw new Error('invalidId');
        const pair = JSON.stringify([message.dir === 'in' ? 'out' : 'in', id]);
        const call = id === null ? undefined : pending.get(pair);
        if (call) {
          const elapsed = Date.parse(message.t) - Date.parse(call.request!.t);
          call.response = message;
          call.duration = elapsed >= 0 ? elapsed : null;
          call.status =
            'error' in raw ||
            (object(raw.result) && raw.result.isError === true)
              ? 'error'
              : 'success';
          pending.delete(pair);
        } else {
          calls.push({
            key,
            session,
            id,
            method: '',
            status: 'unmatched',
            duration: null,
            request: null,
            response: message,
          });
        }
      } else {
        throw new Error(`${source.name}:${lineIndex + 1}: invalidRecord`);
      }
    }
  }
  return { calls, skipped };
}

export function exportMcpCalls(calls: TraceCall[]): string {
  return JSON.stringify(
    calls.map(
      ({ session, id, method, status, duration, request, response }) => ({
        session,
        id,
        method,
        status,
        duration,
        request,
        response,
      }),
    ),
    null,
    2,
  );
}
