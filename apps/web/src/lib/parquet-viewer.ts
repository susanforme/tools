export const PARQUET_PREVIEW_LIMIT = 10_000;
export type ParquetPreview = {
  rowCount: number;
  columns: string[];
  schema: { name: string; type: string }[];
  rows: string[][];
};

export function parquetCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array)
    return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join(
      ' ',
    );
  if (typeof value === 'object')
    return JSON.stringify(value, (_key, item: unknown) =>
      typeof item === 'bigint' ? item.toString() : item,
    );
  return String(value);
}

export function parquetCsv(columns: string[], rows: string[][]): string {
  const escape = (value: string) =>
    `"${(/^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;
  return (
    '\uFEFF' +
    [columns, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
  );
}

export function filterParquetRows(rows: string[][], query: string): string[][] {
  const term = query.trim().toLocaleLowerCase();
  return term
    ? rows.filter((row) =>
        row.some((cell) => cell.toLocaleLowerCase().includes(term)),
      )
    : rows;
}

export async function readParquetPreview(file: File): Promise<ParquetPreview> {
  if (file.size > 50 * 1024 * 1024) throw new Error('文件不能超过 50 MiB');
  const [{ parquetMetadataAsync, parquetReadObjects }, { compressors }] =
    await Promise.all([import('hyparquet'), import('hyparquet-compressors')]);
  const buffer = {
    byteLength: file.size,
    slice: (start: number, end?: number) =>
      file.slice(start, end).arrayBuffer(),
  };
  const metadata = await parquetMetadataAsync(buffer);
  const rowCount = Number(metadata.num_rows);
  if (!Number.isSafeInteger(rowCount) || rowCount < 0)
    throw new Error('Parquet 行数无效');
  if (
    metadata.row_groups.some(
      (group) => Number(group.total_byte_size) > 256 * 1024 * 1024,
    )
  )
    throw new Error('单个行组解压后不能超过 256 MiB');
  // ponytail: bounded preview; add range pagination when full-file exploration is needed.
  const objects: Record<string, unknown>[] = rowCount
    ? await parquetReadObjects({
        file: buffer,
        metadata,
        compressors,
        rowStart: 0,
        rowEnd: Math.min(rowCount, PARQUET_PREVIEW_LIMIT),
      })
    : [];
  const schema: ParquetPreview['schema'] = [];
  const columns: string[] = [];
  let index = 1;
  const visit = (parent: string, children: number) => {
    for (let child = 0; child < children; child += 1) {
      const field = metadata.schema[index++];
      if (!field) throw new Error('Parquet schema 无效');
      const path = parent ? `${parent}.${field.name}` : field.name;
      if (!parent) columns.push(field.name);
      schema.push({
        name: path,
        type: field.converted_type ?? field.type ?? 'GROUP',
      });
      if (field.num_children) visit(path, field.num_children);
    }
  };
  visit('', metadata.schema[0]?.num_children ?? 0);
  return {
    rowCount,
    schema,
    columns,
    rows: objects.map((row) =>
      columns.map((column) => parquetCell(row[column])),
    ),
  };
}
