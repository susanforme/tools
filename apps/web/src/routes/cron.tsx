import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

export const Route = createFileRoute('/cron')({ component: CronPage });

const PRESETS = [
  ['*/5 * * * *', 'cron.everyFiveMinutes'],
  ['0 9 * * 1-5', 'cron.weekdays'],
  ['0 0 1 * *', 'cron.monthly'],
] as const;

const TIMEZONES = ['UTC', 'Asia/Shanghai', 'America/New_York', 'Europe/London'];

function CronPage() {
  const { t, i18n } = useTranslation();
  const [expression, setExpression] = useState('0 9 * * 1-5');
  const [timezone, setTimezone] = useQueryParam<string>(
    'tz',
    StringParam,
    'Asia/Shanghai',
  );
  const [dates, setDates] = useState<Date[]>([]);
  const [error, setError] = useState<string | null>(null);

  const preview = async () => {
    setError(null);
    try {
      const { CronExpressionParser } = await import('cron-parser');
      const interval = CronExpressionParser.parse(expression, { tz: timezone });
      setDates(interval.take(10).map((date) => date.toDate()));
    } catch (cause) {
      setDates([]);
      setError(t('cron.failed', { msg: (cause as Error).message }));
    }
  };

  const fields = expression.trim().split(/\s+/);
  const updateField = (index: number, value: string) => {
    const next = Array.from(
      { length: 5 },
      (_, fieldIndex) => fields[fieldIndex] ?? '*',
    );
    next[index] = value || '*';
    setExpression(next.join(' '));
  };
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('cron.title')}</h1>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(([value, key]) => (
          <Button
            key={value}
            size="sm"
            variant="outline"
            onClick={() => setExpression(value)}
          >
            {t(key)}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <Input
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          className="font-mono"
        />
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={preview}>{t('cron.preview')}</Button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        {[
          t('cron.minute'),
          t('cron.hour'),
          t('cron.day'),
          t('cron.month'),
          t('cron.weekday'),
        ].map((label, index) => (
          <div key={label} className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <Input
              value={fields[index] ?? '*'}
              onChange={(event) => updateField(index, event.target.value)}
              className="mt-2 h-8 font-mono text-xs"
            />
          </div>
        ))}
      </div>
      <div className="divide-y rounded-lg border">
        {dates.map((date) => (
          <div
            key={date.toISOString()}
            className="flex justify-between gap-3 px-4 py-3 text-sm"
          >
            <span>
              {new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                dateStyle: 'medium',
                timeStyle: 'medium',
                timeZone: timezone,
              }).format(date)}
            </span>
            <span className="font-mono text-muted-foreground">
              {date.toISOString()}
            </span>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
