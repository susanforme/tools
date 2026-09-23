import type { WorkbenchTool } from '@/components/multi-tool-workbench';
import Papa from 'papaparse';
import { isoDate, rows } from './next-planning-tools';

const json = (value: unknown): string => JSON.stringify(value, null, 2);
const dateText = (date: Date): string => date.toISOString().slice(0, 10);

export function teamCapacity(tasks: string, staffing: string) {
  const demand = new Map<string, number>();
  for (const row of rows(tasks, ['role', 'hours'])) {
    const hours = Number(row.hours);
    if (!row.role || !Number.isFinite(hours) || hours < 0)
      throw new Error('任务工时无效');
    demand.set(row.role, (demand.get(row.role) ?? 0) + hours);
  }
  const supply = new Map<string, number>();
  for (const row of rows(staffing, ['role', 'people', 'hoursEach'])) {
    const people = Number(row.people),
      hours = Number(row.hoursEach);
    if (
      !row.role ||
      supply.has(row.role) ||
      !Number.isInteger(people) ||
      people < 0 ||
      !Number.isFinite(hours) ||
      hours < 0
    )
      throw new Error('人员供给无效');
    supply.set(row.role, people * hours);
  }
  return [...new Set([...demand.keys(), ...supply.keys()])].map((role) => ({
    role,
    demandHours: demand.get(role) ?? 0,
    capacityHours: supply.get(role) ?? 0,
    gapHours: (supply.get(role) ?? 0) - (demand.get(role) ?? 0),
  }));
}

export function maintenanceCalendar(source: string, until: string): string {
  const horizon = isoDate(until);
  const entries: Array<[string, string]> = [];
  for (const row of rows(source, ['item', 'lastDate', 'intervalDays'])) {
    const last = isoDate(row.lastDate);
    const interval = Number(row.intervalDays);
    if (
      !row.item ||
      !Number.isInteger(interval) ||
      interval < 1 ||
      interval > 3650
    )
      throw new Error('维护间隔无效');
    if (horizon.getTime() - last.getTime() > 3 * 366 * 86_400_000)
      throw new Error('截止日期超过 3 年');
    for (
      let time = last.getTime() + interval * 86_400_000;
      time <= horizon.getTime();
      time += interval * 86_400_000
    ) {
      if (entries.length >= 1000) throw new Error('生成的日期过多');
      entries.push([dateText(new Date(time)), row.item]);
    }
  }
  entries.sort(([a], [b]) => a.localeCompare(b));
  return Papa.unparse(
    { fields: ['date', 'item'], data: entries },
    { escapeFormulae: true },
  );
}

export function stockRunway(source: string, today: string) {
  const start = isoDate(today);
  return rows(source, ['item', 'quantity', 'dailyUse', 'reserve'])
    .map((row) => {
      const quantity = Number(row.quantity),
        dailyUse = Number(row.dailyUse),
        reserve = Number(row.reserve);
      if (
        !row.item ||
        [quantity, dailyUse, reserve].some(
          (value) => !Number.isFinite(value) || value < 0,
        ) ||
        dailyUse === 0
      )
        throw new Error('库存数据无效');
      const days = Math.max(0, (quantity - reserve) / dailyUse);
      const date = new Date(start.getTime() + Math.floor(days) * 86_400_000);
      return {
        item: row.item,
        daysUntilReserve: Number(days.toFixed(2)),
        reorderBy: dateText(date),
      };
    })
    .sort((a, b) => a.daysUntilReserve - b.daysUntilReserve);
}

