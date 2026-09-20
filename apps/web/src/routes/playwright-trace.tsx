import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PerformanceReportFile,
  ReportPagination,
  usePerformanceReport,
} from '@/components/performance-report-file';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import type { PlaywrightReport } from '@/lib/playwright-trace';
export const Route = createFileRoute('/playwright-trace')({
  component: PlaywrightTracePage,
});
function PlaywrightTracePage() {
  const { t } = useTranslation();
  const task = usePerformanceReport<PlaywrightReport>('playwright');
  const [query, setQuery] = useQueryParams<{
    tab: string;
    search: string;
    context: string;
  }>({ tab: StringParam, search: StringParam, context: StringParam });
  const tab = ['actions', 'network', 'screenshots', 'errors'].includes(
    query.tab ?? '',
  )
    ? query.tab!
    : 'actions';
  const [page, setPage] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [imageUrl, setImageUrl] = useState<string | null>(null),
    [imageError, setImageError] = useState(false);
  const search = (query.search ?? '').toLowerCase();
  const context = (query.context ?? '').toLowerCase();
  const actions =
    task.result?.actions.filter(
      (action) =>
        action.context.toLowerCase().includes(context) &&
        `${action.title} ${action.error} ${action.params}`
          .toLowerCase()
          .includes(search),
    ) ?? [];
  const network =
    task.result?.network.filter(
      (item) =>
        item.context.toLowerCase().includes(context) &&
        `${item.url} ${item.method} ${item.status} ${item.error}`
          .toLowerCase()
          .includes(search),
    ) ?? [];
  const frames =
    task.result?.frames.filter(
      (frame) =>
        frame.context.toLowerCase().includes(context) &&
        `${frame.page} ${frame.resource}`.toLowerCase().includes(search),
    ) ?? [];
  const errors = [
    ...(task.result?.errors ?? []),
    ...actions
      .filter((action) => action.error)
      .map((action) => `${action.context} · ${action.title}\n${action.error}`),
  ].filter((error) => error.toLowerCase().includes(search));
  const count =
    tab === 'actions'
      ? actions.length
      : tab === 'network'
        ? network.length
        : tab === 'screenshots'
          ? frames.length
          : errors.length;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(count / 100) - 1));
  const action = actions.find((item) => item.key === selected),
    request = network.find((item) => item.key === selected),
    frame = frames.find((item) => item.key === selected);
  useEffect(() => {
    setSelected(null);
    setPage(0);
  }, [task.result]);
  useEffect(() => {
    setImageUrl(null);
    setImageError(false);
    if (!frame?.data) return;
    const url = URL.createObjectURL(
      new Blob([frame.data as Uint8Array<ArrayBuffer>], { type: frame.mime }),
    );
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [frame]);
  return (
    <div className="mx-auto max-w-6xl min-w-0 space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('playwrightTrace.title')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('playwrightTrace.description')}
      </p>
      <PerformanceReportFile
        task={task}
        label={t('playwrightTrace.upload')}
        accept=".zip"
      />
      <p className="text-xs text-muted-foreground">
        {t('playwrightTrace.limits')}
      </p>
      <p className="text-sm text-muted-foreground">
        {t('playwrightTrace.boundary')}
      </p>
      {task.result && (
        <>
          <p className="text-sm">
            {t('playwrightTrace.summary', {
              actions: task.result.actions.length,
              network: task.result.network.length,
              frames: task.result.frames.length,
              snapshots: task.result.snapshots,
              ignored: task.result.ignored,
            })}
          </p>
          <div className="space-y-1 text-xs">
            {task.result.contexts.map((item, i) => (
              <p key={i} className="break-all">
                {item.name} · v{item.version} · {item.title}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pw-search">{t('playwrightTrace.search')}</Label>
              <Input
                id="pw-search"
                value={query.search ?? ''}
                onChange={(event) => {
                  setQuery({ search: event.target.value });
                  setPage(0);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-context">{t('playwrightTrace.context')}</Label>
              <Input
                id="pw-context"
                value={query.context ?? ''}
                onChange={(event) => {
                  setQuery({ context: event.target.value });
                  setPage(0);
                }}
              />
            </div>
          </div>
          <Tabs
            value={tab}
            onValueChange={(tab) => {
              setQuery({ tab });
              setPage(0);
              setSelected(null);
            }}
          >
            <TabsList className="max-w-full flex-wrap group-data-[orientation=horizontal]/tabs:h-auto">
              {['actions', 'network', 'screenshots', 'errors'].map((key) => (
                <TabsTrigger key={key} value={key}>
                  {t(`playwrightTrace.${key}`)}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="actions">
              <div className="min-w-0 overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['action', 'context', 'start', 'duration', 'errors'].map(
                        (key) => (
                          <TableHead key={key}>
                            {t(`playwrightTrace.${key}`)}
                          </TableHead>
                        ),
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actions
                      .slice(currentPage * 100, currentPage * 100 + 100)
                      .map((item) => (
                        <TableRow key={item.key}>
                          <TableCell className="min-w-44 max-w-72 whitespace-normal break-all">
                            <Button
                              variant="link"
                              className="h-auto whitespace-normal text-left"
                              onClick={() => setSelected(item.key)}
                            >
                              {item.title.slice(0, 500)}
                            </Button>
                            <p className="text-xs">
                              {item.id} {item.parent && `← ${item.parent}`}
                            </p>
                          </TableCell>
                          <TableCell className="max-w-56 whitespace-normal break-all">
                            {item.context}
                          </TableCell>
                          <TableCell>{item.start.toFixed(3)} ms</TableCell>
                          <TableCell>
                            {item.end === null
                              ? t('playwrightTrace.incomplete')
                              : `${(item.end - item.start).toFixed(3)} ms`}
                          </TableCell>
                          <TableCell className="max-w-80 whitespace-pre-wrap break-all text-destructive">
                            {item.error.slice(0, 500)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              {action && (
                <section className="min-w-0 space-y-2 rounded-md border p-4">
                  <h2 className="break-all font-semibold">{action.title}</h2>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">
                    {action.params}
                    {'\n'}
                    {action.result}
                    {'\n'}
                    {action.error}
                    {'\n'}
                    {action.log.join('\n')}
                  </pre>
                </section>
              )}
            </TabsContent>
            <TabsContent value="network">
              <div className="min-w-0 overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('playwrightTrace.request')}</TableHead>
                      <TableHead>{t('playwrightTrace.status')}</TableHead>
                      <TableHead>{t('playwrightTrace.duration')}</TableHead>
                      <TableHead>{t('playwrightTrace.errors')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {network
                      .slice(currentPage * 100, currentPage * 100 + 100)
                      .map((item) => (
                        <TableRow key={item.key}>
                          <TableCell className="min-w-56 max-w-96 whitespace-normal break-all">
                            <Button
                              className="h-auto whitespace-normal text-left"
                              variant="link"
                              onClick={() => setSelected(item.key)}
                            >
                              {item.method} {item.url.slice(0, 2000)}
                            </Button>
                          </TableCell>
                          <TableCell>{item.status}</TableCell>
                          <TableCell>{item.time.toFixed(3)} ms</TableCell>
                          <TableCell className="max-w-80 whitespace-normal break-all text-destructive">
                            {item.error}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              {request && (
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md border p-4 text-xs">
                  {request.details}
                </pre>
              )}
            </TabsContent>
            <TabsContent value="screenshots">
              <div className="min-w-0 overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('playwrightTrace.start')}</TableHead>
                      <TableHead>{t('playwrightTrace.screenshot')}</TableHead>
                      <TableHead>{t('playwrightTrace.context')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {frames
                      .slice(currentPage * 100, currentPage * 100 + 100)
                      .map((item) => (
                        <TableRow key={item.key}>
                          <TableCell>{item.time.toFixed(3)} ms</TableCell>
                          <TableCell className="max-w-80 whitespace-normal break-all">
                            <Button
                              variant="link"
                              className="h-auto whitespace-normal"
                              onClick={() => setSelected(item.key)}
                            >
                              {item.page || item.resource}
                            </Button>
                            {!item.data && (
                              <p className="text-xs text-muted-foreground">
                                {t('playwrightTrace.missingImage')}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>{item.context}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              {imageUrl && !imageError && (
                <img
                  src={imageUrl}
                  alt={t('playwrightTrace.screenshot')}
                  className="max-h-[600px] max-w-full rounded-md border object-contain"
                  onError={() => setImageError(true)}
                />
              )}{' '}
              {imageError && (
                <p className="text-destructive">
                  {t('playwrightTrace.invalidImage')}
                </p>
              )}
            </TabsContent>
            <TabsContent value="errors" className="space-y-3">
              {errors
                .slice(currentPage * 100, currentPage * 100 + 100)
                .map((error, index) => (
                  <pre
                    key={index}
                    className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md border p-3 text-xs text-destructive"
                  >
                    {error}
                  </pre>
                ))}
            </TabsContent>
          </Tabs>
          <ReportPagination page={currentPage} count={count} onPage={setPage} />
        </>
      )}
    </div>
  );
}
