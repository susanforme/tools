import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { FileDropzone } from '@/components/file-dropzone';
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
import { Textarea } from '@/components/ui/textarea';
import {
  StringParam,
  useQueryParams,
  withDefault,
} from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import type { TraceAnalysis, TraceCall } from '@/lib/mcp-trace';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/mcp-trace')({ component: McpTracePage });
const STATUSES = [
  'all',
  'success',
  'error',
  'pending',
  'notification',
  'unmatched',
] as const;
const PAGE_SIZE = 50;
const MAX_BYTES = 10 * 1024 * 1024;
const SAMPLE = [
  {
    v: 1,
    type: 'meta',
    label: 'example',
    startedAt: '2026-01-01T00:00:00.000Z',
    command: ['example'],
  },
  {
    t: '2026-01-01T00:00:00.000Z',
    dir: 'in',
    raw: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'search',
        arguments: { q: 'example', api_key: 'example-secret' },
      },
    },
  },
  {
    t: '2026-01-01T00:00:00.120Z',
    dir: 'out',
    raw: {
      jsonrpc: '2.0',
      id: 1,
      result: { content: [{ type: 'text', text: 'OK' }] },
    },
  },
  {
    t: '2026-01-01T00:00:00.200Z',
    dir: 'out',
    raw: {
      jsonrpc: '2.0',
      method: 'notifications/message',
      params: { level: 'info', data: 'Done' },
    },
  },
]
  .map((line) => JSON.stringify(line))
  .join('\n');

