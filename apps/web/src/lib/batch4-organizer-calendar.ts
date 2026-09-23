import type ICAL from 'ical.js';
export type CalendarMergeRequest = {
  sources: string[];
  from: string;
  to: string;
  filter: string;
};
export type MergeOccurrence = {
  title: string;
  start: number;
  end: number;
  uid: string;
};
export type CalendarMergeResult = {
  ics: string;
  duplicates: number;
  events: number;
  occurrences: MergeOccurrence[];
  conflicts: [number, number][];
  free: { start: number; end: number }[];
};
export async function mergeCalendars(
  request: CalendarMergeRequest,
): Promise<CalendarMergeResult> {
  const { sources, filter } = request;
  const from = Date.parse(request.from),
    to = Date.parse(request.to);
  if (
    !sources.length ||
    sources.length > 20 ||
    sources.reduce((s, x) => s + new TextEncoder().encode(x).length, 0) > 1e6
  )
    throw Error('calendarSize');
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    to <= from ||
    to - from > 31 * 864e5
  )
    throw Error('calendarRange');
  const { default: Ical } = await import('ical.js');
  const merged = new Ical.Component(['vcalendar', [], []]);
  merged.addPropertyWithValue('version', '2.0');
  merged.addPropertyWithValue('prodid', '-//Local tools//Calendar merge//EN');
  const keys = new Map<string, string>();
  let duplicates = 0;
  let count = 0;
  for (const source of sources) {
    const root = new Ical.Component(Ical.parse(source));
    if (root.name !== 'vcalendar') throw Error('calendarInvalid');
    for (const c of [...root.getAllSubcomponents()]) {
      if (++count > 1000) throw Error('calendarSize');
      let key: string | null = null;
      if (c.name === 'vtimezone') {
        key = `tz:${c.getFirstPropertyValue('tzid')}`;
      } else if (c.name === 'vevent') {
        const uid = c.getFirstPropertyValue('uid');
        if (typeof uid !== 'string' || !uid) throw Error('calendarInvalid');
        key = `event:${uid}:${String(c.getFirstPropertyValue('recurrence-id') ?? '')}`;
      }
      const serialized = c.toString();
      if (key && keys.has(key)) {
        if (keys.get(key) !== serialized) throw Error('calendarCollision');
        duplicates++;
        continue;
      }
      if (key) keys.set(key, serialized);
      root.removeSubcomponent(c);
      merged.addSubcomponent(c);
    }
  }
  const components = merged.getAllSubcomponents('vevent');
  if (components.length > 200) throw Error('calendarSize');
  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const c of components) {
    if (!c.hasProperty('dtstart')) throw Error('calendarInvalid');
    for (const p of c.getAllProperties()) {
      if (p.type === 'date' || p.type === 'date-time') {
        for (const value of p.toJSON().slice(3) as unknown[]) {
          if (
            typeof value !== 'string' ||
            Ical.Time.fromString(value, null).toString() !== value
          )
            throw Error('calendarInvalid');
        }
      }
      if (p.type === 'recur') {
        for (const raw of p.toJSON().slice(3) as unknown[]) {
          if (!raw || typeof raw !== 'object') throw Error('calendarInvalid');
          const rule = raw as Record<string, unknown>;
          if (
            !rule.freq ||
            (rule.count !== undefined && rule.until !== undefined)
          )
            throw Error('calendarInvalid');
          for (const key of ['count', 'interval'])
            if (
              rule[key] !== undefined &&
              (!Number.isInteger(rule[key]) || Number(rule[key]) < 1)
            )
              throw Error('calendarInvalid');
        }
      }
      const tz = p.getParameter('tzid');
      if (
        tz &&
        tz !== 'UTC' &&
        (typeof tz !== 'string' || !merged.getTimeZoneByID(tz))
      )
        throw Error('calendarZone');
      if (p.name === 'recurrence-id' && p.getParameter('range'))
        throw Error('calendarUnsupported');
      if (p.name === 'rdate' && p.type === 'period')
        throw Error('calendarUnsupported');
    }
    const e = new Ical.Event(c, { exceptions: [], strictExceptions: true });
    if (
      !Number.isFinite(e.startDate.toUnixTime()) ||
      e.duration.toSeconds() < 0
    )
      throw Error('calendarInvalid');
    if (e.isRecurrenceException()) exceptions.push(e);
    else masters.set(e.uid, e);
  }
  for (const e of exceptions) {
    const master = masters.get(e.uid);
    if (!master) throw Error('calendarInvalid');
    master.relateException(e);
  }
  const selected = new Set(
    [...masters.values()]
      .filter(
        (e) =>
          !filter || e.summary.toLowerCase().includes(filter.toLowerCase()),
      )
      .map((e) => e.uid),
  );
  for (const c of components) {
    if (!selected.has(String(c.getFirstPropertyValue('uid'))))
      merged.removeSubcomponent(c);
  }
  const occurrences: MergeOccurrence[] = [];
  const append = (e: ICAL.Event, start: ICAL.Time, end: ICAL.Time) => {
    if (
      e.component.getFirstPropertyValue('status') === 'CANCELLED' ||
      e.component.getFirstPropertyValue('transp') === 'TRANSPARENT'
    )
      return;
    const a = start.toJSDate().getTime(),
      b = end.toJSDate().getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a)
      throw Error('calendarInvalid');
    if (a < b && a < to && b > from) {
      occurrences.push({
        title: e.summary || e.uid,
        start: a,
        end: b,
        uid: e.uid,
      });
      if (occurrences.length > 2000) throw Error('calendarSize');
    }
  };
  for (const e of masters.values()) {
    if (
      !selected.has(e.uid) ||
      e.component.getFirstPropertyValue('status') === 'CANCELLED'
    )
      continue;
    const iterator = e.iterator();
    let scanned = 0;
    let done = false;
    const exceptionTimes = new Set(
      exceptions
        .filter((x) => x.uid === e.uid)
        .map((x) => x.recurrenceId.toString()),
    );
    while (scanned++ < 10000) {
      const time = iterator.next();
      if (!time) {
        done = true;
        break;
      }
      if (time.toJSDate().getTime() >= to) {
        done = true;
        break;
      }
      if (exceptionTimes.has(time.toString())) continue;
      const d = e.getOccurrenceDetails(time);
      append(d.item, d.startDate, d.endDate);
    }
    if (!done) throw Error('calendarScan');
  }
  for (const e of exceptions) {
    if (
      selected.has(e.uid) &&
      masters.get(e.uid)?.component.getFirstPropertyValue('status') !==
        'CANCELLED'
    )
      append(e, e.startDate, e.endDate);
  }
  occurrences.sort((a, b) => a.start - b.start || a.end - b.end);
  const conflicts: [number, number][] = [];
  for (let i = 0; i < occurrences.length; i++)
    for (
      let j = i + 1;
      j < occurrences.length && occurrences[j].start < occurrences[i].end;
      j++
    ) {
      conflicts.push([i, j]);
      if (conflicts.length > 5000) throw Error('calendarSize');
    }
  const free: { start: number; end: number }[] = [];
  let cursor = from;
  for (const e of occurrences) {
    if (e.start > cursor)
      free.push({ start: cursor, end: Math.min(e.start, to) });
    cursor = Math.max(cursor, e.end);
  }
  if (cursor < to) free.push({ start: cursor, end: to });
  return {
    ics: merged.toString(),
    duplicates,
    events: selected.size,
    occurrences,
    conflicts,
    free,
  };
}
