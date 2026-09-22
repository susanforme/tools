import { createIcsEvent } from './life-calculators';

export function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function shortText(value: unknown, max = 120): value is string {
  return typeof value === 'string' && value.length <= max;
}
export function named(value: unknown): value is string {
  return shortText(value) && value.trim().length > 0;
}
export function finite(value: unknown, min = 0, max = 1e9): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}
export function integer(
  value: unknown,
  min = 0,
  max = 100000,
): value is number {
  return finite(value, min, max) && Number.isInteger(value);
}
export function list<T>(
  value: unknown,
  validate: (item: unknown) => item is T,
  max = 500,
): value is T[] {
  return Array.isArray(value) && value.length <= max && value.every(validate);
}
export function uniqueIds(value: Array<{ id: string }>): boolean {
  return (
    value.every((item) => named(item.id)) &&
    new Set(value.map((item) => item.id)).size === value.length
  );
}
export function dateValid(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    Number(value.slice(0, 4)) >= 1900 &&
    Number(value.slice(0, 4)) <= 2200
  );
}
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(date: string, amount: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + amount * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000,
  );
}
export function calendarFile(
  events: Array<{
    title: string;
    start: Date;
    end: Date;
    description?: string;
  }>,
  reminder = false,
): string {
  const blocks = events.map((event) => {
    const ics = createIcsEvent({
      ...event,
      title: event.title.replace(/\r/g, ''),
      description: (event.description ?? '').replace(/\r/g, ''),
      location: '',
    });
    let body = ics.slice(
      ics.indexOf('BEGIN:VEVENT'),
      ics.indexOf('END:VEVENT') + 'END:VEVENT'.length,
    );
    if (reminder)
      body = body.replace(
        'END:VEVENT',
        'BEGIN:VALARM\r\nTRIGGER:-P1D\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder\r\nEND:VALARM\r\nEND:VEVENT',
      );
    return body;
  });
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Breeze Tools//Organizer//EN',
    'CALSCALE:GREGORIAN',
    ...blocks,
    'END:VCALENDAR',
  ].join('\r\n');
}
export function csvFile(rows: Array<Array<string | number>>): string {
  return (
    '\ufeff' +
    rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value);
            const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
            return `"${safe.replaceAll('"', '""')}"`;
          })
          .join(','),
      )
      .join('\r\n')
  );
}

