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
import type { NetlogReport } from '@/lib/netlog-viewer';
export const Route = createFileRoute('/netlog-viewer')({
  component: NetlogPage,
});
const SAMPLE = {
  constants: {
    logFormatVersion: 1,
    timeTickOffset: '1700000000000',
    logEventTypes: { URL_REQUEST: 1, SOCKET_CONNECT: 2 },
    logSourceType: { URL_REQUEST: 1, SOCKET: 2 },
    logEventPhase: { PHASE_NONE: 0, PHASE_BEGIN: 1, PHASE_END: 2 },
    netError: { ERR_CONNECTION_REFUSED: -102 },
  },
  events: [
    {
      time: '1000',
      type: 1,
      phase: 1,
      source: { id: 1, type: 1 },
      params: {
        url: 'https://example.com',
        source_dependency: { id: 2, type: 2 },
      },
    },
    { time: '1002', type: 2, phase: 1, source: { id: 2, type: 2 }, params: {} },
    {
      time: '1010',
      type: 2,
      phase: 2,
      source: { id: 2, type: 2 },
      params: { net_error: -102 },
    },
    {
      time: '1011',
      type: 1,
      phase: 2,
      source: { id: 1, type: 1 },
      params: { net_error: -102 },
    },
  ],
};
function NetlogPage() {
  const { t } = useTranslation();
  const task = usePerformanceReport<NetlogReport>('netlog');
  const [query, setQuery] = useQueryParams<{
    source: string;
    search: string;
    errors: string;
  }>({ source: StringParam, search: StringParam, errors: StringParam });
  const [page, setPage] = useState(0),
    [sourcePage, setSourcePage] = useState(0),
    [selected, setSelected] = useState<number | null>(null);
  const sources =
    task.result?.sources.filter((source) =>
      /^\d+$/.test(query.source ?? '')
        ? source.id === query.source
        : `${source.id} ${source.type}`
            .toLowerCase()
            .includes((query.source ?? '').toLowerCase()),
    ) ?? [];
  const matched = new Set(sources.map((source) => source.id));
  const events =
    task.result?.events.filter(
      (event) =>
        matched.has(event.source) &&
        (query.errors !== 'yes' || event.errors.length > 0) &&
        `${event.type} ${event.errors.join(' ')} ${event.params}`
          .toLowerCase()
          .includes((query.search ?? '').toLowerCase()),
    ) ?? [];
  const currentPage = Math.min(
      page,
      Math.max(0, Math.ceil(events.length / 100) - 1),
    ),
    currentSourcePage = Math.min(
      sourcePage,
      Math.max(0, Math.ceil(sources.length / 100) - 1),
    );
  const detail = task.result?.events.find((event) => event.index === selected);
  return (
    <div className="mx-auto max-w-6xl min-w-0 space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('netlogViewer.title')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('netlogViewer.description')}
      </p>
      <PerformanceReportFile
        task={task}
        label={t('netlogViewer.upload')}
        sample={SAMPLE}
      />
      <p className="text-xs text-muted-foreground">
        {t('netlogViewer.limits')}
      </p>
      {task.result && (
        <>
          <p className="text-sm">
            {t('netlogViewer.summary', {
              sources: task.result.sources.length,
              events: task.result.events.length,
              version: task.result.version || '—',
            })}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="netlog-source">Source ID / Type</Label>
              <Input
                id="netlog-source"
                value={query.source ?? ''}
                onChange={(event) => {
                  setQuery({ source: event.target.value });
                  setPage(0);
                  setSourcePage(0);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="netlog-search">{t('netlogViewer.search')}</Label>
              <Input
                id="netlog-search"
                value={query.search ?? ''}
                onChange={(event) => {
                  setQuery({ search: event.target.value });
                  setPage(0);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('netlogViewer.errors')}</Label>
              <Select
                value={query.errors === 'yes' ? 'yes' : 'all'}
                onValueChange={(errors) => {
                  setQuery({ errors });
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
                  <SelectItem value="yes">
                    {t('netlogViewer.onlyErrors')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>{t('netlogViewer.events')}</TableHead>
                  <TableHead>{t('netlogViewer.related')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources
                  .slice(currentSourcePage * 100, currentSourcePage * 100 + 100)
                  .map((source) => (
                    <TableRow key={source.id}>
                      <TableCell className="max-w-64 whitespace-normal break-all">
                        {source.id} · {source.type}
                      </TableCell>
                      <TableCell>
                        {source.count} / {source.errors}{' '}
                        {t('netlogViewer.errors')}
                      </TableCell>
                      <TableCell className="max-w-96 whitespace-normal">
                        {source.related.slice(0, 100).map((id) => (
                          <Button
                            key={id}
                            size="sm"
                            variant="link"
                            onClick={() => {
                              setQuery({ source: id });
                              setPage(0);
                              setSourcePage(0);
                            }}
                          >
                            {id}
                          </Button>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <ReportPagination
            page={currentSourcePage}
            count={sources.length}
            onPage={setSourcePage}
          />
          <p className="text-xs text-muted-foreground">
            {t('netlogViewer.timing')}
          </p>
          <div className="min-w-0 overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {['time', 'source', 'event', 'phase', 'errors'].map((key) => (
                    <TableHead key={key}>{t(`netlogViewer.${key}`)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {events
                  .slice(currentPage * 100, currentPage * 100 + 100)
                  .map((event) => (
                    <TableRow key={event.index}>
                      <TableCell>{event.time.toFixed(3)} ms</TableCell>
                      <TableCell>{event.source}</TableCell>
                      <TableCell className="max-w-80 whitespace-normal break-all">
                        <Button
                          variant="link"
                          className="h-auto whitespace-normal"
                          onClick={() => setSelected(event.index)}
                        >
                          {event.type}
                        </Button>
                      </TableCell>
                      <TableCell>{event.phase}</TableCell>
                      <TableCell className="max-w-80 whitespace-normal break-all text-destructive">
                        {event.errors.join(', ')}
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
              <h2 className="break-all font-semibold">
                {detail.type} · Source {detail.source}
              </h2>
              <p className="text-xs">
                {detail.rawTime} · {t('netlogViewer.offset')}:{' '}
                {task.result.offset || '—'}
              </p>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">
                {detail.params}
              </pre>
            </section>
          )}
        </>
      )}
    </div>
  );
}
