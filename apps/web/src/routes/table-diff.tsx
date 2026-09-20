import { useTaskWorker } from '@/hooks/use-task-worker';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import {
  TABLE_TEXT_LIMIT,
  type TableDiff,
  type TableDiffRequest,
  type TableFormat,
} from '@/lib/table-diff';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';

export const Route = createFileRoute('/table-diff')({
  component: TableDiffPage,
});
const PAGE_SIZE = 50;
const QUERY_PARAMS = {
  format: StringParam,
  mode: StringParam,
  key: StringParam,
};

const createWorker = (): Worker =>
  new Worker(new URL('../workers/table-diff.worker.ts', import.meta.url), {
    type: 'module',
  });

function TableDiffPage() {
  const runWorker = useTaskWorker<TableDiffRequest, TableDiff>(createWorker);
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    format: string;
    mode: string;
    key: string;
  }>(QUERY_PARAMS);
  const format: TableFormat = query.format === 'json' ? 'json' : 'csv';
  const mode = query.mode === 'position' ? 'position' : 'key';
  const key = query.key ?? '';
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');
  const [result, setResult] = useState<TableDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [inputVersion, setInputVersion] = useState(0);
  const cells = useMemo(
    () =>
      result?.rows.flatMap((row) =>
        row.cells.map((cell) => ({ ...cell, key: row.key, rowKind: row.kind })),
      ) ?? [],
    [result],
  );
  const pages = Math.max(1, Math.ceil(cells.length / PAGE_SIZE));
  const invalidate = (): void => {
    setResult(null);
    setError(null);
    setPage(0);
  };
  const loadFile = async (
    file: File | undefined,
    side: 'before' | 'after',
  ): Promise<void> => {
    if (!file) return;
    invalidate();
    setBusy(true);
    try {
      if (file.size > TABLE_TEXT_LIMIT)
        throw new Error(t('tableDiff.tooLarge'));
      const content = await file.text();
      if (side === 'before') setBefore(content);
      else setAfter(content);
    } catch (cause) {
      setError(t('tableDiff.loadError', { message: (cause as Error).message }));
    } finally {
      setBusy(false);
    }
  };
  const compare = async (): Promise<void> => {
    invalidate();
    setBusy(true);
    try {
      setResult(
        await runWorker({
          before,
          after,
          format,
          key: mode === 'key' ? key : null,
        }),
      );
    } catch (cause) {
      setError(t('tableDiff.error', { message: (cause as Error).message }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold">{t('tableDiff.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('tableDiff.limits')}</p>
      <fieldset disabled={busy} className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2">
            <Label>{t('tableDiff.format')}</Label>
            <Select
              value={format}
              onValueChange={(value) => {
                void setQuery({ format: value });
                invalidate();
              }}
            >
              <SelectTrigger
                aria-label={t('tableDiff.format')}
                className="w-28"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('tableDiff.mode')}</Label>
            <Select
              value={mode}
              onValueChange={(value) => {
                void setQuery({ mode: value });
                invalidate();
              }}
            >
              <SelectTrigger aria-label={t('tableDiff.mode')} className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="key">{t('tableDiff.keyMode')}</SelectItem>
                <SelectItem value="position">
                  {t('tableDiff.positionMode')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === 'key' && (
            <div className="space-y-2">
              <Label htmlFor="table-key">{t('tableDiff.key')}</Label>
              <Input
                id="table-key"
                value={key}
                onChange={(event) => {
                  void setQuery({ key: event.target.value });
                  invalidate();
                }}
                className="w-44"
              />
            </div>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(['before', 'after'] as const).map((side) => (
            <div key={side} className="space-y-2">
              <Label htmlFor={`table-${side}`}>{t(`tableDiff.${side}`)}</Label>
              <Input
                key={`${side}-${inputVersion}`}
                type="file"
                accept={
                  format === 'json' ? '.json,application/json' : '.csv,text/csv'
                }
                aria-label={t(`tableDiff.${side}`)}
                onChange={(event) =>
                  void loadFile(event.target.files?.[0], side)
                }
              />
              <Textarea
                id={`table-${side}`}
                value={side === 'before' ? before : after}
                onChange={(event) => {
                  if (side === 'before') setBefore(event.target.value);
                  else setAfter(event.target.value);
                  invalidate();
                }}
                className="h-64 font-mono text-sm"
                spellCheck={false}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void compare()}
            disabled={!before.trim() || !after.trim()}
          >
            {t(busy ? 'tableDiff.comparing' : 'tableDiff.compare')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setBefore('');
              setAfter('');
              setInputVersion((value) => value + 1);
              invalidate();
            }}
          >
            {t('tableDiff.clear')}
          </Button>
        </div>
      </fieldset>
      {error && (
        <div
          role="alert"
          className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2"
        >
          {error}
        </div>
      )}
      {result && (
        <section className="space-y-3" aria-live="polite">
          <div className="flex flex-wrap items-center gap-4">
            {(['added', 'removed', 'changed', 'unchanged'] as const).map(
              (kind) => (
                <span key={kind}>
                  {t(`tableDiff.${kind}`)}: {result[kind]}
                </span>
              ),
            )}
            <Button
              variant="outline"
              onClick={() =>
                downloadBlob(
                  new Blob([JSON.stringify(result, null, 2)], {
                    type: 'application/json',
                  }),
                  'table-diff.json',
                )
              }
            >
              {t('tableDiff.download')}
            </Button>
          </div>
          {result.addedColumns.length > 0 && (
            <p className="text-sm break-all">
              {t('tableDiff.columnsAdded')}: {result.addedColumns.join(', ')}
            </p>
          )}
          {result.removedColumns.length > 0 && (
            <p className="text-sm break-all">
              {t('tableDiff.columnsRemoved')}:{' '}
              {result.removedColumns.join(', ')}
            </p>
          )}
          {!result.rows.length && <p>{t('tableDiff.empty')}</p>}
          {cells
            .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
            .map((cell, index) => (
              <article
                key={`${page}-${index}`}
                className="border rounded-md p-3 space-y-2 text-sm"
              >
                <p className="font-medium break-all">
                  {t('tableDiff.row')}: {cell.key} (
                  {t(`tableDiff.${cell.rowKind}`)}) · {cell.field} ·{' '}
                  {t(`tableDiff.${cell.kind}`)}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">
                      {t('tableDiff.before')}
                    </span>
                    <pre className="whitespace-pre-wrap break-all max-h-32 overflow-auto">
                      {cell.kind === 'added'
                        ? t('tableDiff.missing')
                        : JSON.stringify(cell.before)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {t('tableDiff.after')}
                    </span>
                    <pre className="whitespace-pre-wrap break-all max-h-32 overflow-auto">
                      {cell.kind === 'removed'
                        ? t('tableDiff.missing')
                        : JSON.stringify(cell.after)}
                    </pre>
                  </div>
                </div>
              </article>
            ))}
          {pages > 1 && (
            <div className="flex gap-3 items-center">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                {t('tableDiff.previous')}
              </Button>
              <span>
                {t('tableDiff.page', { page: page + 1, total: pages })}
              </span>
              <Button
                variant="outline"
                disabled={page + 1 >= pages}
                onClick={() => setPage(page + 1)}
              >
                {t('tableDiff.next')}
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
