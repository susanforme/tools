import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createIcsEvent, inspectIcs } from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/ics-generator')({
  component: IcsGeneratorPage,
});

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260813T020000Z
DTEND:20260813T030000Z
SUMMARY:Weekly sync
LOCATION:Online
RRULE:FREQ=WEEKLY;COUNT=4
END:VEVENT
END:VCALENDAR`;

type Tab = 'generate' | 'inspect';

function IcsGeneratorPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<Tab>('tab', StringParam, 'generate');
  const localDateTime = (value: Date) => {
    const local = new Date(
      value.getTime() - value.getTimezoneOffset() * 60_000,
    );
    return local.toISOString().slice(0, 16);
  };
  const initial = localDateTime(new Date(Date.now() + 3_600_000));
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState(initial);
  const [end, setEnd] = useState(
    localDateTime(new Date(Date.now() + 7_200_000)),
  );
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [inspectInput, setInspectInput] = useState(SAMPLE_ICS);
  const inspection = useMemo(() => inspectIcs(inspectInput), [inspectInput]);

  const generate = () => {
    setError(null);
    if (!title.trim() || new Date(end) <= new Date(start)) {
      setError(t('icsGenerator.invalid'));
      return;
    }
    setContent(
      createIcsEvent({
        title: title.trim(),
        location,
        description,
        start: new Date(start),
        end: new Date(end),
      }),
    );
  };

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([content], { type: 'text/calendar;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'event.ics';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('icsGenerator.title')}</h1>
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="generate">
            {t('icsGenerator.generate')}
          </TabsTrigger>
          <TabsTrigger value="inspect">{t('icsGenerator.inspect')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'generate' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('icsGenerator.eventTitle')}>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <Field label={t('icsGenerator.location')}>
              <Input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </Field>
            <Field label={t('icsGenerator.start')}>
              <Input
                type="datetime-local"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </Field>
            <Field label={t('icsGenerator.end')}>
              <Input
                type="datetime-local"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </Field>
          </div>
          <Field label={t('icsGenerator.description')}>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <div className="flex gap-2">
            <Button onClick={generate}>{t('icsGenerator.generate')}</Button>
            <Button variant="outline" disabled={!content} onClick={download}>
              {t('icsGenerator.download')}
            </Button>
          </div>
          {content && (
            <Textarea className="min-h-64 font-mono" readOnly value={content} />
          )}
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Textarea
            value={inspectInput}
            onChange={(event) => setInspectInput(event.target.value)}
            className="min-h-[480px] font-mono text-xs"
          />
          <div className="space-y-3">
            {inspection.issues.map((issue, index) => (
              <div
                key={`${issue.event}-${issue.code}-${index}`}
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {issue.event
                  ? `${t('icsGenerator.event')} ${issue.event}: `
                  : ''}
                {t(`icsGenerator.issues.${issue.code}`)}
              </div>
            ))}
            {inspection.events.map((event, index) => (
              <div
                key={index}
                className="space-y-2 rounded-lg border p-4 text-sm"
              >
                <h2 className="font-semibold">
                  {event.summary || `${t('icsGenerator.event')} ${index + 1}`}
                </h2>
                <div className="grid gap-2 text-muted-foreground sm:grid-cols-2">
                  <span>
                    {t('icsGenerator.start')}: {event.start || '—'}
                  </span>
                  <span>
                    {t('icsGenerator.end')}: {event.end || '—'}
                  </span>
                  <span>
                    {t('icsGenerator.location')}: {event.location || '—'}
                  </span>
                  <span>RRULE: {event.recurrence || '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
