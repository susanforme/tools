import {
  analyzeSqlStructure,
  type SqlStructureRequest,
} from '../lib/sql-structure';
self.onmessage = async ({ data }: MessageEvent<SqlStructureRequest>) => {
  try {
    self.postMessage({ result: await analyzeSqlStructure(data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
