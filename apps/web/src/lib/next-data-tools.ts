import type { WorkbenchTool } from '@/components/multi-tool-workbench';
import Papa from 'papaparse';

export type Table = { headers: string[]; rows: Record<string, string>[] };

export function parseTable(text: string): Table {
  if (new TextEncoder().encode(text).length > 2_000_000)
    throw new Error('CSV exceeds 2 MB');
  const parsed = Papa.parse<string[]>(text, {
    delimiter: ',',
    skipEmptyLines: 'greedy',
  });
  if (parsed.errors.length) throw new Error(parsed.errors[0]!.message);
  const [headers, ...data] = parsed.data;
  if (!headers?.length || new Set(headers).size !== headers.length)
    throw new Error('Missing or duplicate headers');
  if (data.length > 20_000) throw new Error('CSV exceeds 20,000 rows');
  if (data.some((row) => row.length !== headers.length))
    throw new Error('Row width does not match headers');
  return {
    headers,
    rows: data.map((row) =>
      Object.fromEntries(headers.map((key, index) => [key, row[index] ?? ''])),
    ),
  };
}

export function crossTabCsv(
  text: string,
  group: string,
  column: string,
  metric: string,
): string {
  const table = parseTable(text);
  if (![group, column, metric].every((name) => table.headers.includes(name)))
    throw new Error('Unknown column');
  const columnValues = [
    ...new Set(table.rows.map((row) => row[column] ?? '')),
  ].sort();
  if (columnValues.length > 100) throw new Error('Too many pivot columns');
  const totals = new Map<string, Record<string, number>>();
  for (const row of table.rows) {
    const value = Number(row[metric]);
    if (row[metric]?.trim() && !Number.isFinite(value))
      throw new Error(`Non-numeric ${metric}`);
    const key = row[group] ?? '';
    const entry = totals.get(key) ?? {};
    entry[row[column] ?? ''] =
      (entry[row[column] ?? ''] ?? 0) + (row[metric]?.trim() ? value : 0);
    totals.set(key, entry);
  }
  return Papa.unparse(
    {
      fields: [group, ...columnValues],
      data: [...totals].map(([key, sums]) => [
        key,
        ...columnValues.map((value) => sums[value] ?? 0),
      ]),
    },
    { escapeFormulae: true },
  );
}

export function duplicateConflicts(text: string, key: string): string {
  const table = parseTable(text);
  if (!table.headers.includes(key)) throw new Error('Unknown key column');
  const grouped = new Map<string, Record<string, string>[]>();
  for (const row of table.rows) {
    const value = row[key] ?? '';
    const entries = grouped.get(value) ?? [];
    entries.push(row);
    grouped.set(value, entries);
  }
  const conflicts = [...grouped]
    .filter(
      ([, entries]) =>
        entries.length > 1 &&
        new Set(entries.map((entry) => JSON.stringify(entry))).size > 1,
    )
    .map(([value, entries]) => ({ key: value, rows: entries }));
  return JSON.stringify(
    {
      duplicateKeys: [...grouped].filter(([, entries]) => entries.length > 1)
        .length,
      conflictingKeys: conflicts.length,
      conflicts: conflicts.slice(0, 100),
    },
    null,
    2,
  );
}

export function validateCsv(
  text: string,
  required: string,
  numeric: string,
): string {
  const table = parseTable(text);
  const requiredColumns = required
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const numericColumns = numeric
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  for (const column of [...requiredColumns, ...numericColumns])
    if (!table.headers.includes(column))
      throw new Error(`Unknown column: ${column}`);
  const issues: string[] = [];
  table.rows.forEach((row, index) => {
    for (const column of requiredColumns)
      if (!row[column]?.trim())
        issues.push(`row ${index + 2}: ${column} empty`);
    for (const column of numericColumns)
      if (row[column]?.trim() && !Number.isFinite(Number(row[column])))
        issues.push(`row ${index + 2}: ${column} not numeric`);
  });
  return issues.length
    ? issues.slice(0, 500).join('\n') +
        (issues.length > 500 ? `\n... ${issues.length - 500} more` : '')
    : `OK: ${table.rows.length} rows`;
}

export function resampleCsv(
  text: string,
  dateColumn: string,
  valueColumn: string,
): string {
  const table = parseTable(text);
  if (
    !table.headers.includes(dateColumn) ||
    !table.headers.includes(valueColumn)
  )
    throw new Error('Unknown column');
  const buckets = new Map<string, { count: number; sum: number }>();
  for (const row of table.rows) {
    const time = Date.parse(row[dateColumn] ?? '');
    const value = Number(row[valueColumn]);
    if (!Number.isFinite(time) || !Number.isFinite(value))
      throw new Error('Invalid date or number');
    const day = new Date(time).toISOString().slice(0, 10);
    const entry = buckets.get(day) ?? { count: 0, sum: 0 };
    entry.count++;
    entry.sum += value;
    buckets.set(day, entry);
  }
  return Papa.unparse(
    {
      fields: ['date', 'count', 'sum', 'average'],
      data: [...buckets]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, item]) => [
          day,
          item.count,
          item.sum,
          item.sum / item.count,
        ]),
    },
    { escapeFormulae: true },
  );
}

