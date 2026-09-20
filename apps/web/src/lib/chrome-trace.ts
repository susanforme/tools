import {
  reportObject,
  reportPreview,
  reportText,
} from './observability-report';
import {
  dictionary,
  finiteTime,
  performanceJson,
  requiredArray,
} from './performance-reports';
export type ChromeTraceEvent = {
  id: number;
  name: string;
  category: string;
  thread: string;
  pid: string;
  tid: string;
  phase: string;
  start: number;
  duration: number | null;
  depth: number;
  args: string;
  task: boolean;
  incomplete: boolean;
};
export type ChromeTraceReport = {
  events: ChromeTraceEvent[];
  threads: Array<{ key: string; name: string }>;
  duration: number;
  start: number;
  unsupported: number;
  unmatched: number;
};
export function parseChromeTrace(source: string): ChromeTraceReport {
  const root = performanceJson(source);
  const raw = requiredArray(
    Array.isArray(root) ? root : reportObject(root).traceEvents,
  );
  if (raw.length > 200_000) throw new Error('limit');
  const names = new Map<string, string>();
  const processNames = new Map<string, string>();
  const stacks = new Map<string, ChromeTraceEvent[]>();
  const result: ChromeTraceReport = {
    events: [],
    threads: [],
    duration: 0,
    start: 0,
    unsupported: 0,
    unmatched: 0,
  };
  const input = raw
    .map((value, index) => {
      const event = reportObject(value);
      return {
        event,
        index,
        ts: event.ts === undefined ? 0 : finiteTime(event.ts),
      };
    })
    .sort((a, b) => a.ts - b.ts || a.index - b.index);
  for (const { event, index, ts } of input) {
    const pid = String(event.pid ?? 0),
      tid = String(event.tid ?? 0);
    const thread = JSON.stringify([pid, tid]);
    const phase = reportText(event.ph);
    const name = reportText(event.name);
    if (phase === 'M') {
      const args = dictionary(event.args);
      if (name === 'thread_name') names.set(thread, reportText(args.name));
      if (name === 'process_name') processNames.set(pid, reportText(args.name));
      continue;
    }
    if (!['X', 'B', 'E', 'I', 'i', 'R', 'C'].includes(phase)) {
      result.unsupported++;
      continue;
    }
    if (event.ts === undefined) throw new Error('invalidFormat');
    const stack = stacks.get(thread) ?? [];
    stacks.set(thread, stack);
    if (phase === 'E') {
      const begin = stack.pop();
      if (!begin) {
        result.unmatched++;
        continue;
      }
      if (ts < begin.start) throw new Error('invalidFormat');
      begin.duration = (ts - begin.start) / 1000;
      begin.incomplete = false;
      continue;
    }
    const duration = phase === 'X' ? finiteTime(event.dur) / 1000 : null;
    if (duration !== null && duration < 0) throw new Error('invalidFormat');
    const item: ChromeTraceEvent = {
      id: index,
      name,
      category: reportText(event.cat),
      thread,
      pid,
      tid,
      phase,
      start: ts,
      duration,
      depth: stack.length,
      args: reportPreview(event.args ?? {}),
      task: /^(RunTask|ThreadControllerImpl::RunTask|ThreadPool_RunTask|TaskQueueManager::ProcessTaskFromWorkQueue)$/.test(
        name,
      ),
      incomplete: phase === 'B',
    };
    result.events.push(item);
    if (phase === 'B') stack.push(item);
  }
  for (const stack of stacks.values()) result.unmatched += stack.length;
  if (result.events.length) {
    const start = result.events[0].start;
    let end = start;
    for (const event of result.events) {
      end = Math.max(end, event.start + (event.duration ?? 0) * 1000);
      event.start = (event.start - start) / 1000;
    }
    result.start = start;
    result.duration = (end - start) / 1000;
  }
  const threads = new Map<string, ChromeTraceEvent>();
  for (const event of result.events)
    if (!threads.has(event.thread)) threads.set(event.thread, event);
  if (threads.size > 5000) throw new Error('limit');
  result.threads = [...threads].map(([key, event]) => ({
    key,
    name: `${processNames.get(event.pid) ?? event.pid} / ${names.get(key) ?? event.tid}`,
  }));
  return result;
}
