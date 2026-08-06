import type { SqlValue } from '@sqlite.org/sqlite-wasm';

export type SqlCell = string | number | null;

export type SqliteStorageMode = 'memory' | 'opfs';

export type SqliteSchemaColumn = {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
};

export type SqliteSchemaObject = {
  name: string;
  type: 'table' | 'view';
  columns: SqliteSchemaColumn[];
};

export type SqliteInitResult = {
  storage: SqliteStorageMode;
  version: string;
  schema: SqliteSchemaObject[];
};

export type SqliteExecutionResult = {
  columns: string[];
  rows: SqlCell[][];
  changes: number;
  elapsedMs: number;
  truncated: boolean;
  schema: SqliteSchemaObject[];
};

export type SqliteWorkerRequest =
  | { id: number; type: 'init' }
  | { id: number; type: 'execute'; sql: string }
  | { id: number; type: 'reset' };

type SqliteWorkerRequestPayload =
  | { type: 'init' }
  | { type: 'execute'; sql: string }
  | { type: 'reset' };

export type SqliteWorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

export class SqlitePlaygroundClient {
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();

  constructor(private readonly worker: Worker) {
    worker.addEventListener(
      'message',
      (event: MessageEvent<SqliteWorkerResponse>) => {
        const request = this.pending.get(event.data.id);
        if (!request) return;
        this.pending.delete(event.data.id);
        if (event.data.ok) request.resolve(event.data.result);
        else request.reject(new Error(event.data.error));
      },
    );
    worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'SQLite Worker failed');
      for (const request of this.pending.values()) request.reject(error);
      this.pending.clear();
    });
  }

  init(): Promise<SqliteInitResult> {
    return this.request({ type: 'init' });
  }

  execute(sql: string): Promise<SqliteExecutionResult> {
    return this.request({ type: 'execute', sql });
  }

  reset(): Promise<SqliteInitResult> {
    return this.request({ type: 'reset' });
  }

  terminate() {
    this.worker.terminate();
    const error = new Error('SQLite Worker terminated');
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
  }

  private request<T>(payload: SqliteWorkerRequestPayload): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.worker.postMessage({ ...payload, id });
    });
  }
}

export function normalizeSqlValue(value: SqlValue): SqlCell {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof ArrayBuffer) return `BLOB (${value.byteLength} bytes)`;
  if (ArrayBuffer.isView(value)) return `BLOB (${value.byteLength} bytes)`;
  return value;
}

export function quoteSqlIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
