import { expect, it } from 'vitest';
import { expandCalendar, RECURRENCE_SAMPLE } from './calendar-recurrence';

it('expands across DST while honoring COUNT and EXDATE', async () => {
  const result = await expandCalendar({
    input: RECURRENCE_SAMPLE,
    from: '2026-03-01',
    limit: 10,
  });
  expect(result.occurrences.map((row) => row.start)).toEqual([
    '2026-03-22T09:00:00',
    '2026-03-29T09:00:00',
    '2026-04-12T09:00:00',
  ]);
  expect(result.occurrences.map((row) => row.utc)).toEqual([
    '2026-03-22T08:00:00Z',
    '2026-03-29T07:00:00Z',
    '2026-04-12T07:00:00Z',
  ]);
  expect(result.more).toBe(false);
  await expect(
    expandCalendar({
      input: RECURRENCE_SAMPLE.replaceAll('T090000', 'T023000').replaceAll(
        'T100000',
        'T033000',
      ),
      from: '2026-03-01',
      limit: 10,
    }),
  ).rejects.toThrow('nonexistentTime');
});
it('keeps floating dates floating and substitutes moved exceptions without duplicates', async () => {
  const input = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:a\nDTSTART:20260101T090000\nRRULE:FREQ=DAILY;COUNT=3\nRDATE:20260105T090000\nEND:VEVENT\nBEGIN:VEVENT\nUID:a\nRECURRENCE-ID:20260102T090000\nDTSTART:20260104T120000\nSUMMARY:Moved\nEND:VEVENT\nEND:VCALENDAR`;
  const result = await expandCalendar({ input, from: '2026-01-01', limit: 10 });
  expect(result.occurrences.map((row) => row.start)).toEqual([
    '2026-01-01T09:00:00',
    '2026-01-03T09:00:00',
    '2026-01-04T12:00:00',
    '2026-01-05T09:00:00',
  ]);
  expect(result.occurrences.every((row) => row.utc === null)).toBe(true);
  expect(result.occurrences[2].exception).toBe(true);
});
it('rejects missing timezone definitions and invalid dates, bounds infinite rules', async () => {
  await expect(
    expandCalendar({
      input: RECURRENCE_SAMPLE.replace(
        /BEGIN:VTIMEZONE[\s\S]*?END:VTIMEZONE\n/,
        '',
      ),
      from: '2026-03-01',
      limit: 10,
    }),
  ).rejects.toThrow('unknownTimezone');
  await expect(
    expandCalendar({ input: RECURRENCE_SAMPLE, from: '2026-02-30', limit: 10 }),
  ).rejects.toThrow('invalidDate');
  const result = await expandCalendar({
    input: RECURRENCE_SAMPLE.replace(';COUNT=4', ''),
    from: '2026-03-01',
    limit: 2,
  });
  expect(result.occurrences).toHaveLength(2);
  expect(result.more).toBe(true);
});

it('keeps all-day boundaries exclusive and rejects silently normalized dates or zero COUNT', async () => {
  const input =
    'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:day\nDTSTART;VALUE=DATE:20260101\nDTEND;VALUE=DATE:20260102\nRRULE:FREQ=DAILY;COUNT=2\nEND:VEVENT\nEND:VCALENDAR';
  const result = await expandCalendar({ input, from: '2026-01-01', limit: 10 });
  expect(
    result.occurrences.map(({ start, end, utc }) => ({ start, end, utc })),
  ).toEqual([
    { start: '2026-01-01', end: '2026-01-02', utc: null },
    { start: '2026-01-02', end: '2026-01-03', utc: null },
  ]);
  await expect(
    expandCalendar({
      input: input.replace('20260101', '20260230'),
      from: '2026-01-01',
      limit: 10,
    }),
  ).rejects.toThrow('invalidEvent');
  await expect(
    expandCalendar({
      input: input.replace('COUNT=2', 'COUNT=0'),
      from: '2026-01-01',
      limit: 10,
    }),
  ).rejects.toThrow('invalidRule');
});
