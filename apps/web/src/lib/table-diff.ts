export const TABLE_TEXT_LIMIT = 5 * 1024 * 1024;
export type TableFormat = 'csv' | 'json';
export type TableDiffRequest = {
  before: string;
  after: string;
  format: TableFormat;
  key: string | null;
};
export type DataRow = Record<string, unknown>;
export type ParsedTable = { columns: string[]; rows: DataRow[] };
export type CellChange = {
  field: string;
  kind: 'added' | 'removed' | 'changed';
  before: unknown;
  after: unknown;
};
export type RowChange = {
  key: string;
  kind: 'added' | 'removed' | 'changed';
  cells: CellChange[];
};
export type TableDiff = {
  addedColumns: string[];
  removedColumns: string[];
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  rows: RowChange[];
};

export async function parseTable(
  text: string,
  format: TableFormat,
): Promise<ParsedTable> {
  if (text.length > TABLE_TEXT_LIMIT) throw new Error('每份表格不能超过 5 MB');
  if (format === 'json') {
    const data: unknown = JSON.parse(text.replace(/^\uFEFF/, ''));
    if (
      !Array.isArray(data) ||
      data.some(
        (row: unknown) => !row || typeof row !== 'object' || Array.isArray(row),
      )
    )
      throw new Error('JSON 必须是对象数组');
    if (data.length > 20000) throw new Error('每份表格最多 20,000 行');
    const rows = data as DataRow[];
    return { columns: [...new Set(rows.flatMap(Object.keys))], rows };
  }
  const Papa = (await import('papaparse')).default;
  const parsed = Papa.parse<string[]>(text, {
    delimiter: ',',
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  const [columns = [], ...data] = parsed.data;
  if (!columns.length || columns.some((field) => !field.trim()))
    throw new Error('CSV 必须有非空表头');
  if (new Set(columns).size !== columns.length)
    throw new Error('CSV 存在重复列名');
  if (data.length > 20000) throw new Error('每份表格最多 20,000 行');
  const rows = data.map((row, index) => {
    if (row.length !== columns.length)
      throw new Error(`CSV 第 ${index + 2} 行列数与表头不一致`);
    return Object.fromEntries(columns.map((field, i) => [field, row[i]]));
  });
  return { columns, rows };
}

function canonical(value: unknown, depth = 0): string {
  if (depth > 100) throw new Error('JSON 嵌套不能超过 100 层');
  if (Array.isArray(value))
    return `[${value.map((item: unknown) => canonical(item, depth + 1)).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([key, item]) => `${JSON.stringify(key)}:${canonical(item, depth + 1)}`,
      )
      .join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}

function indexRows(
  table: ParsedTable,
  key: string | null,
  side: string,
): Map<string, DataRow> {
  if (key !== null && table.rows.length && !table.columns.includes(key))
    throw new Error(`${side}缺少主键列：${key}`);
  const indexed = new Map<string, DataRow>();
  table.rows.forEach((row, i) => {
    const value = key === null ? i + 1 : row[key];
    if (
      value === null ||
      value === undefined ||
      (typeof value === 'string' && !value.trim()) ||
      !['string', 'number', 'boolean'].includes(typeof value)
    )
      throw new Error(`${side}第 ${i + 1} 行主键为空或不是标量`);
    // CSV 保留字符串与前导零；JSON 主键类型也参与匹配。
    const id = canonical(value);
    if (indexed.has(id)) throw new Error(`${side}主键重复：${String(value)}`);
    indexed.set(id, row);
  });
  return indexed;
}

export function compareTables(
  before: ParsedTable,
  after: ParsedTable,
  key: string | null,
): TableDiff {
  if (key !== null && !key.trim()) throw new Error('请填写主键列名');
  const previous = indexRows(before, key, '原始表格');
  const next = indexRows(after, key, '新表格');
  const result: TableDiff = {
    addedColumns: after.columns.filter(
      (column) => !before.columns.includes(column),
    ),
    removedColumns: before.columns.filter(
      (column) => !after.columns.includes(column),
    ),
    added: 0,
    removed: 0,
    changed: 0,
    unchanged: 0,
    rows: [],
  };
  for (const id of new Set([...previous.keys(), ...next.keys()])) {
    const oldRow = previous.get(id);
    const newRow = next.get(id);
    const cells: CellChange[] = [];
    for (const field of new Set([
      ...Object.keys(oldRow ?? {}),
      ...Object.keys(newRow ?? {}),
    ])) {
      const hasBefore = oldRow !== undefined && Object.hasOwn(oldRow, field);
      const hasAfter = newRow !== undefined && Object.hasOwn(newRow, field);
      if (
        hasBefore === hasAfter &&
        canonical(oldRow?.[field]) === canonical(newRow?.[field])
      )
        continue;
      cells.push({
        field,
        kind: !hasBefore ? 'added' : !hasAfter ? 'removed' : 'changed',
        before: hasBefore ? oldRow?.[field] : null,
        after: hasAfter ? newRow?.[field] : null,
      });
    }
    const kind =
      oldRow === undefined
        ? 'added'
        : newRow === undefined
          ? 'removed'
          : cells.length
            ? 'changed'
            : 'unchanged';
    result[kind]++;
    if (kind !== 'unchanged') result.rows.push({ key: id, kind, cells });
  }
  return result;
}
