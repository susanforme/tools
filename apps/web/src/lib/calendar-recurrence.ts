import type ICAL from 'ical.js';

export type RecurrenceRequest = { input: string; from: string; limit: number };
export type CalendarOccurrence = {
  uid: string;
  summary: string;
  start: string;
  end: string;
  zone: string;
  utc: string | null;
  offset: string | null;
  exception: boolean;
};
export type RecurrenceResult = {
  occurrences: CalendarOccurrence[];
  more: boolean;
  scanLimit: boolean;
};
export const CALENDAR_MAX_BYTES = 1024 * 1024;

export async function expandCalendar({
  input,
  from,
  limit,
}: RecurrenceRequest): Promise<RecurrenceResult> {
  if (new TextEncoder().encode(input).length > CALENDAR_MAX_BYTES)
    throw new Error('sizeLimit');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !Number.isFinite(Date.parse(from)) ||
    new Date(from).toISOString().slice(0, 10) !== from
  )
    throw new Error('invalidDate');
  if (!Number.isInteger(limit) || limit < 1 || limit > 500)
    throw new Error('invalidLimit');
  const { default: Ical } = await import('ical.js');
  const calendar = new Ical.Component(Ical.parse(input));
  if (calendar.name !== 'vcalendar') throw new Error('invalidCalendar');
  const validTime = (value: unknown): boolean =>
    typeof value === 'string' &&
    Ical.Time.fromString(value, null).toString() === value;
  const pending = [calendar];
  let componentCount = 0;
  while (pending.length) {
    const component = pending.pop()!;
    if (++componentCount > 1000) throw new Error('eventLimit');
    pending.push(...component.getAllSubcomponents());
    for (const property of component.getAllProperties()) {
      const values: unknown[] = property.toJSON().slice(3);
      if (
        (property.type === 'date' || property.type === 'date-time') &&
        !values.every(validTime)
      )
        throw new Error('invalidEvent');
      if (property.type === 'recur') {
        for (const value of values) {
          if (!value || typeof value !== 'object')
            throw new Error('invalidRule');
          const rule = value as Record<string, unknown>;
          if (
            !rule.freq ||
            (rule.count !== undefined && rule.until !== undefined)
          )
            throw new Error('invalidRule');
          for (const key of ['count', 'interval']) {
            if (
              rule[key] !== undefined &&
              (!Number.isInteger(rule[key]) || Number(rule[key]) < 1)
            )
              throw new Error('invalidRule');
          }
          if (rule.until !== undefined && !validTime(rule.until))
            throw new Error('invalidRule');
        }
      }
    }
  }
  const components = calendar.getAllSubcomponents('vevent');
  if (!components.length || components.length > 200)
    throw new Error('eventLimit');
  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const component of components) {
    for (const property of component.getAllProperties()) {
      const tzid: unknown = property.getParameter('tzid');
      if (
        tzid &&
        tzid !== 'UTC' &&
        (typeof tzid !== 'string' || !calendar.getTimeZoneByID(tzid))
      )
        throw new Error('unknownTimezone');
      if (property.name === 'rdate' && property.type === 'period')
        throw new Error('periodUnsupported');
      if (property.name === 'recurrence-id' && property.getParameter('range'))
        throw new Error('rangeUnsupported');
    }
    if (!component.hasProperty('dtstart') || !component.hasProperty('uid'))
      throw new Error('missingFields');
    const event = new Ical.Event(component, {
      exceptions: [],
      strictExceptions: true,
    });
    if (
      !event.uid ||
      event.duration.toSeconds() < 0 ||
      event.startDate.isDate !== event.endDate.isDate
    )
      throw new Error('invalidEvent');
    if (event.isRecurrenceException()) exceptions.push(event);
    else {
      if (masters.has(event.uid)) throw new Error('duplicateUid');
      masters.set(event.uid, event);
    }
  }
  if (masters.size > 20) throw new Error('eventLimit');
  const exceptionKeys = new Map<string, Set<string>>();
  for (const exception of exceptions) {
    if (!masters.has(exception.uid)) throw new Error('orphanException');
    const keys = exceptionKeys.get(exception.uid) ?? new Set<string>();
    const key = exception.recurrenceId
      .convertToZone(Ical.Timezone.utcTimezone)
      .toString();
    if (keys.has(key)) throw new Error('duplicateException');
    keys.add(key);
    exceptionKeys.set(exception.uid, keys);
  }
  const occurrences: CalendarOccurrence[] = [];
  let more = false;
  let scanLimit = false;
  const cancelled = (event: ICAL.Event): boolean =>
    event.component.getFirstPropertyValue('status') === 'CANCELLED';
  function append(
    event: ICAL.Event,
    start: ICAL.Time,
    end: ICAL.Time,
    exception: boolean,
  ): boolean {
    if (cancelled(event) || start.toString().slice(0, 10) < from) return false;
    const zoned = !start.isDate && start.zone !== Ical.Timezone.localTimezone;
    if (
      zoned &&
      start
        .convertToZone(Ical.Timezone.utcTimezone)
        .convertToZone(start.zone)
        .toString() !== start.toString()
    )
      throw new Error('nonexistentTime');
    const seconds = zoned ? start.utcOffset() : null;
    const offset =
      seconds === null
        ? null
        : `UTC${seconds >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(seconds) / 3600)).padStart(2, '0')}:${String(Math.floor((Math.abs(seconds) % 3600) / 60)).padStart(2, '0')}`;
    occurrences.push({
      uid: event.uid,
      summary: event.summary || event.uid,
      start: start.toString(),
      end: end.toString(),
      zone: start.isDate ? 'date' : start.zone.tzid,
      utc: zoned
        ? start.convertToZone(Ical.Timezone.utcTimezone).toString()
        : null,
      offset,
      exception,
    });
    return true;
  }
  for (const event of masters.values()) {
    if (cancelled(event)) continue;
    const iterator = event.iterator();
    let retained = 0;
    let scanned = 0;
    let completed = false;
    // ponytail: 从 DTSTART 扫描以保留 COUNT 语义；最多 10,000 次，较久远高频规则需缩小源日历。
    while (scanned < 10_000 && retained <= limit) {
      const time = iterator.next();
      if (!time) {
        completed = true;
        break;
      }
      scanned++;
      if (
        exceptionKeys
          .get(event.uid)
          ?.has(time.convertToZone(Ical.Timezone.utcTimezone).toString())
      )
        continue;
      const details = event.getOccurrenceDetails(time);
      if (append(event, details.startDate, details.endDate, false)) retained++;
    }
    if (!completed && scanned === 10_000) scanLimit = true;
    if (retained > limit) more = true;
  }
  for (const exception of exceptions) {
    if (!cancelled(masters.get(exception.uid)!))
      append(exception, exception.startDate, exception.endDate, true);
  }
  // 按事件当地日期排序；未绑定时区的浮动时间不会伪装为 UTC。
  occurrences.sort(
    (a, b) => a.start.localeCompare(b.start) || a.uid.localeCompare(b.uid),
  );
  return {
    occurrences: occurrences.slice(0, limit),
    more: more || occurrences.length > limit,
    scanLimit,
  };
}

export const RECURRENCE_SAMPLE = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTIMEZONE
TZID:Europe/Berlin
BEGIN:DAYLIGHT
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
END:DAYLIGHT
BEGIN:STANDARD
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:weekly-example
DTSTART;TZID=Europe/Berlin:20260322T090000
DTEND;TZID=Europe/Berlin:20260322T100000
RRULE:FREQ=WEEKLY;COUNT=4
EXDATE;TZID=Europe/Berlin:20260405T090000
SUMMARY:Weekly sync
END:VEVENT
END:VCALENDAR`;
