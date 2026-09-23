import { studyRows } from './study-print';
export const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, n = 200): v is string =>
  typeof v === 'string' && v.length <= n;
export const validDay = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
const amount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 1e12;
export type LedgerEntry = {
  id: string;
  date: string;
  kind: 'income' | 'expense' | 'transfer';
  category: string;
  account: string;
  to: string;
  cents: number;
  note: string;
};
export type Ledger = {
  entries: LedgerEntry[];
  budgets: { category: string; cents: number }[];
};
export function validLedger(v: unknown): v is Ledger {
  return (
    record(v) &&
    Array.isArray(v.entries) &&
    v.entries.length <= 5000 &&
    v.entries.every(
      (e) =>
        record(e) &&
        str(e.id) &&
        validDay(e.date) &&
        ['income', 'expense', 'transfer'].includes(String(e.kind)) &&
        str(e.category) &&
        str(e.account) &&
        !!e.account &&
        str(e.to) &&
        (e.kind !== 'transfer' || (!!e.to && e.to !== e.account)) &&
        amount(e.cents) &&
        e.cents > 0 &&
        str(e.note, 1000),
    ) &&
    new Set(v.entries.map((e) => (e as LedgerEntry).id)).size ===
      v.entries.length &&
    Array.isArray(v.budgets) &&
    v.budgets.length <= 100 &&
    v.budgets.every(
      (b) => record(b) && str(b.category) && !!b.category && amount(b.cents),
    ) &&
    new Set(v.budgets.map((b) => (b as Ledger['budgets'][number]).category))
      .size === v.budgets.length
  );
}
export function parseMoney(s: string): number {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s.trim())) throw Error('invalid');
  const [whole, fraction = ''] = s.trim().split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!amount(result)) throw Error('invalid');
  return result;
}
export function ledgerReport(data: Ledger, month: string) {
  const balances: Record<string, number> = Object.create(null) as Record<
    string,
    number
  >;
  const categories: Record<string, number> = Object.create(null) as Record<
    string,
    number
  >;
  let income = 0,
    expense = 0;
  for (const e of data.entries) {
    balances[e.account] =
      (balances[e.account] ?? 0) + (e.kind === 'income' ? e.cents : -e.cents);
    if (e.kind === 'transfer') balances[e.to] = (balances[e.to] ?? 0) + e.cents;
    if (!e.date.startsWith(month)) continue;
    if (e.kind === 'income') income += e.cents;
    if (e.kind === 'expense') {
      expense += e.cents;
      categories[e.category] = (categories[e.category] ?? 0) + e.cents;
    }
  }
  return { income, expense, balances, categories };
}
export async function importLedgerCsv(text: string): Promise<LedgerEntry[]> {
  const rows = await studyRows(text);
  const expected = [
    'date',
    'kind',
    'category',
    'account',
    'to',
    'amount',
    'note',
  ];
  if (rows[0]?.join(',') !== expected.join(',')) throw Error('csv');
  const entries = rows.slice(1).map((r, i) => {
    if (r.length !== 7) throw Error('csv');
    return {
      id: `import-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
      date: r[0],
      kind: r[1] as LedgerEntry['kind'],
      category: r[2],
      account: r[3],
      to: r[4],
      cents: parseMoney(r[5]),
      note: r[6],
    };
  });
  if (!validLedger({ entries, budgets: [] })) throw Error('csv');
  return entries;
}
export type WorkEntry = {
  id: string;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
  project: string;
};
export function workMinutes(e: WorkEntry): number {
  const clock = (v: string) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw Error('invalid');
    const [h, m] = v.split(':').map(Number);
    return h * 60 + m;
  };
  const s = clock(e.start),
    t = clock(e.end);
  const duration = t > s ? t - s : t + 1440 - s;
  if (
    !Number.isInteger(e.breakMinutes) ||
    e.breakMinutes < 0 ||
    e.breakMinutes >= duration
  )
    throw Error('invalid');
  return duration - e.breakMinutes;
}
export function validWorkEntries(v: unknown): v is WorkEntry[] {
  return (
    Array.isArray(v) &&
    v.length <= 5000 &&
    new Set(v.filter(record).map((e) => e.id)).size === v.length &&
    v.every((e) => {
      if (
        !record(e) ||
        !str(e.id) ||
        !validDay(e.date) ||
        !str(e.start) ||
        !str(e.end) ||
        !str(e.project) ||
        typeof e.breakMinutes !== 'number'
      )
        return false;
      try {
        workMinutes(e as WorkEntry);
        return true;
      } catch {
        return false;
      }
    })
  );
}
export type GardenBed = {
  id: string;
  name: string;
  width: number;
  height: number;
};
export type Planting = {
  id: string;
  bed: string;
  crop: string;
  x: number;
  y: number;
  width: number;
  height: number;
  spacing: number;
  sow: string;
  transplant: string;
  note: string;
};
export type Garden = {
  beds: GardenBed[];
  plants: Planting[];
  care: { id: string; date: string; crop: string; note: string }[];
};
export function plantCount(
  p: Pick<Planting, 'width' | 'height' | 'spacing'>,
): number {
  return Math.floor(p.width / p.spacing) * Math.floor(p.height / p.spacing);
}
export function validGarden(v: unknown): v is Garden {
  if (
    !record(v) ||
    !Array.isArray(v.beds) ||
    v.beds.length < 1 ||
    v.beds.length > 20 ||
    !Array.isArray(v.plants) ||
    v.plants.length > 300 ||
    !Array.isArray(v.care) ||
    v.care.length > 1000
  )
    return false;
  const positive = (n: unknown) =>
    typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 100000;
  const beds = v.beds;
  if (
    !beds.every(
      (b) =>
        record(b) &&
        str(b.id) &&
        str(b.name) &&
        positive(b.width) &&
        positive(b.height),
    ) ||
    new Set(beds.map((b) => b.id)).size !== beds.length
  )
    return false;
  return (
    v.plants.every((p) => {
      if (
        !record(p) ||
        !str(p.id) ||
        !str(p.bed) ||
        !str(p.crop) ||
        !str(p.note, 1000) ||
        !positive(p.width) ||
        !positive(p.height) ||
        !positive(p.spacing) ||
        Number(p.spacing) < 0.1 ||
        !Number.isSafeInteger(plantCount(p as Planting)) ||
        typeof p.x !== 'number' ||
        typeof p.y !== 'number' ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.y < 0 ||
        !validDay(p.sow) ||
        (p.transplant !== '' && !validDay(p.transplant))
      )
        return false;
      const b = beds.find((b) => b.id === p.bed);
      return (
        !!b &&
        p.x + Number(p.width) <= b.width &&
        p.y + Number(p.height) <= b.height
      );
    }) &&
    new Set(v.plants.map((p) => p.id)).size === v.plants.length &&
    v.care.every(
      (c) =>
        record(c) &&
        str(c.id) &&
        validDay(c.date) &&
        str(c.crop) &&
        str(c.note, 1000),
    ) &&
    new Set(v.care.map((c) => c.id)).size === v.care.length
  );
}
