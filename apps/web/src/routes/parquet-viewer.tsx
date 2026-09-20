import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { StringParam, useQueryParam } from '../hooks/useQueryParams';
import { downloadBlob } from '../lib/download';
import {
  filterParquetRows,
  parquetCsv,
  type ParquetPreview,
} from '../lib/parquet-viewer';

export const Route = createFileRoute('/parquet-viewer')({
  component: ParquetViewerPage,
});
const PAGE_SIZE = 50;

function ParquetViewerPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParam<string>('q', StringParam, '');
  const [preview, setPreview] = useState<ParquetPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  useEffect(() => () => workerRef.current?.terminate(), []);
  const filtered = useMemo(
    () => filterParquetRows(preview?.rows ?? [], query),
    [preview, query],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);

  const load = (file: File | null) => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setPreview(null);
    setPage(0);
    setError(null);
    setLoading(false);
    if (!file) return;
    setFileName(file.name);
    if (file.size > 50 * 1024 * 1024) {
      setError(t('parquetViewer.tooLarge'));
      return;
    }
    let worker: Worker;
    try {
      worker = new Worker(
        new URL('../workers/parquet-viewer.worker.ts', import.meta.url),
        { type: 'module' },
      );
    } catch (cause) {
      setError(t('parquetViewer.error', { message: (cause as Error).message }));
      return;
    }
    workerRef.current = worker;
    setLoading(true);
    worker.onmessage = (
      event: MessageEvent<{ result?: ParquetPreview; error?: string }>,
    ) => {
      if (workerRef.current !== worker) return;
      if (event.data.result) setPreview(event.data.result);
      if (event.data.error)
        setError(t('parquetViewer.error', { message: event.data.error }));
      setLoading(false);
      worker.terminate();
      workerRef.current = null;
    };
    worker.onerror = (event) => {
      if (workerRef.current !== worker) return;
      setError(t('parquetViewer.error', { message: event.message }));
      setLoading(false);
      worker.terminate();
      workerRef.current = null;
    };
    worker.postMessage(file);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('parquetViewer.title')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('parquetViewer.limits')}
      </p>
      <div className="space-y-2">
        <Label htmlFor="parquet-file">{t('parquetViewer.file')}</Label>
        <Input
          id="parquet-file"
          type="file"
          accept=".parquet"
          onChange={(event) => load(event.target.files?.[0] ?? null)}
        />
      </div>
      {loading && (
        <div className="flex items-center gap-2">
          <p role="status">{t('parquetViewer.loading')}</p>
          <Button variant="outline" onClick={() => load(null)}>
            {t('parquetViewer.cancel')}
          </Button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {preview && (
        <>
          <p role="status" className="text-sm">
            {t('parquetViewer.summary', {
              total: preview.rowCount,
              loaded: preview.rows.length,
              filtered: filtered.length,
            })}
          </p>
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer font-medium">
              {t('parquetViewer.schema')}
            </summary>
            <dl className="mt-3 grid max-h-64 grid-cols-[minmax(0,1fr)_auto] gap-2 overflow-auto text-sm">
              {preview.schema.map((field, index) => (
                <div key={index} className="contents">
                  <dt className="break-all font-mono">{field.name}</dt>
                  <dd className="text-muted-foreground">{field.type}</dd>
                </div>
              ))}
            </dl>
          </details>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="parquet-filter">{t('parquetViewer.filter')}</Label>
            <Input
              id="parquet-filter"
              className="w-full md:w-80"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
            <Button
              variant="outline"
              onClick={() =>
                downloadBlob(
                  new Blob([parquetCsv(preview.columns, filtered)], {
                    type: 'text/csv;charset=utf-8',
                  }),
                  `${fileName}.csv`,
                )
              }
            >
              {t('parquetViewer.download')}
            </Button>
          </div>
          <div className="max-h-[520px] overflow-auto rounded-md border">
            <Table className="w-full min-w-max text-sm">
              <TableHeader className="sticky top-0 bg-muted">
                <TableRow>
                  {preview.columns.map((column, index) => (
                    <TableHead
                      key={index}
                      className="border-b px-3 py-2 text-left"
                    >
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered
                  .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
                  .map((row, rowIndex) => (
                    <TableRow key={rowIndex} className="even:bg-muted/30">
                      {row.map((cell, index) => (
                        <TableCell
                          key={index}
                          className="max-w-96 truncate border-b px-3 py-2 font-mono text-xs"
                          title={cell}
                        >
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('parquetViewer.empty')}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              {t('parquetViewer.previous')}
            </Button>
            <span className="text-sm">
              {currentPage + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              disabled={currentPage + 1 >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              {t('parquetViewer.next')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