export function eventConflicts(source: string) {
  const events = rows(source, ['event', 'resource', 'start', 'end']).map(
    (row) => {
      if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(
          row.start,
        ) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(
          row.end,
        )
      )
        throw new Error('请使用带时区的 ISO 时间');
      const start = Date.parse(row.start),
        end = Date.parse(row.end);
      if (
        !row.event ||
        !row.resource ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= start
      )
        throw new Error('日程数据无效');
      return { event: row.event, resource: row.resource, start, end };
    },
  );
  // ponytail: Pairwise scan is simple; cap input before it becomes slow.
  if (events.length > 1000) throw new Error('日程数量过多');
  const conflicts: Array<{ resource: string; first: string; second: string }> =
    [];
  for (let i = 0; i < events.length; i++)
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i]!,
        b = events[j]!;
      if (a.resource === b.resource && a.start < b.end && b.start < a.end) {
        if (conflicts.length >= 500) throw new Error('冲突数量过多');
        conflicts.push({
          resource: a.resource,
          first: a.event,
          second: b.event,
        });
      }
    }
  return { events: events.length, conflicts };
}

export function workdayDeadline(
  start: string,
  effortHours: number,
  dailyHours: number,
  holidays: string,
) {
  const date = isoDate(start);
  if (
    !Number.isFinite(effortHours) ||
    effortHours <= 0 ||
    effortHours > 100_000 ||
    !Number.isFinite(dailyHours) ||
    dailyHours <= 0 ||
    dailyHours > 24
  )
    throw new Error('工时无效');
  const excluded = new Set(
    holidays
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => dateText(isoDate(value))),
  );
  let remaining = effortHours,
    workingDays = 0;
  for (let index = 0; index < 3660; index++) {
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !excluded.has(dateText(date))) {
      remaining -= dailyHours;
      workingDays++;
      if (remaining <= 0) return { deadline: dateText(date), workingDays };
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }
  throw new Error('截止日期超过 10 年');
}

export const PLANNING_AUDITS: readonly WorkbenchTool[] = [
  {
    id: 'teamCapacity',
    fields: [
      {
        id: 'tasks',
        label: 'capacityTasks',
        sample: 'role,hours\nDesign,30\nBuild,80',
      },
      {
        id: 'staffing',
        label: 'staffingCsv',
        sample: 'role,people,hoursEach\nDesign,1,40\nBuild,2,40',
      },
    ],
    run: ({ tasks, staffing }) => ({
      output: json(teamCapacity(tasks ?? '', staffing ?? '')),
    }),
  },
  {
    id: 'maintenanceCalendar',
    fields: [
      {
        id: 'csv',
        label: 'maintenanceCsv',
        sample: 'item,lastDate,intervalDays\n滤芯,2026-09-01,30',
      },
      { id: 'until', label: 'horizonDate', sample: '2026-12-31' },
    ],
    run: ({ csv, until }) => ({
      output: maintenanceCalendar(csv ?? '', until ?? ''),
    }),
  },
  {
    id: 'stockRunway',
    fields: [
      {
        id: 'csv',
        label: 'stockCsv',
        sample: 'item,quantity,dailyUse,reserve\n咖啡豆,1000,20,100',
      },
      { id: 'today', label: 'startDate', sample: '2026-09-23' },
    ],
    run: ({ csv, today }) => ({
      output: json(stockRunway(csv ?? '', today ?? '')),
    }),
  },
  {
    id: 'eventConflicts',
    fields: [
      {
        id: 'csv',
        label: 'eventCsv',
        sample:
          'event,resource,start,end\nA,Room 1,2026-09-23T09:00+08:00,2026-09-23T10:00+08:00\nB,Room 1,2026-09-23T09:30+08:00,2026-09-23T11:00+08:00',
      },
    ],
    run: ({ csv }) => ({ output: json(eventConflicts(csv ?? '')) }),
  },
  {
    id: 'workdayDeadline',
    fields: [
      { id: 'start', label: 'startDate', sample: '2026-09-23' },
      { id: 'effort', label: 'effortHours', kind: 'number', sample: '40' },
      { id: 'daily', label: 'dailyHours', kind: 'number', sample: '8' },
      {
        id: 'holidays',
        label: 'holidayDates',
        sample: '2026-10-01,2026-10-02',
      },
    ],
    run: ({ start, effort, daily, holidays }) => ({
      output: json(
        workdayDeadline(
          start ?? '',
          Number(effort),
          Number(daily),
          holidays ?? '',
        ),
      ),
    }),
  },
];