function McpTracePage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{ status: string }>({
    status: withDefault<string>(StringParam, 'all'),
  });
  const status = STATUSES.find((value) => value === query.status) ?? 'all';
  const [input, setInput] = useState('');
  const [analysis, setAnalysis] = useState<TraceAnalysis | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<TraceCall | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportText, setExportText] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const worker = useRef<Worker | null>(null);
  const generation = useRef(0);
  const exportGeneration = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      exportGeneration.current++;
      worker.current?.terminate();
    },
    [],
  );

  const invalidateExport = () => {
    exportGeneration.current++;
    setExportText(null);
    setExportBusy(false);
  };
  const stop = () => {
    generation.current++;
    invalidateExport();
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
  };
  const load = async (files?: File[], text = input) => {
    stop();
    const current = generation.current;
    setError(null);
    setAnalysis(null);
    setDetail(null);
    setSelected(new Set());
    setExportText(null);
    setPage(0);
    setBusy(true);
    try {
      if (
        files &&
        (files.length > 10 ||
          files.reduce((sum, file) => sum + file.size, 0) > MAX_BYTES)
      )
        throw new Error('sizeLimit');
      if (!files && new Blob([text]).size > MAX_BYTES)
        throw new Error('sizeLimit');
      const sources = files
        ? await Promise.all(
            files.map(async (file) => ({
              name: file.name,
              text: await file.text(),
            })),
          )
        : [{ name: 'trace.jsonl', text }];
      if (current !== generation.current) return;
      const next = new Worker(
        new URL('../workers/mcp-trace.worker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.current = next;
      next.onmessage = (
        event: MessageEvent<{ result?: TraceAnalysis; error?: string }>,
      ) => {
        if (current !== generation.current) return;
        next.terminate();
        worker.current = null;
        setBusy(false);
        if (event.data.error)
          setError(
            t('mcpTrace.failed', { msg: translateError(event.data.error) }),
          );
        else if (event.data.result) setAnalysis(event.data.result);
      };
      next.onerror = () => {
        if (current !== generation.current) return;
        next.terminate();
        worker.current = null;
        setBusy(false);
        setError(t('mcpTrace.workerFailed'));
      };
      next.postMessage(sources);
    } catch (cause) {
      if (current !== generation.current) return;
      setError(
        t('mcpTrace.failed', { msg: translateError((cause as Error).message) }),
      );
      setBusy(false);
    }
  };
  function translateError(message: string): string {
    return message.replace(
      /invalidJson|invalidRecord|unsupportedVersion|invalidId|duplicateId|recordLimit|lineLimit|sizeLimit/g,
      (code) => t(`mcpTrace.errors.${code}`),
    );
  }
  const calls = analysis?.calls ?? [];
  const filtered = calls.filter(
    (call) =>
      (status === 'all' || call.status === status) &&
      `${call.session} ${call.method} ${call.id ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  const toggle = (key: string, enabled: boolean) => {
    invalidateExport();
    setSelected((previous) => {
      const next = new Set(previous);
      if (enabled) next.add(key);
      else next.delete(key);
      return next;
    });
  };
  const prepareExport = async () => {
    const current = ++exportGeneration.current;
    setExportText(null);
    setExportBusy(true);
    setError(null);
    try {
      const [{ exportMcpCalls }, { analyzeRedaction }] = await Promise.all([
        import('@/lib/mcp-trace'),
        import('@/lib/data-redactor'),
      ]);
      const result = analyzeRedaction(
        exportMcpCalls(calls.filter((call) => selected.has(call.key))),
        { format: 'json' },
      );
      if (current === exportGeneration.current) setExportText(result.output);
    } catch (cause) {
      if (current === exportGeneration.current)
        setError(t('mcpTrace.failed', { msg: (cause as Error).message }));
    } finally {
      if (current === exportGeneration.current) setExportBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('mcpTrace.title')}</h1>
      <FileDropzone
        accept=".jsonl,.ndjson,.log"
        multiple
        disabled={busy}
        onFiles={(files) => void load(files.map(({ file }) => file))}
        className="block rounded-lg p-6 text-center"
      >
        {t('mcpTrace.drop')}
      </FileDropzone>
      <Label htmlFor="mcp-input">{t('mcpTrace.input')}</Label>
      <Textarea
        id="mcp-input"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="h-36 font-mono"
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !input.trim()} onClick={() => void load()}>
          {t('mcpTrace.analyze')}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setInput(SAMPLE);
            void load(undefined, SAMPLE);
          }}
        >
          {t('mcpTrace.sample')}
        </Button>
        {busy && (
          <Button variant="outline" onClick={stop}>
            {t('mcpTrace.cancel')}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            stop();
            setInput('');
            setAnalysis(null);
            setSelected(new Set());
            setDetail(null);
            setExportText(null);
            setError(null);
          }}
        >
          {t('mcpTrace.clear')}
        </Button>
      </div>
      {busy && <p role="status">{t('mcpTrace.loading')}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {analysis && (
        <>
          <p className="text-sm text-muted-foreground">
            {t('mcpTrace.summary', {
              count: calls.length,
              skipped: analysis.skipped,
            })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={status}
              onValueChange={(value) => {
                setQuery({ status: value });
                setPage(0);
              }}
            >
              <SelectTrigger className="w-44" aria-label={t('mcpTrace.status')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`mcpTrace.statuses.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="max-w-sm"
              aria-label={t('mcpTrace.search')}
              placeholder={t('mcpTrace.search')}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
            <Button
              variant="outline"
              disabled={!visible.length}
              onClick={() => {
                invalidateExport();
                setSelected(
                  (previous) =>
                    new Set([...previous, ...visible.map((call) => call.key)]),
                );
              }}
            >
              {t('mcpTrace.selectPage')}
            </Button>
            <Button
              variant="outline"
              disabled={!selected.size}
              onClick={() => {
                setSelected(new Set());
                invalidateExport();
              }}
            >
              {t('mcpTrace.deselect')}
            </Button>
            <Button
              disabled={!selected.size || exportBusy}
              onClick={() => void prepareExport()}
            >
              {t('mcpTrace.previewExport', { count: selected.size })}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table className="w-full text-left text-sm">
              <TableHeader>
                <TableRow className="border-b bg-muted/40">
                  <TableHead className="p-2">{t('mcpTrace.select')}</TableHead>
                  <TableHead className="p-2">{t('mcpTrace.session')}</TableHead>
                  <TableHead className="p-2">ID</TableHead>
                  <TableHead className="p-2">{t('mcpTrace.method')}</TableHead>
                  <TableHead className="p-2">{t('mcpTrace.status')}</TableHead>
                  <TableHead className="p-2">
                    {t('mcpTrace.duration')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((call) => (
                  <TableRow className="border-b" key={call.key}>
                    <TableCell className="p-2">
                      <Checkbox
                        aria-label={`${t('mcpTrace.select')} ${call.key}`}
                        checked={selected.has(call.key)}
                        onCheckedChange={(value) =>
                          toggle(call.key, value === true)
                        }
                      />
                    </TableCell>
                    <TableCell
                      className="max-w-52 truncate p-2"
                      title={call.session}
                    >
                      {call.session}
                    </TableCell>
                    <TableCell className="p-2 font-mono">
                      {JSON.stringify(call.id)}
                    </TableCell>
                    <TableCell className="p-2">
                      <Button
                        variant="link"
                        className="max-w-80 truncate px-0"
                        onClick={() => setDetail(call)}
                      >
                        {call.method || t('mcpTrace.response')}
                      </Button>
                    </TableCell>
                    <TableCell className="p-2">
                      {t(`mcpTrace.statuses.${call.status}`)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap p-2">
                      {call.duration === null ? '—' : `${call.duration} ms`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!filtered.length && <p>{t('mcpTrace.empty')}</p>}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={!currentPage}
              onClick={() => setPage(currentPage - 1)}
            >
              {t('mcpTrace.previous')}
            </Button>
            <span>
              {currentPage + 1} / {pages}
            </span>
            <Button
              variant="outline"
              disabled={currentPage + 1 >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              {t('mcpTrace.next')}
            </Button>
          </div>
        </>
      )}
      {detail && (
        <div className="space-y-2">
          <h2 className="font-semibold">{t('mcpTrace.detail')}</h2>
          <pre className="max-h-96 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
            {JSON.stringify(detail, null, 2)}
          </pre>
        </div>
      )}
      {exportText !== null && (
        <div className="space-y-2">
          <Label htmlFor="mcp-export">{t('mcpTrace.exportReview')}</Label>
          <Textarea
            id="mcp-export"
            className="h-64 font-mono"
            value={exportText}
            onChange={(event) => setExportText(event.target.value)}
          />
          <Button
            onClick={() => {
              try {
                JSON.parse(exportText);
                downloadBlob(
                  new Blob([exportText], { type: 'application/json' }),
                  'mcp-trace-redacted.json',
                );
              } catch {
                setError(t('mcpTrace.errors.invalidJson'));
              }
            }}
          >
            {t('mcpTrace.download')}
          </Button>
        </div>
      )}
    </div>
  );
}
