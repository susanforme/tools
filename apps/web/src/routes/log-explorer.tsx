import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import {
  LOG_LEVELS,
  type LogFilters,
  type LogScanResult,
  type LogWorkerResponse,
} from '@/lib/log-explorer';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/log-explorer')({
  component: LogExplorerPage,
});
function LogExplorerPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    level: string;
    from: string;
    to: string;
  }>({ level: StringParam, from: StringParam, to: StringParam });
  const level = LOG_LEVELS.includes(query.level as (typeof LOG_LEVELS)[number])
    ? (query.level ?? 'all')
    : 'all';
  const from = query.from ?? '';
  const to = query.to ?? '';
  const [keyword, setKeyword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<LogScanResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ bytes: 0, lines: 0 });
  const [error, setError] = useState<string | null>(null);
  const [canceled, setCanceled] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const stop = (): void => {
    workerRef.current?.terminate();
    workerRef.current = null;
  };
  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );
  // 外部 URL 变化也要使旧结果失效。
  useEffect(() => {
    stop();
    setBusy(false);
    setResult(null);
    setSelected(new Set());
    setPage(0);
    setCanceled(false);
  }, [level, from, to, keyword, file]);
  const scan = (): void => {
    if (!file) return;
    stop();
    setResult(null);
    setSelected(new Set());
    setPage(0);
    setError(null);
    setCanceled(false);
    const filters: LogFilters = {
      keyword,
      level,
      from: from ? Date.parse(from) : null,
      to: to ? Date.parse(to) : null,
    };
    if (
      (filters.from !== null && !Number.isFinite(filters.from)) ||
      (filters.to !== null && !Number.isFinite(filters.to)) ||
      (filters.from !== null &&
        filters.to !== null &&
        filters.from > filters.to)
    ) {
      setError(t('logExplorer.invalidTime'));
      return;
    }
    setBusy(true);
    setProgress({ bytes: 0, lines: 0 });
    try {
      const worker = new Worker(
        new URL('../workers/log-explorer.worker.ts', import.meta.url),
        { type: 'module' },
      );
      workerRef.current = worker;
      worker.onmessage = ({ data }: MessageEvent<LogWorkerResponse>) => {
        if (workerRef.current !== worker) return;
        if (data.type === 'progress') {
          setProgress({ bytes: data.bytes, lines: data.lines });
          return;
        }
        if (data.type === 'result') setResult(data.result);
        else setError(t('logExplorer.failed', { message: data.error }));
        stop();
        setBusy(false);
      };
      worker.onerror = () => {
        if (workerRef.current !== worker) return;
        setError(
          t('logExplorer.failed', { message: t('logExplorer.workerFailed') }),
        );
        stop();
        setBusy(false);
      };
      worker.postMessage({ file, filters });
    } catch (caught) {
      stop();
      setBusy(false);
      setError(t('logExplorer.failed', { message: (caught as Error).message }));
    }
  };
  const pages = Math.max(1, Math.ceil((result?.rows.length ?? 0) / 100));
  const rows = result?.rows.slice(page * 100, (page + 1) * 100) ?? [];
  const toggle = (line: number, checked: boolean): void =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(line);
      else next.delete(line);
      return next;
    });
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('logExplorer.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('logExplorer.description')}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="log-file">{t('logExplorer.file')}</Label>
        <Input
          id="log-file"
          type="file"
          accept=".log,.txt,.jsonl,.ndjson"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError(null);
          }}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="log-keyword">{t('logExplorer.keyword')}</Label>
          <Input
            id="log-keyword"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="log-level">{t('logExplorer.level')}</Label>
          <Select
            value={level}
            onValueChange={(value) => setQuery({ level: value })}
          >
            <SelectTrigger id="log-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('logExplorer.all')}</SelectItem>
              {LOG_LEVELS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item === 'unknown'
                    ? t('logExplorer.unknown')
                    : item.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="log-from">{t('logExplorer.from')}</Label>
          <Input
            id="log-from"
            type="datetime-local"
            step="1"
            value={from}
            onChange={(event) => setQuery({ from: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="log-to">{t('logExplorer.to')}</Label>
          <Input
            id="log-to"
            type="datetime-local"
            step="1"
            value={to}
            onChange={(event) => setQuery({ to: event.target.value })}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t('logExplorer.limits')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={scan} disabled={!file || busy}>
          {t('logExplorer.scan')}
        </Button>
        {busy && (
          <>
            <Button
              variant="outline"
              onClick={() => {
                stop();
                setBusy(false);
                setCanceled(true);
              }}
            >
              {t('logExplorer.cancel')}
            </Button>
            <span role="status" className="text-sm text-muted-foreground">
              {t('logExplorer.progress', {
                percent: Math.floor(
                  (progress.bytes / Math.max(file?.size ?? 1, 1)) * 100,
                ),
                lines: progress.lines,
              })}
            </span>
          </>
        )}
        {canceled && (
          <span role="status" className="text-sm text-muted-foreground">
            {t('logExplorer.canceled')}
          </span>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {result && (
        <>
          <p className="text-sm">
            {t('logExplorer.scope', {
              lines: result.scannedLines,
              matches: result.matches,
              retained: result.rows.length,
            })}
          </p>
          {result.skippedLongLines > 0 && (
            <p className="text-sm text-muted-foreground">
              {t('logExplorer.skipped', { count: result.skippedLongLines })}
            </p>
          )}
          {result.limited && (
            <p className="text-sm text-destructive">
              {t('logExplorer.limited')}
            </p>
          )}
          {result.errorGroups.length > 0 && (
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {t('logExplorer.groups')}
              </summary>
              {result.groupsLimited && (
                <p className="my-2 text-sm text-muted-foreground">
                  {t('logExplorer.groupLimit')}
                </p>
              )}
              <div className="mt-3 space-y-2">
                {result.errorGroups.map((group) => (
                  <div key={group.message} className="flex gap-3 text-sm">
                    <span className="shrink-0 tabular-nums">{group.count}</span>
                    <code className="min-w-0 break-all">{group.message}</code>
                  </div>
                ))}
              </div>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!rows.length}
              onClick={() =>
                setSelected(
                  (previous) =>
                    new Set([...previous, ...rows.map((row) => row.line)]),
                )
              }
            >
              {t('logExplorer.selectPage')}
            </Button>
            <Button
              variant="outline"
              disabled={!selected.size}
              onClick={() => setSelected(new Set())}
            >
              {t('logExplorer.clearSelection')}
            </Button>
            <Button
              disabled={!selected.size}
              onClick={() =>
                downloadBlob(
                  new Blob(
                    [
                      result.rows
                        .filter((row) => selected.has(row.line))
                        .map((row) => row.raw)
                        .join('\n') + '\n',
                    ],
                    { type: 'text/plain;charset=utf-8' },
                  ),
                  'selected-logs.log',
                )
              }
            >
              {t('logExplorer.export', { count: selected.size })}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table className="w-full text-left text-sm">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="p-2">{t('logExplorer.line')}</TableHead>
                  <TableHead className="p-2">
                    {t('logExplorer.level')}
                  </TableHead>
                  <TableHead className="p-2">{t('logExplorer.time')}</TableHead>
                  <TableHead className="p-2">
                    {t('logExplorer.message')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.line} className="border-t align-top">
                    <TableCell className="p-2">
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={selected.has(row.line)}
                          onCheckedChange={(value) =>
                            toggle(row.line, value === true)
                          }
                          aria-label={t('logExplorer.select', {
                            line: row.line,
                          })}
                        />
                        {row.line}
                      </label>
                    </TableCell>
                    <TableCell className="p-2">
                      {row.level === 'unknown'
                        ? t('logExplorer.unknown')
                        : row.level.toUpperCase()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap p-2">
                      {row.timestamp === null
                        ? t('logExplorer.unknownTime')
                        : new Date(row.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="p-2">
                      <pre className="max-h-32 min-w-64 max-w-2xl overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
                        {row.raw}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!rows.length && (
            <p className="text-sm text-muted-foreground">
              {t('logExplorer.none')}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              {t('logExplorer.previous')}
            </Button>
            <span className="text-sm">
              {t('logExplorer.page', { page: page + 1, total: pages })}
            </span>
            <Button
              variant="outline"
              disabled={page + 1 >= pages}
              onClick={() => setPage(page + 1)}
            >
              {t('logExplorer.next')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
