import { parquetCell, parquetCsv } from './parquet-viewer';
export const ARROW_ROW_LIMIT = 10_000;
export async function inspectArrow(bytes: Uint8Array) {
  if (bytes.byteLength > 50 * 1024 * 1024)
    throw new Error('文件不能超过 50 MiB');
  const { RecordBatchReader, tableFromIPC } = await import('apache-arrow');
  const reader = RecordBatchReader.from(bytes).open();
  if (!reader.schema) throw new Error('未找到 Arrow IPC Schema');
  const table = tableFromIPC(reader);
  const columns = table.schema.fields.map((field) => field.name);
  const rows: unknown[][] = [];
  for (
    let index = 0;
    index < Math.min(table.numRows, ARROW_ROW_LIMIT);
    index++
  ) {
    rows.push(
      columns.map(
        (_, column) => table.getChildAt(column)?.get(index) as unknown,
      ),
    );
  }
  const json = JSON.stringify(
    { columns, rows },
    (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    2,
  );
  const cells = rows.map((row) => row.map(parquetCell));
  return {
    rowCount: table.numRows,
    columns,
    rows: cells,
    schema: table.schema.fields.map((field) => ({
      name: field.name,
      type: field.type.toString(),
      nullable: field.nullable,
      metadata: Object.fromEntries(field.metadata),
    })),
    batches: table.batches.map((batch, index) => ({
      index,
      rows: batch.numRows,
    })),
    json,
    csv: parquetCsv(columns, cells),
  };
}
export type ArrowPreview = Awaited<ReturnType<typeof inspectArrow>>;
