import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import {
  StringParam,
  useQueryParams,
  withDefault,
} from '@/hooks/useQueryParams';
import type {
  CalendarMergeRequest,
  CalendarMergeResult,
} from '@/lib/calendar-merge';
import { downloadBlob } from '@/lib/download';
import { OrganizerInput } from './organizer-store';
import { Button } from './ui/button';
const createWorker = () =>
  new Worker(
    new URL('../workers/calendar-availability.worker.ts', import.meta.url),
    { type: 'module' },
  );
export default function CalendarMergePanel() {
  const { t } = useTranslation();
  const tr = (k: string) => t(`organizerTools.${k}`);
  const [query, setQuery] = useQueryParams<{
    from: string;
    to: string;
    filter: string;
  }>({
    from: withDefault<string>(
      StringParam,
      new Date().toISOString().slice(0, 10) + 'T00:00',
    ),
    to: withDefault<string>(
      StringParam,
      new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) + 'T00:00',
    ),
    filter: withDefault<string>(StringParam, ''),
  });
  const [files, setFiles] = useState<{ name: string; text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const version = useRef(0);
  const task = useBoundedWorker<CalendarMergeRequest, CalendarMergeResult>(
    createWorker,
    10000,
  );
  useEffect(() => {
    task.clear();
  }, [query.from, query.to, query.filter, task.clear]);
  useEffect(
    () => () => {
      version.current++;
    },
    [],
  );
  const format = (v: number) => new Date(v).toLocaleString();
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">{tr('calendar.hint')}</p>
      <OrganizerInput
        label={tr('calendar.upload')}
        type="file"
        accept=".ics,text/calendar"
        multiple
        disabled={loading}
        onChange={async (e) => {
          const list = Array.from(e.target.files ?? []);
          e.target.value = '';
          const current = ++version.current;
          task.clear();
          setError(null);
          setLoading(true);
          try {
            if (
              list.length + files.length > 20 ||
              list.reduce((a, f) => a + f.size, 0) +
                files.reduce(
                  (a, f) => a + new TextEncoder().encode(f.text).length,
                  0,
                ) >
                1e6
            )
              throw Error('calendarSize');
            const parsed = await Promise.all(
              list.map(async (f) => ({ name: f.name, text: await f.text() })),
            );
            if (current === version.current)
              setFiles((prev) => [...prev, ...parsed]);
          } catch (cause) {
            if (current === version.current) setError((cause as Error).message);
          } finally {
            if (current === version.current) setLoading(false);
          }
        }}
      />
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="break-all">{f.name}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              version.current++;
              task.clear();
              setFiles((prev) => prev.filter((_, j) => j !== i));
              setLoading(false);
            }}
          >
            {tr('delete')}
          </Button>
        </div>
      ))}
      <div className="grid gap-3 md:grid-cols-3">
        <OrganizerInput
          label={tr('calendar.from')}
          type="datetime-local"
          value={query.from}
          onChange={(e) => setQuery({ from: e.target.value })}
        />
        <OrganizerInput
          label={tr('calendar.to')}
          type="datetime-local"
          value={query.to}
          onChange={(e) => setQuery({ to: e.target.value })}
        />
        <OrganizerInput
          label={tr('calendar.filter')}
          value={query.filter}
          onChange={(e) => setQuery({ filter: e.target.value })}
        />
      </div>
      <div className="flex gap-3">
        <Button
          disabled={task.busy || loading || !files.length}
          onClick={() => {
            setError(null);
            task.run({
              from: query.from ?? '',
              to: query.to ?? '',
              filter: query.filter ?? '',
              sources: files.map((f) => f.text),
            });
          }}
        >
          {tr('calendar.analyze')}
        </Button>
        {task.busy && (
          <Button variant="outline" onClick={task.cancel}>
            {tr('cancel')}
          </Button>
        )}
      </div>
      {(error || task.error) && (
        <p role="alert" className="text-destructive">
          {t(`organizerTools.${error ?? task.error!}`, {
            defaultValue: tr('processError'),
          })}
        </p>
      )}
      {task.result && (
        <>
          <p>
            {tr('calendar.events')}: {task.result.events} ·{' '}
            {tr('calendar.duplicates')}: {task.result.duplicates} ·{' '}
            {tr('calendar.occurrences')}: {task.result.occurrences.length}
          </p>
          <Button
            onClick={() =>
              downloadBlob(
                new Blob([task.result!.ics], {
                  type: 'text/calendar;charset=utf-8',
                }),
                'merged-calendar.ics',
              )
            }
          >
            {tr('calendar.export')}
          </Button>
          <h3 className="font-semibold">
            {tr('calendar.conflicts')} ({task.result.conflicts.length})
          </h3>
          {task.result.conflicts.slice(0, 100).map(([a, b]) => (
            <p key={`${a}-${b}`} className="rounded border p-2 text-sm">
              {task.result!.occurrences[a].title} ↔{' '}
              {task.result!.occurrences[b].title} ·{' '}
              {format(
                Math.max(
                  task.result!.occurrences[a].start,
                  task.result!.occurrences[b].start,
                ),
              )}{' '}
              –{' '}
              {format(
                Math.min(
                  task.result!.occurrences[a].end,
                  task.result!.occurrences[b].end,
                ),
              )}
            </p>
          ))}
          {task.result.conflicts.length > 100 && (
            <p>{tr('calendar.truncated')}</p>
          )}
          <h3 className="font-semibold">{tr('calendar.free')}</h3>
          {task.result.free.map((f) => (
            <p key={f.start} className="text-sm">
              {format(f.start)} – {format(f.end)}
            </p>
          ))}
          <details>
            <summary>{tr('calendar.occurrences')}</summary>
            {task.result.occurrences.map((o, i) => (
              <p key={i} className="p-2 text-sm">
                {o.title} · {format(o.start)} – {format(o.end)}
              </p>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
