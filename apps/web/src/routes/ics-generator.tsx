import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createIcsEvent } from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/ics-generator')({
  component: IcsGeneratorPage,
});

function IcsGeneratorPage() {
  const { t } = useTranslation();
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
