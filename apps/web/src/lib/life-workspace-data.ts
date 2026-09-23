import {
  object,
  shortText,
  named,
  finite,
  integer,
  uniqueIds,
  dateValid,
  calendarFile,
} from './organizer-tools';
export function identified(
  value: unknown,
): value is Record<string, unknown> & { id: string } {
  return object(value) && named(value.id);
}
export type TripStop = {
  id: string;
  title: string;
  kind: 'visit' | 'transport' | 'stay';
  place: string;
  start: string;
  end: string;
  zone: string;
  endZone: string;
  cost: number;
  note: string;
};
export type TripPlan = {
  title: string;
  currency: string;
  budget: number;
  stops: TripStop[];
};
export function zonedTime(local: string, zone: string): number {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ||
    !dateValid(local.slice(0, 10))
  )
    throw Error('date');
  const naive = Date.parse(local + 'Z');
  if (!Number.isFinite(naive)) throw Error('date');
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    throw Error('zone');
  }
  const display = (ms: number) => fmt.format(new Date(ms)).replace(' ', 'T');
  const offsets = new Set(
    [-864e5, 0, 864e5].map(
      (n) => Date.parse(display(naive + n) + 'Z') - (naive + n),
    ),
  );
  const candidates = [...offsets]
    .map((n) => naive - n)
    .filter((ms) => display(ms) === local);
  if (candidates.length !== 1) throw Error('zoneTime');
  return candidates[0];
}
export function validTrip(v: unknown): v is TripPlan {
  return (
    object(v) &&
    shortText(v.title, 200) &&
    shortText(v.currency, 20) &&
    finite(v.budget, 0, 1e9) &&
    Array.isArray(v.stops) &&
    v.stops.length <= 200 &&
    v.stops.every(identified) &&
    uniqueIds(v.stops) &&
    v.stops.every((s) => {
      if (
        !object(s) ||
        !named(s.title) ||
        !['visit', 'transport', 'stay'].includes(String(s.kind)) ||
        !shortText(s.place, 300) ||
        !shortText(s.note, 2000) ||
        !shortText(s.start) ||
        !shortText(s.end) ||
        !shortText(s.zone) ||
        !shortText(s.endZone) ||
        !finite(s.cost, 0, 1e9)
      )
        return false;
      try {
        return zonedTime(s.end, s.endZone) > zonedTime(s.start, s.zone);
      } catch {
        return false;
      }
    })
  );
}
export function tripAnalysis(plan: TripPlan) {
  if (!validTrip(plan)) throw Error('invalid');
  const stops = plan.stops
    .map((s) => ({
      ...s,
      from: zonedTime(s.start, s.zone),
      to: zonedTime(s.end, s.endZone),
    }))
    .sort((a, b) => a.from - b.from);
  const conflicts: [string, string][] = [];
  for (let i = 0; i < stops.length; i++)
    for (let j = i + 1; j < stops.length && stops[j].from < stops[i].to; j++)
      if (stops[i].kind !== 'stay' && stops[j].kind !== 'stay')
        conflicts.push([stops[i].id, stops[j].id]);
  return { stops, conflicts, total: stops.reduce((sum, s) => sum + s.cost, 0) };
}
export function tripIcs(plan: TripPlan) {
  return calendarFile(
    tripAnalysis(plan).stops.map((s) => ({
      title: s.title,
      start: new Date(s.from),
      end: new Date(s.to),
      description: `${s.place}\n${s.start} ${s.zone} → ${s.end} ${s.endZone}\n${s.note}`,
    })),
  );
}
export type CostIngredient = {
  id: string;
  name: string;
  used: number;
  packageAmount: number;
  price: number;
  loss: number;
};
export function recipeCost(
  rows: CostIngredient[],
  yieldCount: number,
  packaging: number,
  overhead: number,
  margin: number,
) {
  if (
    !rows.length ||
    rows.length > 100 ||
    !finite(yieldCount, 0.001, 1e6) ||
    !finite(packaging, 0, 1e6) ||
    !finite(overhead, 0, 1e9) ||
    !finite(margin, 0, 99.9) ||
    rows.some(
      (r) =>
        !named(r.name) ||
        !finite(r.used, 0, 1e9) ||
        !finite(r.packageAmount, 0.000001, 1e9) ||
        !finite(r.price, 0, 1e9) ||
        !finite(r.loss, 0, 99.9),
    )
  )
    throw Error('invalid');
  const ingredients = rows.map(
    (r) => (r.used / (1 - r.loss / 100) / r.packageAmount) * r.price,
  );
  const total =
    ingredients.reduce((a, b) => a + b, 0) + yieldCount * packaging + overhead;
  const unit = total / yieldCount;
  return { ingredients, total, unit, price: unit / (1 - margin / 100) };
}
export type RunSegment = {
  id: string;
  title: string;
  minutes: number;
  delay: number;
  owner: string;
  equipment: string;
  cue: string;
};
export type RunSheet = { title: string; start: string; segments: RunSegment[] };
export function validRun(v: unknown): v is RunSheet {
  return (
    object(v) &&
    shortText(v.title, 200) &&
    typeof v.start === 'string' &&
    dateValid(v.start.slice(0, 10)) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.start) &&
    Number.isFinite(Date.parse(v.start)) &&
    Array.isArray(v.segments) &&
    v.segments.length <= 200 &&
    v.segments.every(identified) &&
    uniqueIds(v.segments) &&
    v.segments.every(
      (s) =>
        object(s) &&
        named(s.title) &&
        integer(s.minutes, 1, 1440) &&
        integer(s.delay, 0, 1440) &&
        shortText(s.owner, 200) &&
        shortText(s.equipment, 1000) &&
        shortText(s.cue, 2000),
    )
  );
}
export function runTimeline(sheet: RunSheet) {
  if (!validRun(sheet)) throw Error('invalid');
  let cursor = Date.parse(sheet.start);
  return sheet.segments.map((s) => {
    cursor += s.delay * 60000;
    const start = cursor;
    cursor += s.minutes * 60000;
    return { ...s, start, end: cursor };
  });
}
export type Attachment = { name: string; type: string; data: string };
export type Asset = {
  id: string;
  name: string;
  purchased: string;
  warranty: string;
  borrower: string;
  loaned: string;
  due: string;
  returned: string;
  repairs: { date: string; note: string; cost: number }[];
  attachment: Attachment | null;
};
export function validAssets(v: unknown): v is Asset[] {
  if (
    !Array.isArray(v) ||
    v.length > 100 ||
    !v.every(identified) ||
    !uniqueIds(v)
  )
    return false;
  let bytes = 0;
  return (
    JSON.stringify(v).length <= 1900000 &&
    v.every((a) => {
      if (
        !object(a) ||
        !named(a.name) ||
        !dateValid(a.purchased) ||
        !shortText(a.borrower, 200) ||
        !['warranty', 'loaned', 'due', 'returned'].every(
          (k) => a[k] === '' || dateValid(a[k]),
        ) ||
        !Array.isArray(a.repairs) ||
        a.repairs.length > 50 ||
        !a.repairs.every(
          (r) =>
            object(r) &&
            dateValid(r.date) &&
            shortText(r.note, 1000) &&
            finite(r.cost, 0, 1e9),
        )
      )
        return false;
      if (a.warranty && String(a.warranty) < a.purchased) return false;
      if (
        (a.borrower || a.loaned || a.due || a.returned) &&
        (!named(a.borrower) || !dateValid(a.loaned))
      )
        return false;
      if (a.loaned && a.due && String(a.due) < String(a.loaned)) return false;
      if (a.loaned && a.returned && String(a.returned) < String(a.loaned))
        return false;
      if (a.attachment === null) return true;
      if (
        !object(a.attachment) ||
        !shortText(a.attachment.name, 200) ||
        !['application/pdf', 'image/jpeg', 'image/png'].includes(
          String(a.attachment.type),
        ) ||
        typeof a.attachment.data !== 'string' ||
        !new RegExp(
          `^data:${String(a.attachment.type)};base64,[A-Za-z0-9+/]+={0,2}$`,
        ).test(a.attachment.data) ||
        a.attachment.data.length > 350000
      )
        return false;
      bytes += a.attachment.data.length;
      return bytes <= 1400000;
    })
  );
}
export function assetIcs(assets: Asset[]) {
  if (!validAssets(assets)) throw Error('invalid');
  return calendarFile(
    assets.flatMap((a) =>
      [
        { date: a.warranty, title: a.name + ' · Warranty' },
        { date: a.returned ? '' : a.due, title: a.name + ' · ' + a.borrower },
      ]
        .filter((e) => e.date)
        .map((e) => ({
          title: e.title,
          start: new Date(e.date + 'T09:00:00'),
          end: new Date(e.date + 'T09:15:00'),
        })),
    ),
    true,
  );
}
export type Question = {
  id: string;
  kind: 'single' | 'multiple' | 'boolean' | 'blank';
  category: string;
  stem: string;
  options: string[];
  correct: string[];
  explanation: string;
  points: number;
};
export function validQuestions(v: unknown): v is Question[] {
  return (
    Array.isArray(v) &&
    v.length <= 500 &&
    v.every(identified) &&
    uniqueIds(v) &&
    v.every(
      (q) =>
        object(q) &&
        ['single', 'multiple', 'boolean', 'blank'].includes(String(q.kind)) &&
        shortText(q.category, 100) &&
        shortText(q.stem, 2000) &&
        !!q.stem.trim() &&
        Array.isArray(q.options) &&
        q.options.length <= 10 &&
        q.options.every((o) => named(o)) &&
        new Set(q.options).size === q.options.length &&
        Array.isArray(q.correct) &&
        q.correct.length > 0 &&
        q.correct.length <= 10 &&
        q.correct.every((c) => shortText(c, 300) && !!c.trim()) &&
        new Set(q.correct).size === q.correct.length &&
        shortText(q.explanation, 2000) &&
        integer(q.points, 1, 1000) &&
        (q.kind === 'blank' ||
          (q.options.length >= 2 &&
            q.correct.every((c) => (q.options as string[]).includes(c)))) &&
        (q.kind === 'multiple' ||
          q.kind === 'blank' ||
          q.correct.length === 1) &&
        (q.kind !== 'boolean' || q.options.join(',') === 'true,false'),
    )
  );
}
export function scoreQuestions(
  questions: Question[],
  answers: Record<string, string[]>,
) {
  if (!validQuestions(questions)) throw Error('invalid');
  const results = questions.map((q) => {
    const response = Object.hasOwn(answers, q.id) ? answers[q.id] : [];
    const correct =
      q.kind === 'blank'
        ? response.length === 1 &&
          q.correct.some(
            (a) =>
              a.normalize('NFKC').trim().toLocaleLowerCase() ===
              response[0].normalize('NFKC').trim().toLocaleLowerCase(),
          )
        : response.length === q.correct.length &&
          new Set(response).size === response.length &&
          response.every((a) => q.correct.includes(a));
    return { id: q.id, correct, earned: correct ? q.points : 0 };
  });
  return {
    results,
    earned: results.reduce((s, r) => s + r.earned, 0),
    total: questions.reduce((s, q) => s + q.points, 0),
  };
}
export function drawQuestions(
  bank: Question[],
  category: string,
  count: number,
): Question[] {
  if (!validQuestions(bank) || !integer(count, 1, 100)) throw Error('invalid');
  const pool = bank.filter((q) => !category || q.category === category);
  if (pool.length < count) throw Error('questionCount');
  for (let i = pool.length - 1; i > 0; i--) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0];
    const j = n % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
