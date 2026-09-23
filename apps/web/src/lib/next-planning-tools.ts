import type { WorkbenchTool } from '@/components/multi-tool-workbench';
import Papa from 'papaparse';

function rows(text: string, columns: string[]): Record<string, string>[] {
  if (text.length > 500_000) throw new Error('Input exceeds 500 KB');
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
  });
  if (parsed.errors.length) throw new Error(parsed.errors[0]!.message);
  if (parsed.data.length > 5_000) throw new Error('Too many rows');
  for (const column of columns)
    if (!parsed.meta.fields?.includes(column))
      throw new Error(`Missing column: ${column}`);
  return parsed.data;
}

export function criticalPath(text: string): Record<string, unknown> {
  const tasks = rows(text, ['id', 'days', 'depends']);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  if (byId.size !== tasks.length || byId.has(''))
    throw new Error('Task IDs must be unique and non-empty');
  const active = new Set<string>();
  const result = new Map<string, { finish: number; path: string[] }>();
  const visit = (id: string): { finish: number; path: string[] } => {
    if (result.has(id)) return result.get(id)!;
    const task = byId.get(id);
    if (!task) throw new Error(`Unknown task: ${id}`);
    if (active.has(id)) throw new Error(`Dependency cycle: ${id}`);
    active.add(id);
    const duration = Number(task.days);
    if (!Number.isFinite(duration) || duration < 0)
      throw new Error(`Invalid duration: ${id}`);
    const previous = (task.depends ?? '')
      .split(/[|;]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map(visit)
      .sort((a, b) => b.finish - a.finish)[0];
    const value = {
      finish: (previous?.finish ?? 0) + duration,
      path: [...(previous?.path ?? []), id],
    };
    active.delete(id);
    result.set(id, value);
    return value;
  };
  const paths = tasks.map((task) => visit(task.id));
  const longest = paths.sort((a, b) => b.finish - a.finish)[0] ?? {
    finish: 0,
    path: [],
  };
  return {
    totalDays: longest.finish,
    criticalPath: longest.path,
    taskFinishDays: Object.fromEntries(
      [...result].map(([id, item]) => [id, item.finish]),
    ),
  };
}

export function decisionSensitivity(text: string): Record<string, unknown> {
  const data = rows(text, ['alternative', 'criterion', 'score', 'weight']);
  const weights = new Map<string, number>();
  const scores = new Map<string, Map<string, number>>();
  for (const row of data) {
    const weight = Number(row.weight),
      score = Number(row.score);
    if (
      !row.alternative ||
      !row.criterion ||
      !Number.isFinite(weight) ||
      weight < 0 ||
      !Number.isFinite(score)
    )
      throw new Error('Invalid decision row');
    if (weights.has(row.criterion) && weights.get(row.criterion) !== weight)
      throw new Error(`Weight differs for ${row.criterion}`);
    weights.set(row.criterion, weight);
    const alternative =
      scores.get(row.alternative) ?? new Map<string, number>();
    if (alternative.has(row.criterion))
      throw new Error('Duplicate alternative/criterion');
    alternative.set(row.criterion, score);
    scores.set(row.alternative, alternative);
  }
  if (
    !scores.size ||
    [...scores.values()].some((score) => score.size !== weights.size)
  )
    throw new Error('Each alternative needs every criterion');
  const ranking = (changed?: string, multiplier = 1) =>
    [...scores]
      .map(([alternative, score]) => ({
        alternative,
        total: [...weights].reduce(
          (sum, [criterion, weight]) =>
            sum +
            score.get(criterion)! *
              weight *
              (criterion === changed ? multiplier : 1),
          0,
        ),
      }))
      .sort((a, b) => b.total - a.total);
  return {
    baseline: ranking(),
    weightSensitivity: Object.fromEntries(
      [...weights.keys()].map((criterion) => [
        criterion,
        {
          lower20PercentWinner: ranking(criterion, 0.8)[0]?.alternative,
          higher20PercentWinner: ranking(criterion, 1.2)[0]?.alternative,
        },
      ]),
    ),
  };
}

function isoDate(text: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Use YYYY-MM-DD');
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text)
    throw new Error('Invalid date');
  return date;
}

export function examStudyPlan(
  subject: string,
  start: string,
  exam: string,
  chapters: number,
): string {
  const first = isoDate(start),
    last = isoDate(exam);
  const availableDays = Math.round(
    (last.getTime() - first.getTime()) / 86_400_000,
  );
  if (
    !subject.trim() ||
    !Number.isInteger(chapters) ||
    chapters < 1 ||
    chapters > 1000 ||
    availableDays < 2 ||
    availableDays > 365
  )
    throw new Error('Invalid subject, chapters, or date range');
  const reviewDays = Math.max(1, Math.ceil(availableDays * 0.2));
  const learningDays = availableDays - reviewDays;
  return Papa.unparse({
    fields: ['date', 'subject', 'phase', 'chapterFrom', 'chapterTo'],
    data: Array.from({ length: availableDays }, (_, index) => {
      const day = new Date(first);
      day.setUTCDate(day.getUTCDate() + index);
      if (index >= learningDays)
        return [day.toISOString().slice(0, 10), subject, 'review', '', ''];
      const from = Math.floor((index * chapters) / learningDays) + 1;
      const to = Math.floor(((index + 1) * chapters) / learningDays);
      return [
        day.toISOString().slice(0, 10),
        subject,
        from <= to ? 'learn' : 'buffer',
        from <= to ? from : '',
        from <= to ? to : '',
      ];
    }),
  });
}