export type Shift = {
  id: string;
  name: string;
  start: string;
  end: string;
  rest: boolean;
  breakMinutes: number;
};
export type ShiftPlan = { startDate: string; shifts: Shift[]; cycle: string[] };
const timeValid = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function shiftHours(shift: Shift): number {
  if (shift.rest) return 0;
  const minutes = (time: string) =>
    Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const span =
    (minutes(shift.end) - minutes(shift.start) + 1440) % 1440 || 1440;
  return (span - shift.breakMinutes) / 60;
}
export function validShiftPlan(value: unknown): value is ShiftPlan {
  if (
    !object(value) ||
    !dateValid(value.startDate) ||
    !list(
      value.shifts,
      (item): item is Shift =>
        object(item) &&
        named(item.id) &&
        named(item.name) &&
        timeValid(item.start) &&
        timeValid(item.end) &&
        typeof item.rest === 'boolean' &&
        integer(item.breakMinutes, 0, 1440),
      20,
    ) ||
    !value.shifts.length ||
    !uniqueIds(value.shifts)
  )
    return false;
  const shifts = value.shifts;
  return (
    shifts.every((shift) => shiftHours(shift) >= 0) &&
    list(
      value.cycle,
      (item): item is string =>
        typeof item === 'string' && shifts.some((shift) => shift.id === item),
      60,
    ) &&
    value.cycle.length > 0
  );
}
export function monthShifts(
  plan: ShiftPlan,
  month: string,
): Array<{ date: string; shift: Shift }> {
  if (!/^\d{4}-\d{2}$/.test(month) || !dateValid(`${month}-01`)) return [];
  const count = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5)),
    0,
  ).getDate();
  return Array.from({ length: count }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, '0')}`;
    const offset = daysBetween(plan.startDate, date);
    const id =
      plan.cycle[
        ((offset % plan.cycle.length) + plan.cycle.length) % plan.cycle.length
      ];
    return { date, shift: plan.shifts.find((shift) => shift.id === id)! };
  });
}

export type PackingItem = {
  id: string;
  name: string;
  category: string;
  bag: string;
  quantity: number;
  grams: number;
  checked: boolean;
};
export type PackingTrip = { id: string; name: string; items: PackingItem[] };
export function validPacking(value: unknown): value is PackingTrip[] {
  return (
    list(
      value,
      (trip): trip is PackingTrip =>
        object(trip) &&
        named(trip.id) &&
        named(trip.name) &&
        list(
          trip.items,
          (item): item is PackingItem =>
            object(item) &&
            named(item.id) &&
            named(item.name) &&
            named(item.category) &&
            named(item.bag) &&
            integer(item.quantity, 1, 10000) &&
            finite(item.grams, 0, 1000000) &&
            typeof item.checked === 'boolean',
        ) &&
        uniqueIds(trip.items),
      30,
    ) && uniqueIds(value)
  );
}
export function packingTotals(
  items: PackingItem[],
): Array<{ bag: string; count: number; grams: number; checked: number }> {
  const bags = new Map<
    string,
    { bag: string; count: number; grams: number; checked: number }
  >();
  for (const item of items) {
    const row = bags.get(item.bag) ?? {
      bag: item.bag,
      count: 0,
      grams: 0,
      checked: 0,
    };
    row.count += item.quantity;
    row.grams += item.quantity * item.grams;
    row.checked += item.checked ? item.quantity : 0;
    bags.set(item.bag, row);
  }
  return [...bags.values()];
}

export const CURRENCIES = ['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'HKD'] as const;
export type Subscription = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: number;
  period: 'month' | 'year' | 'week';
  renewal: string;
  active: boolean;
};
export function validSubscriptions(value: unknown): value is Subscription[] {
  return (
    list(
      value,
      (item): item is Subscription =>
        object(item) &&
        named(item.id) &&
        named(item.name) &&
        finite(item.amount, 0, 1e7) &&
        typeof item.currency === 'string' &&
        CURRENCIES.includes(item.currency as (typeof CURRENCIES)[number]) &&
        integer(item.interval, 1, 120) &&
        ['month', 'year', 'week'].includes(String(item.period)) &&
        dateValid(item.renewal) &&
        typeof item.active === 'boolean',
      200,
    ) && uniqueIds(value)
  );
}
export function subscriptionAnnual(item: Subscription): number {
  return (
    (item.amount *
      (item.period === 'year'
        ? 1
        : item.period === 'month'
          ? 12
          : 365.2425 / 7)) /
    item.interval
  );
}
export function nextRenewal(item: Subscription, today: string): string {
  if (item.renewal >= today) return item.renewal;
  if (item.period === 'week') {
    const steps = Math.ceil(
      daysBetween(item.renewal, today) / (item.interval * 7),
    );
    return addDays(item.renewal, steps * item.interval * 7);
  }
  const start = new Date(`${item.renewal}T00:00:00Z`);
  const targetDate = new Date(`${today}T00:00:00Z`);
  const monthStep = item.interval * (item.period === 'year' ? 12 : 1);
  let steps = Math.max(
    0,
    Math.floor(
      ((targetDate.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        targetDate.getUTCMonth() -
        start.getUTCMonth()) /
        monthStep,
    ),
  );
  const at = (index: number) => {
    const month = start.getUTCMonth() + index * monthStep;
    const end = new Date(Date.UTC(start.getUTCFullYear(), month + 1, 0));
    return new Date(
      Date.UTC(
        end.getUTCFullYear(),
        end.getUTCMonth(),
        Math.min(start.getUTCDate(), end.getUTCDate()),
      ),
    )
      .toISOString()
      .slice(0, 10);
  };
  while (at(steps) < today) steps++;
  return at(steps);
}

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  location: string;
  packaging: string;
  expiry: string;
  minimum: number;
};
export function validInventory(value: unknown): value is InventoryItem[] {
  return (
    list(
      value,
      (item): item is InventoryItem =>
        object(item) &&
        named(item.id) &&
        named(item.name) &&
        finite(item.quantity, 0, 100000) &&
        named(item.location) &&
        shortText(item.packaging) &&
        (item.expiry === '' || dateValid(item.expiry)) &&
        finite(item.minimum, 0, 100000),
    ) && uniqueIds(value)
  );
}

export type Decision = {
  id: string;
  name: string;
  criteria: Array<{ id: string; name: string; weight: number }>;
  options: Array<{ id: string; name: string; scores: number[] }>;
};
export function validDecisions(value: unknown): value is Decision[] {
  return (
    list(
      value,
      (item): item is Decision =>
        object(item) &&
        named(item.id) &&
        named(item.name) &&
        list(
          item.criteria,
          (criterion): criterion is Decision['criteria'][number] =>
            object(criterion) &&
            named(criterion.id) &&
            named(criterion.name) &&
            finite(criterion.weight, 0, 100),
          20,
        ) &&
        item.criteria.length > 0 &&
        uniqueIds(item.criteria) &&
        list(
          item.options,
          (option): option is Decision['options'][number] =>
            object(option) &&
            named(option.id) &&
            named(option.name) &&
            list(
              option.scores,
              (score): score is number => finite(score, 0, 10),
              20,
            ) &&
            option.scores.length ===
              (item.criteria as Decision['criteria']).length,
          30,
        ) &&
        uniqueIds(item.options),
      30,
    ) && uniqueIds(value)
  );
}
export function rankDecision(
  decision: Decision,
): Array<{ id: string; name: string; score: number }> {
  const total = decision.criteria.reduce((sum, c) => sum + c.weight, 0);
  return decision.options
    .map((option) => ({
      id: option.id,
      name: option.name,
      score: total
        ? option.scores.reduce(
            (sum, score, index) =>
              sum + score * decision.criteria[index].weight,
            0,
          ) / total
        : 0,
    }))
    .sort((a, b) => b.score - a.score);
}

export type KnittingProject = {
  id: string;
  name: string;
  row: number;
  cycle: number;
  history: number[];
  markers: Array<{ id: string; row: number; note: string }>;
};
export function validKnitting(value: unknown): value is KnittingProject[] {
  return (
    list(
      value,
      (item): item is KnittingProject =>
        object(item) &&
        named(item.id) &&
        named(item.name) &&
        integer(item.row, 0, 100000) &&
        integer(item.cycle, 1, 10000) &&
        list(
          item.history,
          (row): row is number => integer(row, 0, 100000),
          100,
        ) &&
        list(
          item.markers,
          (marker): marker is KnittingProject['markers'][number] =>
            object(marker) &&
            named(marker.id) &&
            integer(marker.row, 1, 100000) &&
            named(marker.note),
          200,
        ) &&
        uniqueIds(item.markers),
      50,
    ) && uniqueIds(value)
  );
}

export type Score = { a: number; b: number };
export type Tournament = {
  id: string;
  name: string;
  mode: 'knockout' | 'league';
  players: string[];
  scores: Record<string, Score>;
};
export type Match = {
  id: string;
  round: number;
  a: string | null;
  b: string | null;
  ready: boolean;
  score: Score | null;
  winner: string | null;
};
export function tournamentMatches(tournament: Tournament): Match[] {
  const { players, scores } = tournament;
  if (tournament.mode === 'league') {
    const circle: Array<string | null> = [...players];
    if (circle.length % 2) circle.push(null);
    const result: Match[] = [];
    for (let round = 0; round < circle.length - 1; round++) {
      for (let index = 0; index < circle.length / 2; index++) {
        const a = circle[index],
          b = circle[circle.length - 1 - index];
        if (!a || !b) continue;
        const id = `${round}-${index}`,
          score = scores[id] ?? null;
        result.push({
          id,
          round,
          a,
          b,
          ready: true,
          score,
          winner: score
            ? score.a === score.b
              ? null
              : score.a > score.b
                ? a
                : b
            : null,
        });
      }
      circle.splice(1, 0, circle.pop()!);
    }
    return result;
  }
  const size = 2 ** Math.ceil(Math.log2(players.length));
  let seeds = [1, 2];
  while (seeds.length < size) {
    const nextSize = seeds.length * 2;
    seeds = seeds.flatMap((seed) => [seed, nextSize + 1 - seed]);
  }
  let previous: Match[] = [];
  const result: Match[] = [];
  for (let round = 0, count = size / 2; count >= 1; round++, count /= 2) {
    const matches: Match[] = [];
    for (let index = 0; index < count; index++) {
      const id = `${round}-${index}`;
      const left = previous[index * 2],
        right = previous[index * 2 + 1];
      const a =
        round === 0 ? (players[seeds[index * 2] - 1] ?? null) : left.winner;
      const b =
        round === 0
          ? (players[seeds[index * 2 + 1] - 1] ?? null)
          : right.winner;
      const ready =
        round === 0 ||
        ((left.winner !== null || (left.ready && !left.a && !left.b)) &&
          (right.winner !== null || (right.ready && !right.a && !right.b)));
      const score = ready && a && b ? (scores[id] ?? null) : null;
      const winner = ready
        ? a && !b
          ? a
          : !a && b
            ? b
            : score
              ? score.a > score.b
                ? a
                : score.b > score.a
                  ? b
                  : null
              : null
        : null;
      matches.push({ id, round, a, b, ready, score, winner });
    }
    result.push(...matches);
    previous = matches;
  }
  return result;
}
export function setTournamentScore(
  tournament: Tournament,
  id: string,
  score: Score | null,
): Tournament {
  const matches = tournamentMatches(tournament);
  const match = matches.find((item) => item.id === id);
  if (
    !match ||
    !match.ready ||
    !match.a ||
    !match.b ||
    (score &&
      (!integer(score.a, 0, 9999) ||
        !integer(score.b, 0, 9999) ||
        (tournament.mode === 'knockout' && score.a === score.b)))
  )
    throw new Error('invalid');
  const scores = { ...tournament.scores };
  if (score) scores[id] = score;
  else delete scores[id];
  if (tournament.mode === 'knockout') {
    let [round, index] = id.split('-').map(Number);
    while (++round < Math.ceil(Math.log2(tournament.players.length))) {
      index = Math.floor(index / 2);
      delete scores[`${round}-${index}`];
    }
  }
  return { ...tournament, scores };
}
export function validTournaments(value: unknown): value is Tournament[] {
  return (
    list(
      value,
      (item): item is Tournament => {
        if (
          !object(item) ||
          !named(item.id) ||
          !named(item.name) ||
          !['knockout', 'league'].includes(String(item.mode)) ||
          !list(
            item.players,
            (player): player is string => named(player),
            32,
          ) ||
          item.players.length < 2 ||
          new Set(item.players).size !== item.players.length ||
          !object(item.scores) ||
          Object.keys(item.scores).length > 500
        )
          return false;
        for (const [id, score] of Object.entries(item.scores)) {
          if (
            !/^\d+-\d+$/.test(id) ||
            !object(score) ||
            !integer(score.a, 0, 9999) ||
            !integer(score.b, 0, 9999) ||
            (item.mode === 'knockout' && score.a === score.b)
          )
            return false;
        }
        const tournament = item as Tournament;
        const matches = tournamentMatches(tournament);
        return Object.keys(item.scores).every((id) =>
          matches.some(
            (match) => match.id === id && match.ready && match.a && match.b,
          ),
        );
      },
      30,
    ) && uniqueIds(value)
  );
}
