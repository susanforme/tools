import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReportFileInput,
  useReportFile,
} from '@/components/observability-file';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import type { OtelReport } from '@/lib/otel-viewer';
export const Route = createFileRoute('/otel-viewer')({ component: OtelPage });
const TRACE = '0123456789abcdef0123456789abcdef';
const SAMPLE = {
  resourceSpans: [
    {
      resource: {
        attributes: [{ key: 'service.name', value: { stringValue: 'api' } }],
      },
      scopeSpans: [
        {
          scope: { name: 'example' },
          spans: [
            {
              traceId: TRACE,
              spanId: '0000000000000001',
              name: 'GET /checkout',
              startTimeUnixNano: '1750000000000000000',
              endTimeUnixNano: '1750000000100000000',
              status: { code: 2 },
              attributes: [
                {
                  key: 'http.response.status_code',
                  value: { intValue: '500' },
                },
              ],
            },
            {
              traceId: TRACE,
              spanId: '0000000000000002',
              parentSpanId: '0000000000000001',
              name: 'database query',
              startTimeUnixNano: '1750000000020000000',
              endTimeUnixNano: '1750000000080000000',
              status: { code: 2, message: 'Connection timeout' },
              events: [
                {
                  timeUnixNano: '1750000000080000000',
                  name: 'exception',
                  attributes: [
                    {
                      key: 'exception.message',
                      value: { stringValue: 'Connection timeout' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
function ms(value: number): string {
  return Number(value.toFixed(6)).toLocaleString();
}
function OtelPage() {
  const { t } = useTranslation();
  const task = useReportFile<OtelReport>('otel');
  const [query, setQuery] = useQueryParams<{
    trace: string;
    search: string;
    status: string;
    traceSearch: string;
  }>({
    trace: StringParam,
    search: StringParam,
    status: StringParam,
    traceSearch: StringParam,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const traces = task.result?.traces ?? [];
  const trace = traces.find((trace) => trace.id === query.trace) ?? traces[0];
  const traceOptions = traces
    .filter((trace) =>
      trace.id.includes((query.traceSearch ?? '').toLowerCase()),
    )
    .slice(0, 200);
  const spans =
    trace?.spans.filter(
      (span) =>
        (query.status !== 'error' || span.status === 2) &&
        `${span.name} ${span.service} ${span.spanId}`
          .toLowerCase()
          .includes((query.search ?? '').toLowerCase()),
    ) ?? [];
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(spans.length / 100) - 1),
  );
  const detail = trace?.spans.find((span) => span.key === selected);
  return (
    <div className="mx-auto max-w-6xl min-w-0 space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('otelViewer.title')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('otelViewer.description')}
      </p>
      <ReportFileInput
        task={task}
        label={t('otelViewer.upload')}
        sample={SAMPLE}
      />
      <p className="text-xs text-muted-foreground">{t('otelViewer.limits')}</p>
      {task.result && (
        <>
          <p>
            {t('otelViewer.summary', {
              traces: traces.length,
              spans: task.result.spanCount,
            })}
          </p>
          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="trace-search">
                {t('otelViewer.traceSearch')}
              </Label>
              <Input
                id="trace-search"
                value={query.traceSearch ?? ''}
                onChange={(event) =>
                  setQuery({ traceSearch: event.target.value })
                }
              />
              <Select
                value={trace?.id ?? ''}
                onValueChange={(value) => {
                  setQuery({ trace: value });
                  setPage(0);
                  setSelected(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('otelViewer.trace')} />
                </SelectTrigger>
                <SelectContent>
                  {traceOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('otelViewer.traceLimit')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="span-search">{t('otelViewer.search')}</Label>
              <Input
                id="span-search"
                value={query.search ?? ''}
                onChange={(event) => {
                  setQuery({ search: event.target.value });
                  setPage(0);
                }}
              />
              <Select
                value={query.status === 'error' ? 'error' : 'all'}
                onValueChange={(status) => {
                  setQuery({ status });
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('observability.all')}</SelectItem>
                  <SelectItem value="error">
                    {t('otelViewer.errors')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {trace && (
            <>
              <p className="break-all text-sm">
                {trace.id} · {ms(trace.durationMs)} ms ·{' '}
                {t('otelViewer.errorCount', { count: trace.errors })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('otelViewer.treeNote')}
              </p>
              <div className="min-w-0 overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['span', 'service', 'duration', 'waterfall'].map(
                        (key) => (
                          <TableHead key={key}>
                            {t(`otelViewer.${key}`)}
                          </TableHead>
                        ),
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {spans
                      .slice(currentPage * 100, currentPage * 100 + 100)
                      .map((span) => (
                        <TableRow key={span.key}>
                          <TableCell className="min-w-56 max-w-80 whitespace-normal break-all">
                            <Button
                              variant="link"
                              className="h-auto whitespace-normal text-left"
                              onClick={() => setSelected(span.key)}
                            >
                              <span className="text-muted-foreground">
                                {'│ '.repeat(Math.min(span.depth, 10))}
                                {span.depth ? '↳ ' : ''}
                              </span>
                              {span.name || span.spanId}
                            </Button>
                            <p className="text-xs">
                              {span.spanId}{' '}
                              {span.parentId && `← ${span.parentId}`}
                            </p>
                            {span.status === 2 && (
                              <Badge variant="destructive">
                                {t('otelViewer.errors')}
                              </Badge>
                            )}
                            {span.issue && (
                              <p className="text-xs text-destructive">
                                {t(`otelViewer.${span.issue}`)}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="max-w-48 whitespace-normal break-all">
                            {span.service || '—'}
                          </TableCell>
                          <TableCell>{ms(span.durationMs)} ms</TableCell>
                          <TableCell>
                            <svg
                              role="img"
                              aria-label={`${ms(span.offsetMs)} + ${ms(span.durationMs)} ms`}
                              viewBox="0 0 400 24"
                              className="h-6 w-80"
                            >
                              <title>{`${ms(span.offsetMs)} + ${ms(span.durationMs)} ms`}</title>
                              <rect
                                x="0"
                                y="4"
                                width="400"
                                height="16"
                                className="fill-muted"
                              />
                              <rect
                                x={
                                  trace.durationMs
                                    ? (span.offsetMs / trace.durationMs) * 398
                                    : 0
                                }
                                y="4"
                                width={Math.max(
                                  2,
                                  trace.durationMs
                                    ? (span.durationMs / trace.durationMs) * 398
                                    : 2,
                                )}
                                height="16"
                                className={
                                  span.status === 2
                                    ? 'fill-destructive'
                                    : 'fill-primary'
                                }
                              />
                            </svg>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  {t('observability.previous')}
                </Button>
                <span>
                  {currentPage + 1} /{' '}
                  {Math.max(1, Math.ceil(spans.length / 100))}
                </span>
                <Button
                  variant="outline"
                  disabled={(currentPage + 1) * 100 >= spans.length}
                  onClick={() => setPage(currentPage + 1)}
                >
                  {t('observability.next')}
                </Button>
              </div>
            </>
          )}
          {detail && (
            <section className="min-w-0 space-y-3 rounded-md border p-4">
              <h2 className="break-all font-semibold">{detail.name}</h2>
              <p className="break-all text-sm">
                {detail.start} → {detail.end} ns · {detail.scope}
              </p>
              <p className="break-all text-sm text-destructive">
                {detail.statusMessage}
              </p>
              {(['attributes', 'resource', 'events', 'links'] as const).map(
                (key) => (
                  <div key={key} className="min-w-0">
                    <h3 className="font-medium">{t(`otelViewer.${key}`)}</h3>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">
                      {detail[key]}
                    </pre>
                  </div>
                ),
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
