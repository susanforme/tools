import { FileDropzone } from '@/components/file-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import {
  NumberParam,
  StringParam,
  useQueryParams,
  withDefault,
} from '@/hooks/useQueryParams';
import {
  CALENDAR_MAX_BYTES,
  RECURRENCE_SAMPLE,
  type RecurrenceRequest,
  type RecurrenceResult,
} from '@/lib/calendar-recurrence';
import { downloadBlob } from '@/lib/download';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const createWorker = (): Worker =>
  new Worker(
    new URL('../workers/calendar-recurrence.worker.ts', import.meta.url),
    { type: 'module' },
  );

export default function CalendarRecurrencePanel() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{ from: string; count: number }>({
    from: withDefault<string>(
      StringParam,
      new Date().toISOString().slice(0, 10),
    ),
    count: withDefault<number>(NumberParam, 100),
  });
  const [input, setInput] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const fileVersion = useRef(0);
  const task = useBoundedWorker<RecurrenceRequest, RecurrenceResult>(
    createWorker,
  );
  const error = fileError ?? task.error;
  useEffect(
    () => () => {
      fileVersion.current++;
    },
    [],
  );
  function edit(value: string) {
    fileVersion.current++;
    task.clear();
    setFileError(null);
    setInput(value);
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    task.clear();
    setFileError(null);
    const current = ++fileVersion.current;
    try {
      if (file.size > CALENDAR_MAX_BYTES) throw new Error('sizeLimit');
      const text = await file.text();
      if (current === fileVersion.current) edit(text);
    } catch (cause) {
      if (current === fileVersion.current)
        setFileError((cause as Error).message);
    }
  }
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('calendarRecurrence.limits')}
      </p>
      <FileDropzone
        accept=".ics,text/calendar"
        onFiles={(files) => void upload(files[0]?.file)}
        className="block rounded-lg p-4 text-center text-sm"
      >
        {t('calendarRecurrence.upload')}
      </FileDropzone>
      <Label htmlFor="recurrence-input">{t('calendarRecurrence.input')}</Label>
      <Textarea
        id="recurrence-input"
        value={input}
        onChange={(event) => edit(event.target.value)}
        className="h-64 font-mono text-sm"
        spellCheck={false}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="recurrence-from">
            {t('calendarRecurrence.from')}
          </Label>
          <Input
            id="recurrence-from"
            type="date"
            value={query.from ?? ''}
            onChange={(event) => {
              task.clear();
              setQuery({ from: event.target.value });
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="recurrence-count">
            {t('calendarRecurrence.limit')}
          </Label>
          <Input
            id="recurrence-count"
            type="number"
            min={1}
            max={500}
            value={query.count ?? 100}
            onChange={(event) => {
              task.clear();
              setQuery({ count: Number(event.target.value) });
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={task.busy || !input.trim()}
          onClick={() => {
            setFileError(null);
            task.run({
              input,
              from: query.from ?? '',
              limit: query.count ?? 100,
            });
          }}
        >
          {t('calendarRecurrence.run')}
        </Button>
        {task.busy && (
          <Button variant="outline" onClick={task.cancel}>
            {t('calendarRecurrence.cancel')}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            edit(RECURRENCE_SAMPLE);
            setQuery({ from: '2026-03-01', count: 100 });
          }}
        >
          {t('calendarRecurrence.sample')}
        </Button>
        <Button variant="outline" onClick={() => edit('')}>
          {t('calendarRecurrence.clear')}
        </Button>
        {task.result && (
          <Button
            variant="outline"
            onClick={() =>
              downloadBlob(
                new Blob([JSON.stringify(task.result, null, 2)], {
                  type: 'application/json',
                }),
                'calendar-occurrences.json',
              )
            }
          >
            {t('calendarRecurrence.download')}
          </Button>
        )}
      </div>
      {task.busy && <p role="status">{t('calendarRecurrence.loading')}</p>}
      {error && (
        <p role="alert" className="break-words text-sm text-destructive">
          {t('calendarRecurrence.failed', {
            message: t(`calendarRecurrence.errors.${error}`, {
              defaultValue: error,
            }),
          })}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {t('calendarRecurrence.note')}
      </p>
      {task.result && (
        <>
          <p>
            {t('calendarRecurrence.summary', {
              count: task.result.occurrences.length,
            })}
          </p>
          {task.result.more && (
            <p role="status" className="text-sm">
              {t('calendarRecurrence.more')}
            </p>
          )}
          {task.result.scanLimit && (
            <p role="status" className="text-sm text-destructive">
              {t('calendarRecurrence.scanLimit')}
            </p>
          )}
          {!task.result.occurrences.length ? (
            <p>{t('calendarRecurrence.empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {['event', 'start', 'end', 'zone', 'utc'].map((key) => (
                    <TableHead key={key}>
                      {t(`calendarRecurrence.${key}`)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {task.result.occurrences.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="max-w-48 break-words">
                      {row.summary}
                      {row.exception && (
                        <span className="block text-xs text-muted-foreground">
                          {t('calendarRecurrence.exception')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {row.start}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {row.end}
                    </TableCell>
                    <TableCell>
                      {['floating', 'date'].includes(row.zone)
                        ? t(`calendarRecurrence.${row.zone}`)
                        : row.zone}
                      <span className="block whitespace-nowrap text-xs">
                        {row.offset}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {row.utc ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </section>
  );
}
