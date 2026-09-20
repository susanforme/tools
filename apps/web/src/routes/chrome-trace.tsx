import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PerformanceReportFile,
  ReportPagination,
  usePerformanceReport,
} from '@/components/performance-report-file';
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
import type { ChromeTraceReport } from '@/lib/chrome-trace';
export const Route = createFileRoute('/chrome-trace')({
  component: ChromeTracePage,
});
const SAMPLE = {
  traceEvents: [
    {
      ph: 'M',
      pid: 1,
      tid: 1,
      name: 'thread_name',
      args: { name: 'CrRendererMain' },
    },
    { ph: 'B', pid: 1, tid: 1, ts: 1000, name: 'RunTask', cat: 'toplevel' },
    {
      ph: 'X',
      pid: 1,
      tid: 1,
      ts: 2000,
      dur: 55000,
      name: 'EvaluateScript',
      cat: 'devtools.timeline',
      args: { url: 'https://example.com/app.js' },
    },
    { ph: 'E', pid: 1, tid: 1, ts: 61000 },
    {
      ph: 'I',
      pid: 1,
      tid: 1,
      ts: 62000,
      name: 'Mark',
      args: { detail: 'ready' },
    },
  ],
};
function ChromeTracePage() {
  const { t } = useTranslation();
  const task = usePerformanceReport<ChromeTraceReport>('trace');
  const [query, setQuery] = useQueryParams<{
    thread: string;
    search: string;
    mode: string;
  }>({ thread: StringParam, search: StringParam, mode: StringParam });
  const [page, setPage] = useState(0),
    [selected, setSelected] = useState<number | null>(null);
  const names = new Map(
    task.result?.threads.map((thread) => [thread.key, thread.name]) ?? [],
  );
  const events =
    task.result?.events.filter(
      (event) =>
        `${names.get(event.thread)} ${event.pid} ${event.tid}`
          .toLowerCase()
          .includes((query.thread ?? '').toLowerCase()) &&
        `${event.name} ${event.category}`
          .toLowerCase()
          .includes((query.search ?? '').toLowerCase()) &&
        (query.mode !== 'long' || (event.task && (event.duration ?? 0) >= 50)),
    ) ?? [];
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(events.length / 100) - 1),
  );
  const detail = task.result?.events.find((event) => event.id === selected);
  return (
    <div className="mx-auto max-w-6xl min-w-0 space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('chromeTrace.title')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('chromeTrace.description')}
      </p>
      <PerformanceReportFile
        task={task}
        label={t('chromeTrace.upload')}
        sample={SAMPLE}
      />
      <p className="text-xs text-muted-foreground">{t('chromeTrace.limits')}</p>
      {task.result && (
        <>
          <p className="text-sm">
            {t('chromeTrace.summary', {
              events: task.result.events.length,
              threads: task.result.threads.length,
              unsupported: task.result.unsupported,
              unmatched: task.result.unmatched,
            })}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="trace-thread">{t('chromeTrace.thread')}</Label>
              <Input
                id="trace-thread"
                value={query.thread ?? ''}
                onChange={(event) => {
                  setQuery({ thread: event.target.value });
                  setPage(0);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trace-event">{t('chromeTrace.search')}</Label>
              <Input
                id="trace-event"
                value={query.search ?? ''}
                onChange={(event) => {
                  setQuery({ search: event.target.value });
                  setPage(0);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('chromeTrace.mode')}</Label>
              <Select
                value={query.mode === 'long' ? 'long' : 'all'}
                onValueChange={(mode) => {
                  setQuery({ mode });
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('performanceReports.all')}
                  </SelectItem>
                  <SelectItem value="long">{t('chromeTrace.long')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('chromeTrace.timelineNote')}
          </p>
          <div className="min-w-0 overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {['event', 'thread', 'start', 'duration', 'timeline'].map(
                    (key) => (
                      <TableHead key={key}>{t(`chromeTrace.${key}`)}</TableHead>
                    ),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {events
                  .slice(currentPage * 100, currentPage * 100 + 100)
                  .map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="min-w-48 max-w-72 whitespace-normal break-all">
                        <Button
                          variant="link"
                          className="h-auto whitespace-normal text-left"
                          onClick={() => setSelected(event.id)}
                        >
                          {event.name.slice(0, 500)}
                        </Button>
                        <p className="text-xs">
                          {event.phase} · {event.category.slice(0, 300)}{' '}
                          {event.incomplete && t('chromeTrace.incomplete')}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-56 whitespace-normal break-all">
                        {names.get(event.thread)}
                      </TableCell>
                      <TableCell>{event.start.toFixed(3)} ms</TableCell>
                      <TableCell>
                        {event.duration === null
                          ? '—'
                          : `${event.duration.toFixed(3)} ms`}
                      </TableCell>
                      <TableCell>
                        <svg
                          className="h-6 w-72"
                          viewBox="0 0 400 24"
                          role="img"
                          aria-label={`${event.start} + ${event.duration ?? 0} ms`}
                        >
                          <rect
                            x="0"
                            y="4"
                            width="400"
                            height="16"
                            className="fill-muted"
                          />
                          <rect
                            x={
                              task.result!.duration
                                ? (event.start / task.result!.duration) * 398
                                : 0
                            }
                            y="4"
                            width={Math.max(
                              2,
                              task.result!.duration
                                ? ((event.duration ?? 0) /
                                    task.result!.duration) *
                                    398
                                : 2,
                            )}
                            height="16"
                            className={
                              event.task && (event.duration ?? 0) >= 50
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
          <ReportPagination
            page={currentPage}
            count={events.length}
            onPage={setPage}
          />
          {detail && (
            <section className="min-w-0 space-y-2 rounded-md border p-4">
              <h2 className="break-all font-semibold">{detail.name}</h2>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">
                {detail.args}
              </pre>
            </section>
          )}
        </>
      )}
    </div>
  );
}
