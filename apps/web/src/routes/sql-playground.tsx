import { useTheme } from '@/hooks/use-theme';
import {
  quoteSqlIdentifier,
  SqlitePlaygroundClient,
  type SqliteExecutionResult,
  type SqliteSchemaObject,
  type SqliteStorageMode,
} from '@/lib/sqlite-playground';
import Editor, { type OnMount } from '@monaco-editor/react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Columns3,
  Database,
  LoaderCircle,
  Play,
  RotateCcw,
  Table2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import '../lib/monaco';

export const Route = createFileRoute('/sql-playground')({
  component: SqlPlaygroundPage,
});

const SAMPLE_QUERIES = {
  select: `SELECT name, salary, hired_at
FROM employees
ORDER BY salary DESC;`,
  join: `SELECT e.name AS employee, d.name AS department, e.salary
FROM employees AS e
JOIN departments AS d ON d.id = e.department_id
ORDER BY d.name, e.salary DESC;`,
  aggregate: `SELECT d.name AS department,
       COUNT(e.id) AS employee_count,
       ROUND(AVG(e.salary), 2) AS average_salary
FROM departments AS d
LEFT JOIN employees AS e ON e.department_id = d.id
GROUP BY d.id, d.name
ORDER BY average_salary DESC;`,
  cte: `WITH ranked AS (
  SELECT name, salary,
         RANK() OVER (ORDER BY salary DESC) AS salary_rank
  FROM employees
)
SELECT * FROM ranked WHERE salary_rank <= 3;`,
} as const;

type SampleName = keyof typeof SAMPLE_QUERIES;
type Status = 'loading' | 'ready' | 'error';

function SqlPlaygroundPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const clientRef = useRef<SqlitePlaygroundClient | null>(null);
  const runRef = useRef<() => void>(() => undefined);
  const [status, setStatus] = useState<Status>('loading');
  const [storage, setStorage] = useState<SqliteStorageMode>('memory');
  const [version, setVersion] = useState('');
  const [schema, setSchema] = useState<SqliteSchemaObject[]>([]);
  const [sql, setSql] = useState<string>(SAMPLE_QUERIES.aggregate);
  const [result, setResult] = useState<SqliteExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let disposed = false;
    const worker = new Worker(
      new URL('../workers/sqlite-playground.worker.ts', import.meta.url),
      { type: 'module' },
    );
    const client = new SqlitePlaygroundClient(worker);
    clientRef.current = client;

    void client
      .init()
      .then((initial) => {
        if (disposed) return;
        setStorage(initial.storage);
        setVersion(initial.version);
        setSchema(initial.schema);
        setStatus('ready');
      })
      .catch((cause: Error) => {
        if (disposed) return;
        setError(cause.message);
        setStatus('error');
      });

    return () => {
      disposed = true;
      clientRef.current = null;
      client.terminate();
    };
  }, []);

  const runSql = async () => {
    const client = clientRef.current;
    if (!client || status !== 'ready' || !sql.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const nextResult = await client.execute(sql);
      setResult(nextResult);
      setSchema(nextResult.schema);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setRunning(false);
    }
  };
  runRef.current = () => void runSql();

  const mountEditor: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
      runRef.current(),
    );
  };

  const resetDatabase = async () => {
    const client = clientRef.current;
    if (!client || !window.confirm(t('sqlPlayground.resetConfirm'))) return;
    setRunning(true);
    setError(null);
    try {
      const initial = await client.reset();
      setSchema(initial.schema);
      setResult(null);
      setSql(SAMPLE_QUERIES.aggregate);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const selectObject = (object: SqliteSchemaObject) => {
    setSql(`SELECT * FROM ${quoteSqlIdentifier(object.name)} LIMIT 100;`);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('sqlPlayground.title')}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={storage === 'opfs' ? 'default' : 'secondary'}>
            {storage === 'opfs'
              ? t('sqlPlayground.persistent')
              : t('sqlPlayground.temporary')}
          </Badge>
          {version && (
            <span className="text-muted-foreground">SQLite {version}</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          onValueChange={(value) => setSql(SAMPLE_QUERIES[value as SampleName])}
        >
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder={t('sqlPlayground.samples')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="select">
              {t('sqlPlayground.sampleSelect')}
            </SelectItem>
            <SelectItem value="join">
              {t('sqlPlayground.sampleJoin')}
            </SelectItem>
            <SelectItem value="aggregate">
              {t('sqlPlayground.sampleAggregate')}
            </SelectItem>
            <SelectItem value="cte">{t('sqlPlayground.sampleCte')}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void resetDatabase()}
          disabled={status !== 'ready' || running}
        >
          <RotateCcw />
          {t('sqlPlayground.reset')}
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {t('sqlPlayground.shortcut')}
        </span>
        <Button
          size="sm"
          onClick={() => void runSql()}
          disabled={status !== 'ready' || running}
        >
          {running ? <LoaderCircle className="animate-spin" /> : <Play />}
          {running ? t('sqlPlayground.running') : t('sqlPlayground.run')}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {status === 'error' ? t('sqlPlayground.initError') : error}
        </div>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-lg border bg-card p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Database className="size-4" />
            {t('sqlPlayground.schema')}
          </div>
          {status === 'loading' ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {t('sqlPlayground.loading')}
            </div>
          ) : schema.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('sqlPlayground.noSchema')}
            </p>
          ) : (
            <div className="max-h-96 space-y-3 overflow-auto">
              {schema.map((object) => (
                <div key={`${object.type}:${object.name}`}>
                  <button
                    type="button"
                    onClick={() => selectObject(object)}
                    className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm font-medium hover:bg-accent"
                    title={t('sqlPlayground.openTable')}
                  >
                    <Table2 className="size-4 shrink-0 text-emerald-500" />
                    <span className="truncate">{object.name}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {object.type === 'view'
                        ? t('sqlPlayground.view')
                        : t('sqlPlayground.table')}
                    </Badge>
                  </button>
                  <div className="ml-3 border-l pl-3">
                    {object.columns.map((column) => (
                      <div
                        key={column.name}
                        className="flex min-w-0 items-center gap-1 py-0.5 text-xs text-muted-foreground"
                      >
                        <Columns3 className="size-3 shrink-0" />
                        <span className="truncate">{column.name}</span>
                        <span className="ml-auto shrink-0 opacity-70">
                          {column.type || 'ANY'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        <main className="min-w-0 space-y-4">
          <section className="overflow-hidden rounded-lg border bg-card">
            <Editor
              height="320px"
              language="sql"
              value={sql}
              onChange={(value) => setSql(value ?? '')}
              onMount={mountEditor}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbersMinChars: 3,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 14, bottom: 14 },
              }}
            />
          </section>
          <ResultPanel result={result} />
        </main>
      </div>
    </div>
  );
}

function ResultPanel({ result }: { result: SqliteExecutionResult | null }) {
  const { t } = useTranslation();

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-sm font-medium">
        {t('sqlPlayground.results')}
        {result && (
          <span className="text-xs font-normal text-muted-foreground">
            {result.rows.length > 0
              ? t('sqlPlayground.rowCount', { count: result.rows.length })
              : t('sqlPlayground.changeCount', { count: result.changes })}
            {' · '}
            {result.elapsedMs} ms
            {result.truncated && ` · ${t('sqlPlayground.truncated')}`}
          </span>
        )}
      </div>
      {!result ? (
        <p className="px-3 py-10 text-center text-sm text-muted-foreground">
          {t('sqlPlayground.noResult')}
        </p>
      ) : result.columns.length === 0 ? (
        <p className="px-3 py-10 text-center text-sm text-muted-foreground">
          {t('sqlPlayground.executed')}
        </p>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr>
                {result.columns.map((column, index) => (
                  <th
                    key={`${column}:${index}`}
                    className="border-b border-r px-3 py-2 text-left font-medium last:border-r-0"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="even:bg-muted/30">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="max-w-80 border-b border-r px-3 py-2 font-mono text-xs last:border-r-0"
                    >
                      {cell === null ? (
                        <span className="italic text-muted-foreground">
                          NULL
                        </span>
                      ) : (
                        String(cell)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
