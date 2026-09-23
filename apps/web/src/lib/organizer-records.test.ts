import { RECURRENCE_SAMPLE } from './calendar-recurrence';
import { describe, it, expect } from 'vitest';
import {
  importLedgerCsv,
  ledgerReport,
  parseMoney,
  validGarden,
  validLedger,
  workMinutes,
  type Ledger,
} from './organizer-records';
import { mergeCalendars } from './calendar-merge';
import { editPhoto, shiftExifDate } from './photo-exif-edit';
const event = (uid: string, start: string, end: string, extra = '') =>
  `BEGIN:VEVENT\nUID:${uid}\nDTSTART:${start}\nDTEND:${end}\nSUMMARY:${uid}\n${extra}\nEND:VEVENT`;
const cal = (events: string) =>
  `BEGIN:VCALENDAR\nVERSION:2.0\n${events}\nEND:VCALENDAR`;
describe('batch 4 organizers', () => {
  it('handles cents, transfers, CSV trust boundary and monthly budgets', async () => {
    const entries = await importLedgerCsv(
      'date,kind,category,account,to,amount,note\n2026-09-01,income,Salary,Bank,,1000.10,\n2026-09-02,transfer,,Bank,Cash,100,\n2026-09-02,expense,Food,Cash,,20.20,',
    );
    const ledger: Ledger = { entries, budgets: [] };
    expect(validLedger(ledger)).toBe(true);
    const r = ledgerReport(ledger, '2026-09');
    expect(r.income).toBe(100010);
    expect(r.expense).toBe(2020);
    expect(r.balances.Bank).toBe(90010);
    expect(r.balances.Cash).toBe(7980);
    expect(r.categories.Food).toBe(2020);
    expect(() => parseMoney('2.999')).toThrow();
    expect(() => parseMoney('1e6')).toThrow();
    await expect(
      importLedgerCsv(
        'date,kind,category,account,to,amount,note\n2026-02-30,expense,x,Cash,,1,',
      ),
    ).rejects.toThrow();
    expect(validLedger({ ...ledger, entries: [...entries, entries[0]] })).toBe(
      false,
    );
  });
  it('calculates overnight hours and validates bed bounds', () => {
    expect(
      workMinutes({
        id: '1',
        date: '2026-09-01',
        start: '20:00',
        end: '08:00',
        breakMinutes: 60,
        project: 'a',
      }),
    ).toBe(660);
    expect(() =>
      workMinutes({
        id: '1',
        date: '2026-09-01',
        start: '09:00',
        end: '10:00',
        breakMinutes: 61,
        project: '',
      }),
    ).toThrow();
    expect(
      validGarden({
        beds: [{ id: 'b', name: 'b', width: 100, height: 100 }],
        plants: [
          {
            id: 'p',
            bed: 'b',
            crop: 'a',
            x: 90,
            y: 0,
            width: 20,
            height: 20,
            spacing: 10,
            sow: '2026-09-01',
            transplant: '',
            note: '',
          },
        ],
        care: [],
      }),
    ).toBe(false);
  });
  it('merges exact duplicates, preserves recurrence and finds actual overlap/free time', async () => {
    const first = cal(
      event(
        'A',
        '20260901T090000Z',
        '20260901T100000Z',
        'RRULE:FREQ=DAILY;COUNT=2',
      ),
    );
    const second = cal(event('B', '20260901T093000Z', '20260901T103000Z'));
    const result = await mergeCalendars({
      sources: [first, first, second],
      from: '2026-09-01T08:00Z',
      to: '2026-09-03T00:00Z',
      filter: '',
    });
    expect(result.duplicates).toBe(1);
    expect(result.events).toBe(2);
    expect(result.occurrences).toHaveLength(3);
    expect(result.conflicts).toEqual([[0, 1]]);
    expect(result.ics).toContain('RRULE:FREQ=DAILY;COUNT=2');
    expect(result.free[0]).toEqual({
      start: Date.parse('2026-09-01T08:00Z'),
      end: Date.parse('2026-09-01T09:00Z'),
    });
    expect(
      (
        await mergeCalendars({
          sources: [first, second],
          from: '2026-09-01T08:00Z',
          to: '2026-09-03T00:00Z',
          filter: 'A',
        })
      ).ics,
    ).not.toContain('UID:B');
    await expect(
      mergeCalendars({
        sources: [first, first.replace('100000', '110000')],
        from: '2026-09-01T08:00Z',
        to: '2026-09-03T00:00Z',
        filter: '',
      }),
    ).rejects.toThrow('calendarCollision');
  });
  it('handles moved recurrence exceptions and overnight overlap', async () => {
    const source = cal(
      event(
        'A',
        '20260901T230000Z',
        '20260902T020000Z',
        'RRULE:FREQ=DAILY;COUNT=2',
      ) +
        '\n' +
        event(
          'A',
          '20260903T090000Z',
          '20260903T100000Z',
          'RECURRENCE-ID:20260902T230000Z',
        ),
    );
    const result = await mergeCalendars({
      sources: [source],
      from: '2026-09-02T00:00Z',
      to: '2026-09-04T00:00Z',
      filter: '',
    });
    expect(result.occurrences).toHaveLength(2);
    expect(result.occurrences[0].start).toBe(Date.parse('2026-09-01T23:00Z'));
    expect(result.occurrences[1].start).toBe(Date.parse('2026-09-03T09:00Z'));
  });
  it('keeps timezone definitions across DST and rejects malformed dates', async () => {
    const r = await mergeCalendars({
      sources: [RECURRENCE_SAMPLE],
      from: '2026-03-21T00:00Z',
      to: '2026-04-01T00:00Z',
      filter: '',
    });
    expect(r.occurrences.map((e) => new Date(e.start).toISOString())).toEqual([
      '2026-03-22T08:00:00.000Z',
      '2026-03-29T07:00:00.000Z',
    ]);
    expect(r.ics).toContain('BEGIN:VTIMEZONE');
    await expect(
      mergeCalendars({
        sources: [cal(event('bad', '20260230T100000Z', '20260230T110000Z'))],
        from: '2026-03-01T00:00Z',
        to: '2026-03-02T00:00Z',
        filter: '',
      }),
    ).rejects.toThrow('calendarInvalid');
  });
  it('writes Unicode EXIF without recompressing JPEG, shifts capture dates and removes fields', async () => {
    expect(shiftExifDate('2024:02:28 23:30:00', 60)).toBe(
      '2024:02:29 00:30:00',
    );
    expect(() => shiftExifDate('2026:02:30 12:00:00', 1)).toThrow();
    const { default: sharp } = await import('sharp');
    const source = new Uint8Array(
      await sharp({
        create: { width: 2, height: 2, channels: 3, background: '#f00' },
      })
        .jpeg()
        .toBuffer(),
    );
    const { default: piexif } = await import('piexifjs');
    const exif = piexif.load(String.fromCharCode(...source));
    exif.Exif[36867] = '2026:09:01 23:30:00';
    exif.GPS[1] = 'N';
    const dated = Uint8Array.from(
      piexif.insert(piexif.dump(exif), String.fromCharCode(...source)),
      (c) => c.charCodeAt(0),
    );
    const result = await editPhoto(dated, {
      minutes: 60,
      author: '作者',
      copyright: 'Copyright 2026',
      description: '描述',
      keywords: '猫;花',
      remove: ['gps'],
    });
    const loaded = piexif.load(String.fromCharCode(...result));
    expect(loaded.Exif[36867]).toBe('2026:09:02 00:30:00');
    expect(loaded.GPS).toEqual({});
    expect(
      new TextDecoder('utf-16le')
        .decode(new Uint8Array(loaded['0th'][40093] as number[]))
        .replace(/\0+$/, ''),
    ).toBe('作者');
    expect(loaded['0th'][33432]).toBe('Copyright 2026');
    expect(await sharp(result).raw().toBuffer()).toEqual(
      await sharp(dated).raw().toBuffer(),
    );
  });
});
