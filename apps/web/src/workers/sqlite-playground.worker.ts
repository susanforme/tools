import type sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { Database, SqlValue } from '@sqlite.org/sqlite-wasm';
import {
  normalizeSqlValue,
  type SqliteExecutionResult,
  type SqliteInitResult,
  type SqliteSchemaObject,
  type SqliteWorkerRequest,
  type SqliteWorkerResponse,
} from '../lib/sqlite-playground';
import {
  importRuntimeModule,
  loadRuntimeWasm,
  RUNTIME_ASSET_URLS,
} from '../lib/runtime-assets';

const DATABASE_FILE = '/practice.sqlite3';
const MAX_RESULT_ROWS = 500;

const SAMPLE_DATABASE_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  budget INTEGER NOT NULL
);

CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  salary INTEGER NOT NULL,
  hired_at TEXT NOT NULL
);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  status TEXT NOT NULL,
  deadline TEXT NOT NULL
);

INSERT INTO departments (id, name, budget) VALUES
  (1, 'Engineering', 1200000),
  (2, 'Marketing', 650000),
  (3, 'Sales', 800000);

INSERT INTO employees (id, name, department_id, salary, hired_at) VALUES
  (1, 'Alice', 1, 98000, '2022-03-14'),
  (2, 'Bob', 1, 86000, '2023-07-01'),
  (3, 'Carol', 2, 76000, '2021-11-20'),
  (4, 'David', 3, 82000, '2024-01-08'),
  (5, 'Eve', 1, 105000, '2020-05-16'),
  (6, 'Frank', 2, 72000, '2023-09-11'),
  (7, 'Grace', 3, 91000, '2022-12-03');

INSERT INTO projects (id, name, department_id, status, deadline) VALUES
  (1, 'Developer Portal', 1, 'active', '2026-10-31'),
  (2, 'Brand Refresh', 2, 'active', '2026-09-15'),
  (3, 'Enterprise Expansion', 3, 'planned', '2027-01-20'),
  (4, 'Legacy Migration', 1, 'done', '2026-04-30'),
  (5, 'Customer Survey', 2, 'done', '2026-06-18');
`;

type Sqlite3 = Awaited<ReturnType<typeof sqlite3InitModule>>;
type PoolUtil = Awaited<ReturnType<Sqlite3['installOpfsSAHPoolVfs']>>;

let sqlite3: Sqlite3 | null = null;
let pool: PoolUtil | null = null;
let database: Database | null = null;
let storage: SqliteInitResult['storage'] = 'memory';
let initialization: Promise<SqliteInitResult> | null = null;

const workerScope = self as unknown as {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<SqliteWorkerRequest>) => void,
  ): void;
  postMessage(message: SqliteWorkerResponse): void;
};

function requireDatabase(): Database {
  if (!database) throw new Error('SQLite is not initialized');
  return database;
}

async function openDatabase() {
  if (!sqlite3) throw new Error('SQLite is not initialized');
  try {
    pool = await sqlite3.installOpfsSAHPoolVfs({
      name: 'tools-sql-playground',
      directory: '.tools-sql-playground',
      initialCapacity: 6,
    });
    database = new pool.OpfsSAHPoolDb(DATABASE_FILE);
    storage = 'opfs';
  } catch {
    pool = null;
    database = new sqlite3.oo1.DB(':memory:', 'ct');
    storage = 'memory';
  }
  database.exec('PRAGMA foreign_keys = ON');
}

function hasUserTables(): boolean {
  const rows = requireDatabase().exec({
    sql: `SELECT COUNT(*) FROM sqlite_schema
          WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
    rowMode: 0,
    returnValue: 'resultRows',
  });
  return Number(rows[0] ?? 0) > 0;
}

function seedDatabase() {
  if (!hasUserTables()) requireDatabase().exec(SAMPLE_DATABASE_SQL);
}

function readSchema(): SqliteSchemaObject[] {
  const db = requireDatabase();
  const objects = db.exec({
    sql: `SELECT name, type FROM sqlite_schema
          WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
          ORDER BY type, name`,
    rowMode: 'object',
    returnValue: 'resultRows',
  });

  return objects.map((object) => {
    const name = String(object.name);
    const columns = db.exec({
      sql: `SELECT name, type, "notnull" AS not_null, pk
            FROM pragma_table_info(?) ORDER BY cid`,
      bind: name,
      rowMode: 'object',
      returnValue: 'resultRows',
    });
    return {
      name,
      type: object.type === 'view' ? 'view' : 'table',
      columns: columns.map((column) => ({
        name: String(column.name),
        type: String(column.type || ''),
        notNull: Number(column.not_null) === 1,
        primaryKey: Number(column.pk) > 0,
      })),
    };
  });
}

async function initialize(): Promise<SqliteInitResult> {
  if (database && sqlite3) {
    return {
      storage,
      version: sqlite3.version.libVersion,
      schema: readSchema(),
    };
  }
  if (!initialization) {
    initialization = (async () => {
      const scope = globalThis as typeof globalThis & {
        sqlite3ApiConfig?: { disable: { vfs: Record<string, boolean> } };
      };
      scope.sqlite3ApiConfig = {
        disable: { vfs: { opfs: true, 'opfs-wl': true } },
      };
      const module = await importRuntimeModule<{
        default(options: {
          locateFile: () => string;
          wasmBinary: ArrayBuffer;
        }): Promise<Sqlite3>;
      }>('sqliteGlue');
      const initialize = module.default;
      sqlite3 = await initialize({
        locateFile: () => RUNTIME_ASSET_URLS.sqliteWasm,
        wasmBinary: await loadRuntimeWasm('sqliteWasm'),
      });
      await openDatabase();
      seedDatabase();
      return {
        storage,
        version: sqlite3.version.libVersion,
        schema: readSchema(),
      };
    })();
  }
  return initialization;
}

async function execute(sql: string): Promise<SqliteExecutionResult> {
  await initialize();
  const db = requireDatabase();
  const columns: string[] = [];
  const rows: SqlValue[][] = [];
  let truncated = false;
  const startedAt = performance.now();

  db.exec({
    sql,
    columnNames: columns,
    rowMode: 'array',
    callback: (row) => {
      if (rows.length >= MAX_RESULT_ROWS) {
        truncated = true;
        return false;
      }
      rows.push(row);
    },
  });

  return {
    columns,
    rows: rows.map((row) => row.map(normalizeSqlValue)),
    changes: db.changes(),
    elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
    truncated,
    schema: readSchema(),
  };
}

async function reset(): Promise<SqliteInitResult> {
  await initialize();
  requireDatabase().close();
  if (!sqlite3) throw new Error('SQLite is not initialized');

  if (pool) {
    pool.unlink(DATABASE_FILE);
    database = new pool.OpfsSAHPoolDb(DATABASE_FILE);
  } else {
    database = new sqlite3.oo1.DB(':memory:', 'ct');
  }
  database.exec('PRAGMA foreign_keys = ON');
  seedDatabase();
  return { storage, version: sqlite3.version.libVersion, schema: readSchema() };
}

workerScope.addEventListener('message', (event) => {
  const request = event.data;
  void (async () => {
    try {
      const result =
        request.type === 'execute'
          ? await execute(request.sql)
          : request.type === 'reset'
            ? await reset()
            : await initialize();
      workerScope.postMessage({ id: request.id, ok: true, result });
    } catch (cause) {
      workerScope.postMessage({
        id: request.id,
        ok: false,
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  })();
});
