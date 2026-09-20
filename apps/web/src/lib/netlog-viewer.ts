import { reportObject, reportPreview } from './observability-report';
import {
  dictionary,
  finiteTime,
  performanceJson,
  requiredArray,
} from './performance-reports';
export type NetlogEvent = {
  index: number;
  source: string;
  type: string;
  phase: string;
  time: number;
  rawTime: string;
  params: string;
  errors: string[];
  related: string[];
};
export type NetlogReport = {
  sources: Array<{
    id: string;
    type: string;
    count: number;
    errors: number;
    related: string[];
  }>;
  events: NetlogEvent[];
  offset: string;
  version: string;
};
function reverse(value: unknown): Map<string, string> {
  return new Map(
    Object.entries(dictionary(value)).map(([key, value]) => [
      String(value),
      key,
    ]),
  );
}
export function parseNetlog(source: string): NetlogReport {
  const root = reportObject(performanceJson(source));
  const raw = requiredArray(root.events);
  const constants = reportObject(root.constants);
  if (raw.length > 200_000) throw new Error('limit');
  const types = reverse(constants.logEventTypes),
    sourceTypes = reverse(constants.logSourceType),
    phases = reverse(constants.logEventPhase),
    errors = reverse(constants.netError);
  const sourceMap = new Map<string, NetlogReport['sources'][number]>();
  let min = Infinity;
  const events = raw
    .map((rawEvent, index): NetlogEvent => {
      const event = reportObject(rawEvent);
      const src = reportObject(event.source);
      const id = String(src.id);
      if (src.id === undefined || !/^[0-9]+$/.test(id))
        throw new Error('invalidFormat');
      const time = finiteTime(event.time);
      min = Math.min(min, time);
      const related = new Set<string>();
      const eventErrors = new Set<string>();
      const stack: Array<[string, unknown]> = Object.entries(
        dictionary(event.params),
      );
      while (stack.length) {
        const [key, value] = stack.pop()!;
        if (
          key === 'source_dependency' &&
          value &&
          typeof value === 'object' &&
          !Array.isArray(value)
        ) {
          const dependency = reportObject(value);
          if (dependency.id !== undefined) related.add(String(dependency.id));
        }
        if (
          (key === 'net_error' || key === 'error') &&
          typeof value === 'number' &&
          value < 0
        )
          eventErrors.add(errors.get(String(value)) ?? String(value));
        if (/error/i.test(key) && typeof value === 'string' && value)
          eventErrors.add(value.slice(0, 2000));
        if (value && typeof value === 'object')
          for (const entry of Object.entries(value)) stack.push(entry);
      }
      const summary = sourceMap.get(id) ?? {
        id,
        type: sourceTypes.get(String(src.type)) ?? String(src.type ?? ''),
        count: 0,
        errors: 0,
        related: [],
      };
      summary.count++;
      if (eventErrors.size) summary.errors++;
      summary.related.push(...related);
      sourceMap.set(id, summary);
      return {
        index,
        source: id,
        type: types.get(String(event.type)) ?? String(event.type ?? ''),
        phase: phases.get(String(event.phase)) ?? String(event.phase ?? ''),
        time,
        rawTime: String(event.time),
        params: reportPreview(event.params ?? {}),
        errors: [...eventErrors],
        related: [...related],
      };
    })
    .sort((a, b) => a.time - b.time || a.index - b.index);
  if (sourceMap.size > 20_000) throw new Error('limit');
  for (const event of events) event.time -= min;
  const associations = new Map(
    [...sourceMap.values()].map((summary) => [
      summary.id,
      new Set(summary.related),
    ]),
  );
  // 关联方向保留为双向导航；同一文件的 Source ID 全局唯一。
  for (const [source, related] of associations)
    for (const id of related) associations.get(id)?.add(source);
  for (const summary of sourceMap.values())
    summary.related = [...associations.get(summary.id)!];
  return {
    sources: [...sourceMap.values()],
    events,
    offset:
      constants.timeTickOffset === undefined
        ? ''
        : String(constants.timeTickOffset),
    version: String(constants.logFormatVersion ?? ''),
  };
}
