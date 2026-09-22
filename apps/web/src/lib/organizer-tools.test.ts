import { describe, expect, it } from 'vitest';
import {
  calendarFile,
  csvFile,
  dateValid,
  daysBetween,
  monthShifts,
  nextRenewal,
  packingTotals,
  rankDecision,
  setTournamentScore,
  shiftHours,
  subscriptionAnnual,
  tournamentMatches,
  validDecisions,
  validInventory,
  validKnitting,
  validPacking,
  validShiftPlan,
  validSubscriptions,
  validTournaments,
  type ShiftPlan,
  type Subscription,
  type Tournament,
} from './organizer-tools';

const plan: ShiftPlan = {
  startDate: '2026-03-01',
  shifts: [
    {
      id: 'night',
      name: 'Night',
      start: '20:00',
      end: '08:00',
      rest: false,
      breakMinutes: 60,
    },
    {
      id: 'off',
      name: 'Off',
      start: '00:00',
      end: '00:00',
      rest: true,
      breakMinutes: 0,
    },
  ],
  cycle: ['night', 'off'],
};
const subscription: Subscription = {
  id: 'a',
  name: 'Subscription',
  amount: 12,
  currency: 'CNY',
  interval: 1,
  period: 'month',
  renewal: '2024-01-31',
  active: true,
};
const tournament = (
  count: number,
  mode: Tournament['mode'] = 'knockout',
): Tournament => ({
  id: 't',
  name: 'Cup',
  mode,
  players: Array.from({ length: count }, (_, i) => `P${i + 1}`),
  scores: {},
});
describe('organizer calculations and validation', () => {
  it('handles overnight shifts, unpaid breaks, cycle boundaries and calendar dates', () => {
    expect(validShiftPlan(plan)).toBe(true);
    expect(shiftHours(plan.shifts[0])).toBe(11);
    expect(monthShifts(plan, '2026-03')).toHaveLength(31);
    expect(monthShifts(plan, '2026-03')[1].shift.id).toBe('off');
    expect(monthShifts(plan, '2026-02').at(-1)?.shift.id).toBe('off');
    expect(monthShifts(plan, '2026-13')).toEqual([]);
    expect(dateValid('2026-02-29')).toBe(false);
    expect(dateValid('2024-02-29')).toBe(true);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(validShiftPlan({ ...plan, cycle: ['missing'] })).toBe(false);
    expect(
      validShiftPlan({
        ...plan,
        shifts: [{ ...plan.shifts[0], breakMinutes: 1000 }],
      }),
    ).toBe(false);
  });
  it('preserves month-end anchors across short months and folds spending per period', () => {
    expect(nextRenewal(subscription, '2024-02-01')).toBe('2024-02-29');
    expect(nextRenewal(subscription, '2024-03-01')).toBe('2024-03-31');
    expect(nextRenewal(subscription, '2025-02-01')).toBe('2025-02-28');
    expect(
      nextRenewal(
        { ...subscription, period: 'year', renewal: '2024-02-29' },
        '2025-03-01',
      ),
    ).toBe('2026-02-28');
    expect(
      nextRenewal(
        { ...subscription, period: 'week', renewal: '2026-01-01', interval: 2 },
        '2026-01-16',
      ),
    ).toBe('2026-01-29');
    expect(subscriptionAnnual(subscription)).toBe(144);
    expect(subscriptionAnnual({ ...subscription, period: 'year' })).toBe(12);
    expect(validSubscriptions([{ ...subscription, currency: 'NOPE' }])).toBe(
      false,
    );
    expect(validSubscriptions([{ ...subscription, interval: 0 }])).toBe(false);
  });
  it('calculates packed weights and normalized decisions, rejects incompatible backups', () => {
    const item = {
      id: 'a',
      name: 'Water',
      category: 'Food',
      bag: 'Main',
      quantity: 2,
      grams: 500,
      checked: true,
    };
    expect(
      packingTotals([item, { ...item, id: 'b', quantity: 1, checked: false }]),
    ).toEqual([{ bag: 'Main', count: 3, grams: 1500, checked: 2 }]);
    expect(validPacking([{ id: 'trip', name: 'Trip', items: [item] }])).toBe(
      true,
    );
    expect(
      validPacking([{ id: 'trip', name: 'Trip', items: [item, item] }]),
    ).toBe(false);
    const decision = {
      id: 'd',
      name: 'Choice',
      criteria: [
        { id: 'c1', name: 'Quality', weight: 3 },
        { id: 'c2', name: 'Value', weight: 1 },
      ],
      options: [
        { id: 'a', name: 'A', scores: [10, 2] },
        { id: 'b', name: 'B', scores: [5, 10] },
      ],
    };
    expect(rankDecision(decision).map((item) => item.score)).toEqual([8, 6.25]);
    expect(validDecisions([decision])).toBe(true);
    expect(
      validDecisions([
        { ...decision, options: [{ id: 'a', name: 'A', scores: [10] }] },
      ]),
    ).toBe(false);
    expect(
      validInventory([
        {
          id: 'i',
          name: 'Food',
          quantity: -1,
          minimum: 0,
          location: 'Kitchen',
          packaging: '',
          expiry: '',
        },
      ]),
    ).toBe(false);
    expect(
      validKnitting([
        { id: 'k', name: 'Scarf', row: 1, cycle: 0, history: [], markers: [] },
      ]),
    ).toBe(false);
  });
  it('keeps byes separate from unresolved matches and clears downstream scores', () => {
    for (const count of [2, 3, 5, 8, 17, 32]) {
      let cup = tournament(count);
      expect(validTournaments([cup])).toBe(true);
      for (let round = 0; round < Math.ceil(Math.log2(count)); round++) {
        for (const match of tournamentMatches(cup).filter(
          (match) => match.round === round && match.a && match.b,
        )) {
          cup = setTournamentScore(cup, match.id, { a: 1, b: 0 });
        }
      }
      expect(tournamentMatches(cup).at(-1)?.winner).toBe('P1');
    }
    let cup = tournament(8);
    cup = setTournamentScore(cup, '0-0', { a: 1, b: 0 });
    cup = setTournamentScore(cup, '0-1', { a: 1, b: 0 });
    cup = setTournamentScore(cup, '1-0', { a: 1, b: 0 });
    expect(tournamentMatches(cup).at(-1)?.ready).toBe(false);
    expect(tournamentMatches(cup).at(-1)?.winner).toBeNull();
    cup = setTournamentScore(cup, '0-2', { a: 1, b: 0 });
    cup = setTournamentScore(cup, '0-3', { a: 1, b: 0 });
    cup = setTournamentScore(cup, '1-1', { a: 1, b: 0 });
    cup = setTournamentScore(cup, '2-0', { a: 1, b: 0 });
    const changed = setTournamentScore(cup, '0-0', { a: 0, b: 1 });
    expect(changed.scores['1-0']).toBeUndefined();
    expect(changed.scores['2-0']).toBeUndefined();
    expect(changed.scores['1-1']).toEqual({ a: 1, b: 0 });
    expect(() =>
      setTournamentScore(tournament(4), '0-0', { a: 1, b: 1 }),
    ).toThrow();
    expect(
      validTournaments([
        { ...tournament(4), scores: { '1-0': { a: 1, b: 0 } } },
      ]),
    ).toBe(false);
  });
  it('generates every league pair once without double-booking a round', () => {
    for (const count of [3, 4, 5, 16]) {
      const matches = tournamentMatches(tournament(count, 'league'));
      expect(matches).toHaveLength((count * (count - 1)) / 2);
      expect(
        new Set(matches.map((match) => [match.a, match.b].sort().join('|')))
          .size,
      ).toBe(matches.length);
      for (const round of new Set(matches.map((match) => match.round))) {
        const players = matches
          .filter((match) => match.round === round)
          .flatMap((match) => [match.a, match.b]);
        expect(new Set(players).size).toBe(players.length);
      }
    }
  });
  it('escapes calendar and spreadsheet exports without losing event boundaries', () => {
    const calendar = calendarFile(
      [
        {
          title: 'A, B\nBEGIN:VEVENT\r',
          start: new Date('2026-01-01T00:00:00Z'),
          end: new Date('2026-01-01T01:00:00Z'),
        },
      ],
      true,
    );
    expect(
      calendar.split('\r\n').filter((line) => line === 'BEGIN:VEVENT'),
    ).toHaveLength(1);
    expect(calendar).toContain('BEGIN:VALARM');
    expect(calendar).toContain('SUMMARY:A\\, B\\nBEGIN:VEVENT');
    expect(csvFile([['=1+1', 'a"b']])).toContain('"\'=1+1","a""b"');
  });
});