export function simplifyGeoJson(
  text: string,
  tolerance: number,
): Record<string, unknown> {
  if (text.length > 2_000_000) throw new Error('GeoJSON exceeds 2 MB');
  if (!Number.isFinite(tolerance) || tolerance <= 0 || tolerance > 1)
    throw new Error('Tolerance must be 0–1 degrees');
  const input: unknown = JSON.parse(text);
  let before = 0,
    after = 0;
  const simplify = (line: unknown): unknown => {
    if (
      !Array.isArray(line) ||
      line.some(
        (point) =>
          !Array.isArray(point) ||
          !Number.isFinite(point[0]) ||
          !Number.isFinite(point[1]),
      )
    )
      throw new Error('Invalid line coordinates');
    if (line.length > 10_000) throw new Error('Line exceeds 10,000 points');
    before += line.length;
    const points = line as number[][];
    const keep = new Set<number>([0, Math.max(0, points.length - 1)]);
    const stack: Array<[number, number]> = [[0, points.length - 1]];
    while (stack.length) {
      const [first, last] = stack.pop()!;
      const a = points[first]!,
        b = points[last]!;
      let max = tolerance ** 2,
        index = -1;
      const dx = b[0]! - a[0]!,
        dy = b[1]! - a[1]!,
        length = dx * dx + dy * dy;
      for (let i = first + 1; i < last; i++) {
        const p = points[i]!;
        const ratio = length
          ? Math.max(
              0,
              Math.min(
                1,
                ((p[0]! - a[0]!) * dx + (p[1]! - a[1]!) * dy) / length,
              ),
            )
          : 0;
        const x = a[0]! + ratio * dx,
          y = a[1]! + ratio * dy;
        const distance = (p[0]! - x) ** 2 + (p[1]! - y) ** 2;
        if (distance > max) {
          max = distance;
          index = i;
        }
      }
      if (index >= 0) {
        keep.add(index);
        stack.push([first, index], [index, last]);
      }
    }
    const result = points.filter((_, index) => keep.has(index));
    after += result.length;
    return result;
  };
  const visit = (value: unknown): unknown => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return value;
    const item = value as Record<string, unknown>;
    if (item.type === 'FeatureCollection' && Array.isArray(item.features))
      return { ...item, features: item.features.map(visit) };
    if (item.type === 'Feature')
      return { ...item, geometry: visit(item.geometry) };
    if (item.type === 'LineString')
      return { ...item, coordinates: simplify(item.coordinates) };
    if (item.type === 'MultiLineString' && Array.isArray(item.coordinates))
      return { ...item, coordinates: item.coordinates.map(simplify) };
    return item;
  };
  const geojson = visit(input);
  if (!before) throw new Error('No LineString or MultiLineString');
  return { before, after, geojson };
}

export const DATA_TOOLS: readonly WorkbenchTool[] = [
  {
    id: 'csvCrossTab',
    fields: [
      {
        id: 'csv',
        label: 'csvInput',
        sample: 'team,month,hours\nA,Jan,2\nA,Feb,3\nB,Jan,5',
      },
      { id: 'group', label: 'groupColumn', sample: 'team' },
      { id: 'column', label: 'pivotColumn', sample: 'month' },
      { id: 'metric', label: 'valueColumn', sample: 'hours' },
    ],
    run: ({ csv, group, column, metric }) => ({
      output: crossTabCsv(csv ?? '', group ?? '', column ?? '', metric ?? ''),
    }),
  },
  {
    id: 'csvConflicts',
    fields: [
      {
        id: 'csv',
        label: 'csvInput',
        sample: 'id,name\n1,Alice\n2,Bob\n1,Alicia',
      },
      { id: 'key', label: 'keyColumn', sample: 'id' },
    ],
    run: ({ csv, key }) => ({
      output: duplicateConflicts(csv ?? '', key ?? ''),
    }),
  },
  {
    id: 'csvRules',
    fields: [
      { id: 'csv', label: 'csvInput', sample: 'id,amount\n1,3.5\n,abc' },
      { id: 'required', label: 'requiredColumns', sample: 'id' },
      { id: 'numeric', label: 'numericColumns', sample: 'amount' },
    ],
    run: ({ csv, required, numeric }) => ({
      output: validateCsv(csv ?? '', required ?? '', numeric ?? ''),
    }),
  },
  {
    id: 'dailyTotals',
    fields: [
      {
        id: 'csv',
        label: 'csvInput',
        sample: 'date,value\n2026-09-01T08:00:00Z,2\n2026-09-01T09:00:00Z,3',
      },
      { id: 'date', label: 'dateColumn', sample: 'date' },
      { id: 'value', label: 'valueColumn', sample: 'value' },
    ],
    run: ({ csv, date, value }) => ({
      output: resampleCsv(csv ?? '', date ?? '', value ?? ''),
    }),
  },
  {
    id: 'geoSimplify',
    fields: [
      {
        id: 'geojson',
        label: 'geojsonInput',
        sample: '{"type":"LineString","coordinates":[[0,0],[0.5,0.001],[1,0]]}',
      },
      {
        id: 'tolerance',
        label: 'toleranceDegrees',
        kind: 'number',
        sample: '0.01',
      },
    ],
    run: ({ geojson, tolerance }) => ({
      output: JSON.stringify(
        simplifyGeoJson(geojson ?? '', Number(tolerance)),
        null,
        2,
      ),
    }),
  },
];
