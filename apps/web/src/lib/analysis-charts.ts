export type ChartRow = Record<string, string | number | boolean | null>;
export async function parseChartData(
  source: string,
  format: string,
): Promise<{ columns: string[]; rows: ChartRow[] }> {
  if (!source.trim() || source.length > 2_000_000) throw new Error('dataLimit');
  let rows: ChartRow[];
  if (format === 'json') {
    const value: unknown = JSON.parse(source);
    if (
      !Array.isArray(value) ||
      value.some(
        (row: unknown) =>
          !row ||
          typeof row !== 'object' ||
          Array.isArray(row) ||
          Object.values(row).some(
            (cell: unknown) =>
              cell !== null &&
              !['string', 'number', 'boolean'].includes(typeof cell),
          ),
      )
    )
      throw new Error('dataFormat');
    rows = value as ChartRow[];
  } else {
    const { default: Papa } = await import('papaparse');
    const parsed = Papa.parse<string[]>(source, { skipEmptyLines: 'greedy' });
    if (parsed.errors.some((error) => error.code !== 'UndetectableDelimiter'))
      throw new Error('dataFormat');
    const columns = parsed.data.shift()?.map((name) => name.trim()) ?? [];
    if (
      columns.some((name) => !name) ||
      new Set(columns).size !== columns.length ||
      parsed.data.some((row) => row.length !== columns.length)
    )
      throw new Error('dataFormat');
    rows = parsed.data.map((row) =>
      Object.fromEntries(columns.map((name, i) => [name, row[i]])),
    );
  }
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (
    !rows.length ||
    rows.length > 5000 ||
    !columns.length ||
    columns.length > 50 ||
    columns.some((name) => name.length > 100) ||
    rows.some((row) =>
      Object.values(row).some((cell) => String(cell ?? '').length > 10000),
    )
  )
    throw new Error('dataLimit');
  return { columns, rows };
}
export type ChartPoint = { label: string; x: number; y: number; count: number };
export function aggregateChart(
  rows: ChartRow[],
  x: string,
  y: string,
  aggregate: string,
  type: string,
): ChartPoint[] {
  if (
    !['sum', 'mean', 'count', 'min', 'max'].includes(aggregate) ||
    !['bar', 'line', 'scatter', 'pie'].includes(type)
  )
    throw new Error('options');
  const cell = (row: ChartRow, column: string): ChartRow[string] =>
    Object.hasOwn(row, column) ? row[column] : null;
  const numeric = (value: ChartRow[string]): number => {
    if (
      value === null ||
      typeof value === 'boolean' ||
      String(value ?? '').trim() === ''
    )
      throw new Error('numericColumn');
    const number = Number(value);
    if (!Number.isFinite(number) || Math.abs(number) > 1e12)
      throw new Error('numericColumn');
    return number;
  };
  if (type === 'scatter') {
    if (rows.length > 1000) throw new Error('scatterLimit');
    return rows.map((row, i) => ({
      label: String(i + 1),
      x: numeric(cell(row, x)),
      y: numeric(cell(row, y)),
      count: 1,
    }));
  }
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const label = String(cell(row, x) ?? '');
    const values = groups.get(label) ?? [];
    values.push(aggregate === 'count' ? 1 : numeric(cell(row, y)));
    groups.set(label, values);
  }
  if (groups.size > 100) throw new Error('groupLimit');
  const points = [...groups].map(([label, values], index) => ({
    label,
    x: index,
    count: values.length,
    y:
      aggregate === 'count'
        ? values.length
        : aggregate === 'min'
          ? Math.min(...values)
          : aggregate === 'max'
            ? Math.max(...values)
            : values.reduce((a, b) => a + b, 0) /
              (aggregate === 'mean' ? values.length : 1),
  }));
  if (
    type === 'pie' &&
    (points.some((point) => point.y < 0) ||
      points.every((point) => point.y === 0))
  )
    throw new Error('pieValues');
  return points;
}
