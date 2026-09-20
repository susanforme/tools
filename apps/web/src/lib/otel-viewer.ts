import {
  readReportJson,
  reportArray,
  reportNumber,
  reportObject,
  reportPreview,
  reportText,
  type ReportObject,
} from './observability-report';
export type OtelSpan = {
  key: string;
  traceId: string;
  spanId: string;
  parentId: string;
  name: string;
  service: string;
  scope: string;
  start: string;
  end: string;
  durationMs: number;
  offsetMs: number;
  depth: number;
  issue: string;
  status: number;
  statusMessage: string;
  attributes: string;
  resource: string;
  events: string;
  links: string;
};
export type OtelTrace = {
  id: string;
  start: string;
  durationMs: number;
  spans: OtelSpan[];
  errors: number;
};
export type OtelReport = { traces: OtelTrace[]; spanCount: number };
function nano(value: unknown): bigint {
  if (typeof value === 'number' && !Number.isSafeInteger(value))
    throw new Error('precision');
  const input = typeof value === 'number' ? String(value) : reportText(value);
  if (!/^\d{1,20}$/.test(input)) throw new Error('invalidFormat');
  const result = BigInt(input);
  if (result > 18446744073709551615n) throw new Error('invalidFormat');
  return result;
}
function id(value: unknown, length: number, optional = false): string {
  const input = reportText(value).toLowerCase();
  if (optional && (!input || /^0+$/.test(input))) return '';
  if (!new RegExp(`^[a-f0-9]{${length}}$`).test(input) || /^0+$/.test(input))
    throw new Error('invalidFormat');
  return input;
}
function valueOf(raw: unknown, depth = 0): unknown {
  if (depth > 20) throw new Error('limit');
  const value = reportObject(raw);
  if (value.stringValue !== undefined) return reportText(value.stringValue);
  if (value.intValue !== undefined) {
    if (
      typeof value.intValue === 'number' &&
      !Number.isSafeInteger(value.intValue)
    )
      throw new Error('precision');
    return value.intValue;
  }
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.boolValue !== undefined) return value.boolValue;
  if (value.bytesValue !== undefined) return reportText(value.bytesValue);
  if (value.arrayValue !== undefined)
    return reportArray(reportObject(value.arrayValue).values).map((item) =>
      valueOf(item, depth + 1),
    );
  if (value.kvlistValue !== undefined)
    return attributes(reportObject(value.kvlistValue).values, depth + 1);
  return null;
}
function attributes(raw: unknown, depth = 0): ReportObject {
  return Object.fromEntries(
    reportArray(raw).map((item) => {
      const entry = reportObject(item);
      return [reportText(entry.key), valueOf(entry.value, depth)];
    }),
  );
}
export function parseOtel(source: string): OtelReport {
  const root = reportObject(readReportJson(source));
  if (!Array.isArray(root.resourceSpans)) throw new Error('invalidFormat');
  const traces = new Map<string, OtelSpan[]>();
  let spanCount = 0;
  for (const rawResource of root.resourceSpans) {
    const resource = reportObject(rawResource);
    const resourceAttrs = attributes(
      resource.resource === undefined
        ? undefined
        : reportObject(resource.resource).attributes,
    );
    const service =
      typeof resourceAttrs['service.name'] === 'string'
        ? resourceAttrs['service.name']
        : '';
    for (const rawScope of reportArray(
      resource.scopeSpans ?? resource.instrumentationLibrarySpans,
    )) {
      const scope = reportObject(rawScope);
      const scopeData = scope.scope ?? scope.instrumentationLibrary;
      for (const rawSpan of reportArray(scope.spans)) {
        if (++spanCount > 50_000) throw new Error('limit');
        const span = reportObject(rawSpan);
        const traceId = id(span.traceId, 32);
        const spanId = id(span.spanId, 16);
        const start = nano(span.startTimeUnixNano);
        const end = nano(span.endTimeUnixNano);
        if (end < start) throw new Error('invalidFormat');
        const status =
          span.status === undefined ? {} : reportObject(span.status);
        const code = reportNumber(status.code) ?? 0;
        if (![0, 1, 2].includes(code)) throw new Error('invalidFormat');
        const item: OtelSpan = {
          key: `${traceId}:${spanId}`,
          traceId,
          spanId,
          parentId: id(span.parentSpanId, 16, true),
          name: reportText(span.name),
          service,
          scope:
            scopeData === undefined
              ? ''
              : reportText(reportObject(scopeData).name),
          start: String(start),
          end: String(end),
          durationMs: Number(end - start) / 1e6,
          offsetMs: 0,
          depth: 0,
          issue: '',
          status: code,
          statusMessage: reportText(status.message),
          attributes: reportPreview(attributes(span.attributes)),
          resource: reportPreview(resourceAttrs),
          events: reportPreview(reportArray(span.events)),
          links: reportPreview(reportArray(span.links)),
        };
        const items = traces.get(traceId) ?? [];
        items.push(item);
        traces.set(traceId, items);
      }
    }
  }
  if (traces.size > 5000) throw new Error('limit');
  return {
    spanCount,
    traces: [...traces].map(([traceId, spans]) => {
      const byId = new Map(spans.map((span) => [span.spanId, span]));
      if (byId.size !== spans.length) throw new Error('duplicateSpan');
      const sorted = [...spans].sort((a, b) =>
        BigInt(a.start) < BigInt(b.start)
          ? -1
          : BigInt(a.start) > BigInt(b.start)
            ? 1
            : 0,
      );
      const start = BigInt(sorted[0].start);
      let end = start;
      const parent = new Map<string, string>();
      for (const span of sorted) {
        if (BigInt(span.end) > end) end = BigInt(span.end);
        span.offsetMs = Number(BigInt(span.start) - start) / 1e6;
        if (span.parentId && byId.has(span.parentId))
          parent.set(span.spanId, span.parentId);
        else if (span.parentId) span.issue = 'orphan';
      }
      // 每条父链仅遍历一次；切断环并保留所有 span。
      const done = new Set<string>();
      for (const span of sorted) {
        let current: string | undefined = span.spanId;
        const path = new Set<string>();
        while (current && !done.has(current)) {
          if (path.has(current)) {
            byId.get(current)!.issue = 'cycle';
            parent.delete(current);
            break;
          }
          path.add(current);
          current = parent.get(current);
        }
        for (const key of path) done.add(key);
      }
      const children = new Map<string, OtelSpan[]>();
      const roots: OtelSpan[] = [];
      for (const span of sorted) {
        const p = parent.get(span.spanId);
        if (!p) roots.push(span);
        else {
          const group = children.get(p) ?? [];
          group.push(span);
          children.set(p, group);
        }
      }
      const ordered: OtelSpan[] = [];
      const stack = roots.reverse().map((span) => ({ span, depth: 0 }));
      while (stack.length) {
        const { span, depth } = stack.pop()!;
        span.depth = depth;
        ordered.push(span);
        const group = children.get(span.spanId) ?? [];
        for (let i = group.length - 1; i >= 0; i--)
          stack.push({ span: group[i], depth: depth + 1 });
      }
      return {
        id: traceId,
        start: String(start),
        durationMs: Number(end - start) / 1e6,
        spans: ordered,
        errors: spans.filter((span) => span.status === 2).length,
      };
    }),
  };
}
