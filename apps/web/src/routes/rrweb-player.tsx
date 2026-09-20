import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReportFileInput,
  useReportFile,
} from '@/components/observability-file';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  createReplayDocument,
  readReplayMessage,
  replayEventLabel,
  type ReplayReport,
} from '@/lib/rrweb-player';
export const Route = createFileRoute('/rrweb-player')({
  component: ReplayPage,
});
const SAMPLE = [
  {
    type: 4,
    timestamp: 1000,
    data: { href: 'https://example.com', width: 800, height: 450 },
  },
  {
    type: 2,
    timestamp: 1001,
    data: {
      node: {
        type: 0,
        id: 1,
        childNodes: [
          {
            type: 2,
            id: 2,
            tagName: 'html',
            attributes: {},
            childNodes: [
              {
                type: 2,
                id: 3,
                tagName: 'head',
                attributes: {},
                childNodes: [],
              },
              {
                type: 2,
                id: 4,
                tagName: 'body',
                attributes: {},
                childNodes: [
                  {
                    type: 2,
                    id: 5,
                    tagName: 'h1',
                    attributes: {},
                    childNodes: [
                      { type: 3, id: 6, textContent: 'Hello rrweb' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      initialOffset: { left: 0, top: 0 },
    },
  },
  {
    type: 3,
    timestamp: 2500,
    data: {
      source: 0,
      texts: [{ id: 6, value: 'Replay works!' }],
      attributes: [],
      removes: [],
      adds: [],
    },
  },
  { type: 5, timestamp: 6000, data: { tag: 'end', payload: null } },
];
function ReplayPage() {
  const { t } = useTranslation();
  const task = useReportFile<ReplayReport>('rrweb');
  const report = task.result;
  const [query, setQuery] = useQueryParams<{ speed: number; event: string }>({
    speed: NumberParam,
    event: StringParam,
  });
  const speed = [0.5, 1, 2, 4, 8].includes(query.speed ?? 1)
    ? (query.speed ?? 1)
    : 1;
  const frame = useRef<HTMLIFrameElement>(null);
  const nonceRef = useRef('');
  const [url, setUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => {
    let stale = false;
    let stopped = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    setUrl(null);
    setReady(false);
    setStarting(false);
    setError(null);
    setTime(0);
    setPlaying(false);
    setPage(0);
    if (!report) return;
    const nonce = crypto.randomUUID();
    nonceRef.current = nonce;
    const fail = (message: string): void => {
      if (stale || stopped) return;
      stopped = true;
      if (timeout) clearTimeout(timeout);
      setUrl(null);
      setStarting(false);
      setReady(false);
      setPlaying(false);
      setError(message);
    };
    const receive = (event: MessageEvent<unknown>): void => {
      const data = readReplayMessage(
        event,
        frame.current?.contentWindow ?? null,
        nonce,
      );
      if (!data || stale || stopped) return;
      if (data.type === 'replay-ready')
        frame.current?.contentWindow?.postMessage(
          { type: 'replay-init', nonce, events: report.events },
          '*',
        );
      if (data.type === 'replay-loaded') {
        if (timeout) clearTimeout(timeout);
        setReady(true);
        setStarting(false);
      }
      if (
        data.type === 'replay-state' &&
        typeof data.time === 'number' &&
        Number.isFinite(data.time)
      ) {
        setTime(Math.max(0, Math.min(report.duration, data.time)));
        setPlaying(data.playing === true);
      }
      if (data.type === 'replay-error')
        fail(typeof data.error === 'string' ? data.error : 'invalidFormat');
    };
    window.addEventListener('message', receive);
    setStarting(true);
    timeout = setTimeout(() => fail('TIMEOUT'), 20_000);
    void Promise.all([
      import('rrweb/dist/rrweb.umd.cjs?raw'),
      import('rrweb/dist/style.css?raw'),
    ])
      .then(([engine, css]) => {
        if (stale || stopped) return;
        const html = createReplayDocument(nonce, engine.default, css.default);
        // data URL 自带独立 opaque origin；仅可信引擎在此运行，events 后续通过消息传递。
        setUrl(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      })
      .catch((cause) => fail((cause as Error).message));
    return () => {
      stale = true;
      if (timeout) clearTimeout(timeout);
      window.removeEventListener('message', receive);
    };
  }, [report]);
  const control = (command: string, offset = time): void =>
    frame.current?.contentWindow?.postMessage(
      {
        type: 'replay-control',
        nonce: nonceRef.current,
        command,
        time: offset,
        speed,
      },
      '*',
    );
  useEffect(() => {
    if (ready)
      frame.current?.contentWindow?.postMessage(
        {
          type: 'replay-control',
          nonce: nonceRef.current,
          command: 'speed',
          speed,
        },
        '*',
      );
  }, [ready, speed]);
  const events =
    report?.events.filter(
      (event) =>
        !query.event ||
        query.event === 'all' ||
        replayEventLabel(event) === query.event,
    ) ?? [];
  const types = [...new Set(report?.events.map(replayEventLabel) ?? [])];
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(events.length / 100) - 1),
  );
  return (
    <div className="mx-auto max-w-6xl min-w-0 space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('rrwebPlayer.title')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('rrwebPlayer.description')}
      </p>
      <ReportFileInput
        task={task}
        label={t('rrwebPlayer.upload')}
        sample={SAMPLE}
      />
      <p className="text-xs text-muted-foreground">{t('rrwebPlayer.limits')}</p>
      <p className="text-xs text-muted-foreground">
        {t('rrwebPlayer.offline')}
      </p>
      {starting && (
        <div className="flex items-center gap-2">
          <p role="status">{t('rrwebPlayer.starting')}</p>
          <Button variant="outline" onClick={task.clear}>
            {t('observability.cancel')}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="break-all text-sm text-destructive">
          {t('observability.failed', {
            message: t(`observability.errors.${error}`, {
              defaultValue: error,
            }),
          })}
        </p>
      )}
      {report && (
        <>
          <p className="text-sm">
            {t('rrwebPlayer.summary', {
              events: report.events.length,
              blocked: report.blocked,
            })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={!ready}
              onClick={() =>
                control(
                  playing ? 'pause' : 'play',
                  time >= report.duration ? 0 : time,
                )
              }
            >
              {t(playing ? 'rrwebPlayer.pause' : 'rrwebPlayer.play')}
            </Button>
            <Button
              variant="outline"
              disabled={!ready}
              onClick={() => control('seek', 0)}
            >
              {t('rrwebPlayer.restart')}
            </Button>
            <Label>{t('rrwebPlayer.speed')}</Label>
            <Select
              value={String(speed)}
              onValueChange={(value) => setQuery({ speed: Number(value) })}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0.5, 1, 2, 4, 8].map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value}×
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm">
              {(time / 1000).toFixed(2)} / {(report.duration / 1000).toFixed(2)}{' '}
              s
            </span>
          </div>
          <Slider
            aria-label={t('rrwebPlayer.timeline')}
            disabled={!ready || report.duration === 0}
            min={0}
            max={Math.max(1, report.duration)}
            step={10}
            value={[time]}
            onValueChange={(values) => control('seek', values[0])}
          />
          {url && (
            <iframe
              ref={frame}
              title={t('rrwebPlayer.preview')}
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
              src={url}
              className="h-[480px] w-full min-w-0 rounded-md border bg-white"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Label>{t('rrwebPlayer.eventType')}</Label>
            <Select
              value={query.event ?? 'all'}
              onValueChange={(event) => {
                setQuery({ event });
                setPage(0);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('observability.all')}</SelectItem>
                {types.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('rrwebPlayer.eventLegend')}
          </p>
          <div className="min-w-0 overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('rrwebPlayer.time')}</TableHead>
                  <TableHead>{t('rrwebPlayer.eventType')}</TableHead>
                  <TableHead>{t('rrwebPlayer.eventData')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events
                  .slice(currentPage * 100, currentPage * 100 + 100)
                  .map((event, index) => (
                    <TableRow key={`${event.timestamp}:${index}`}>
                      <TableCell>
                        <Button
                          variant="link"
                          disabled={!ready}
                          onClick={() =>
                            control('seek', event.timestamp - report.start)
                          }
                        >
                          {((event.timestamp - report.start) / 1000).toFixed(3)}{' '}
                          s
                        </Button>
                      </TableCell>
                      <TableCell>{replayEventLabel(event)}</TableCell>
                      <TableCell className="max-w-96 whitespace-pre-wrap break-all font-mono text-xs">
                        {event.preview}
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
              {currentPage + 1} / {Math.max(1, Math.ceil(events.length / 100))}
            </span>
            <Button
              variant="outline"
              disabled={(currentPage + 1) * 100 >= events.length}
              onClick={() => setPage(currentPage + 1)}
            >
              {t('observability.next')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
