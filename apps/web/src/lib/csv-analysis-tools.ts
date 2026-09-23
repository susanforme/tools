import type { WorkbenchTool } from '@/components/multi-tool-workbench';
import Papa from 'papaparse';
import { parseTable } from './next-data-tools';

const csv = (fields: string[], data: Array<Array<string | number>>) =>
  Papa.unparse({ fields, data }, { escapeFormulae: true });

export function unpivotCsv(source: string, identifiers: string): string {
  const { headers, rows } = parseTable(source);
  const keys = identifiers
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  if (!keys.length || keys.some((name) => !headers.includes(name)))
    throw new Error('保留列名不存在');
  const values = headers.filter((name) => !keys.includes(name));
  if (!values.length || headers.includes('field') || headers.includes('value'))
    throw new Error('没有可转换的列，或列名与输出列冲突');
  return csv(
    [...keys, 'field', 'value'],
    rows.flatMap((row) =>
      values.map((name) => [
        ...keys.map((key) => row[key] ?? ''),
        name,
        row[name] ?? '',
      ]),
    ),
  );
}

export function fillDownCsv(source: string, names: string): string {
  const { headers, rows } = parseTable(source);
  const columns = names
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  if (!columns.length || columns.some((name) => !headers.includes(name)))
    throw new Error('列名不存在');
  const previous = new Map<string, string>();
  const data = rows.map((row) =>
    headers.map((name) => {
      const value = row[name] ?? '';
      if (!columns.includes(name)) return value;
      if (value.trim()) {
        previous.set(name, value);
        return value;
      }
      const replacement = previous.get(name);
      if (replacement !== undefined) return replacement;
      return value;
    }),
  );
  return csv(headers, data);
}

export function groupPercentiles(
  source: string,
  group: string,
  metric: string,
): string {
  const { headers, rows } = parseTable(source);
  if (!headers.includes(group) || !headers.includes(metric))
    throw new Error('列名不存在');
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    if (!row[metric]?.trim()) continue;
    const value = Number(row[metric]);
    if (!Number.isFinite(value)) throw new Error(`无效的数字： ${row[metric]}`);
    const key = row[group] ?? '';
    const values = groups.get(key) ?? [];
    values.push(value);
    groups.set(key, values);
  }
  const percentile = (values: number[], fraction: number) => {
    const index = (values.length - 1) * fraction;
    const lower = Math.floor(index);
    return (
      values[lower]! +
      (values[Math.ceil(index)]! - values[lower]!) * (index - lower)
    );
  };
  return csv(
    [group, 'count', 'p25', 'median', 'p75'],
    [...groups].map(([key, values]) => {
      values.sort((a, b) => a - b);
      return [
        key,
        values.length,
        percentile(values, 0.25),
        percentile(values, 0.5),
        percentile(values, 0.75),
      ];
    }),
  );
}

function day(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error('日期格式应为 YYYY-MM-DD');
  const time = Date.parse(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
  )
    throw new Error(`无效的日期： ${value}`);
  return time / 86_400_000;
}

export function missingDates(source: string, column: string): string {
  const { headers, rows } = parseTable(source);
  if (!headers.includes(column)) throw new Error('日期列不存在');
  const dates = [...new Set(rows.map((row) => day(row[column] ?? '')))].sort(
    (a, b) => a - b,
  );
  if (!dates.length) throw new Error('没有日期');
  if (dates.at(-1)! - dates[0]! > 3660) throw new Error('日期范围超过 10 年');
  const known = new Set(dates);
  const missing: string[][] = [];
  for (let value = dates[0]!; value <= dates.at(-1)!; value++)
    if (!known.has(value))
      missing.push([new Date(value * 86_400_000).toISOString().slice(0, 10)]);
  return csv(['missingDate'], missing);
}

export function rollingAverage(
  source: string,
  column: string,
  window: number,
): string {
  const { headers, rows } = parseTable(source);
  if (!headers.includes(column)) throw new Error('数值列不存在');
  if (!Number.isInteger(window) || window < 1 || window > 1000)
    throw new Error('窗口行数应为 1–1000');
  const values = rows.map((row) => {
    const value = Number(row[column]);
    if (!row[column]?.trim() || !Number.isFinite(value))
      throw new Error(`无效的数字： ${row[column]}`);
    return value;
  });
  let sum = 0;
  const data = rows.map((row, index) => {
    sum += values[index]!;
    if (index >= window) sum -= values[index - window]!;
    return [
      ...headers.map((name) => row[name] ?? ''),
      index + 1 < window ? '' : sum / window,
    ];
  });
  return csv([...headers, `${column}_rolling_${window}`], data);
}

export const CSV_ANALYSIS_TOOLS: readonly WorkbenchTool[] = [
  {
    id: 'csvUnpivot',
    fields: [
      { id: 'csv', label: 'csvInput', sample: 'name,Jan,Feb\nA,2,3\nB,4,5' },
      { id: 'keys', label: 'identifierColumns', sample: 'name' },
    ],
    run: ({ csv: input, keys }) => ({
      output: unpivotCsv(input ?? '', keys ?? ''),
    }),
  },
  {
    id: 'csvFillDown',
    fields: [
      {
        id: 'csv',
        label: 'csvInput',
        sample: 'group,item\nA,one\n,two\nB,three',
      },
      { id: 'columns', label: 'fillColumns', sample: 'group' },
    ],
    run: ({ csv: input, columns }) => ({
      output: fillDownCsv(input ?? '', columns ?? ''),
    }),
  },
  {
    id: 'csvGroupPercentiles',
    fields: [
      {
        id: 'csv',
        label: 'csvInput',
        sample: 'team,hours\nA,2\nA,4\nA,6\nB,5',
      },
      { id: 'group', label: 'groupColumn', sample: 'team' },
      { id: 'metric', label: 'valueColumn', sample: 'hours' },
    ],
    run: ({ csv: input, group, metric }) => ({
      output: groupPercentiles(input ?? '', group ?? '', metric ?? ''),
    }),
  },
  {
    id: 'csvMissingDates',
    fields: [
      {
        id: 'csv',
        label: 'csvInput',
        sample: 'date,value\n2026-09-01,1\n2026-09-03,2',
      },
      { id: 'column', label: 'dateColumn', sample: 'date' },
    ],
    run: ({ csv: input, column }) => ({
      output: missingDates(input ?? '', column ?? ''),
    }),
  },
  {
    id: 'csvRollingAverage',
    fields: [
      { id: 'csv', label: 'csvInput', sample: 'day,value\n1,2\n2,4\n3,8' },
      { id: 'column', label: 'valueColumn', sample: 'value' },
      { id: 'window', label: 'windowSize', kind: 'number', sample: '2' },
    ],
    run: ({ csv: input, column, window }) => ({
      output: rollingAverage(input ?? '', column ?? '', Number(window)),
    }),
  },
];