export function subscriptionForecast(text: string, start: string): string {
  const startDate = isoDate(start);
  const data = rows(text, ['name', 'amount', 'cycle', 'firstDate']);
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(
      Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + index, 1),
    );
    return date.toISOString().slice(0, 7);
  });
  const totals = Object.fromEntries(
    months.map((month) => [month, 0]),
  ) as Record<string, number>;
  for (const row of data) {
    const amount = Number(row.amount);
    const first = isoDate(row.firstDate);
    if (
      !row.name ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      !['monthly', 'yearly'].includes(row.cycle)
    )
      throw new Error('Invalid subscription');
    const firstMonth = first.getUTCFullYear() * 12 + first.getUTCMonth();
    months.forEach((month) => {
      const [year, monthNumber] = month.split('-').map(Number);
      const offset = year! * 12 + monthNumber! - 1 - firstMonth;
      if (offset < 0 || (row.cycle === 'yearly' && offset % 12 !== 0)) return;
      const dueDay = Math.min(
        first.getUTCDate(),
        new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate(),
      );
      const due = new Date(Date.UTC(year!, monthNumber! - 1, dueDay));
      if (due >= startDate) totals[month] += amount;
    });
  }
  return Papa.unparse({
    fields: ['month', 'total'],
    data: months.map((month) => [month, totals[month]]),
  });
}

export function luggageVolume(
  text: string,
  capacityLiters: number,
): Record<string, unknown> {
  const data = rows(text, [
    'item',
    'quantity',
    'lengthCm',
    'widthCm',
    'heightCm',
  ]);
  if (!Number.isFinite(capacityLiters) || capacityLiters <= 0)
    throw new Error('Invalid bag capacity');
  const items = data.map((row) => {
    const quantity = Number(row.quantity),
      dimensions = [row.lengthCm, row.widthCm, row.heightCm].map(Number);
    if (
      !row.item ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      dimensions.some((value) => !Number.isFinite(value) || value < 0)
    )
      throw new Error('Invalid item dimensions');
    return {
      item: row.item,
      liters:
        (quantity * dimensions[0]! * dimensions[1]! * dimensions[2]!) / 1000,
    };
  });
  const totalLiters = items.reduce((sum, item) => sum + item.liters, 0);
  return {
    totalLiters,
    capacityLiters,
    remainingLiters: capacityLiters - totalLiters,
    largestItems: items.sort((a, b) => b.liters - a.liters).slice(0, 10),
  };
}

const json = (value: unknown): string => JSON.stringify(value, null, 2);

export const PLANNING_TOOLS: readonly WorkbenchTool[] = [
  {
    id: 'criticalPath',
    fields: [
      {
        id: 'csv',
        label: 'taskCsv',
        sample: 'id,days,depends\nA,2,\nB,3,A\nC,1,A\nD,2,B|C',
      },
    ],
    run: ({ csv }) => ({ output: json(criticalPath(csv ?? '')) }),
  },
  {
    id: 'decisionSensitivity',
    fields: [
      {
        id: 'csv',
        label: 'decisionCsv',
        sample:
          'alternative,criterion,score,weight\nA,price,8,2\nA,quality,6,3\nB,price,6,2\nB,quality,9,3',
      },
    ],
    run: ({ csv }) => ({ output: json(decisionSensitivity(csv ?? '')) }),
  },
  {
    id: 'examStudyPlan',
    fields: [
      { id: 'subject', label: 'subject', sample: '英语' },
      { id: 'start', label: 'startDate', sample: '2026-09-23' },
      { id: 'exam', label: 'examDate', sample: '2026-10-03' },
      { id: 'chapters', label: 'chapterCount', kind: 'number', sample: '8' },
    ],
    run: ({ subject, start, exam, chapters }) => ({
      output: examStudyPlan(
        subject ?? '',
        start ?? '',
        exam ?? '',
        Number(chapters),
      ),
    }),
  },
  {
    id: 'subscriptionForecast',
    fields: [
      {
        id: 'csv',
        label: 'subscriptionCsv',
        sample:
          'name,amount,cycle,firstDate\nCloud,12,monthly,2026-09-01\nDomain,60,yearly,2026-11-01',
      },
      { id: 'start', label: 'startDate', sample: '2026-09-23' },
    ],
    run: ({ csv, start }) => ({
      output: subscriptionForecast(csv ?? '', start ?? ''),
    }),
  },
  {
    id: 'luggageVolume',
    fields: [
      {
        id: 'csv',
        label: 'luggageCsv',
        sample:
          'item,quantity,lengthCm,widthCm,heightCm\n鞋盒,1,30,20,10\n收纳袋,2,20,15,8',
      },
      { id: 'capacity', label: 'bagCapacity', kind: 'number', sample: '30' },
    ],
    run: ({ csv, capacity }) => ({
      output: json(luggageVolume(csv ?? '', Number(capacity))),
    }),
  },
];
