import {
  compareTables,
  parseTable,
  type TableDiffRequest,
} from '../lib/table-diff';
self.onmessage = async (
  event: MessageEvent<TableDiffRequest>,
): Promise<void> => {
  try {
    const { before, after, format, key } = event.data;
    const [previous, next] = await Promise.all([
      parseTable(before, format),
      parseTable(after, format),
    ]);
    self.postMessage({ result: compareTables(previous, next, key) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
