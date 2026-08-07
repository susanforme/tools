import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrayParam, useQueryParam } from '@/hooks/useQueryParams';
import { COMMON_CITIES } from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/meeting-planner')({
  component: MeetingPlannerPage,
});

function MeetingPlannerPage() {
  const { t, i18n } = useTranslation();
  const [cities, setCities] = useQueryParam<string[]>('cities', ArrayParam, [
    'shanghai',
    'london',
    'newYork',
  ]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hour, setHour] = useState(12);
  const instant = new Date(
    `${date}T${String(Math.floor(hour)).padStart(2, '0')}:${hour % 1 ? '30' : '00'}:00Z`,
  );
  const locale = i18n.resolvedLanguage?.startsWith('zh') ? 'zh-CN' : 'en-US';

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('meetingPlanner.title')}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t('meetingPlanner.date')}</Label>
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            {t('meetingPlanner.utcTime')}:{' '}
            {String(Math.floor(hour)).padStart(2, '0')}:{hour % 1 ? '30' : '00'}
          </Label>
          <Input
            type="range"
            min={0}
            max={23.5}
            step={0.5}
            value={hour}
            onChange={(event) => setHour(Number(event.target.value))}
          />
        </div>
      </div>
      <fieldset className="flex flex-wrap gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">
          {t('meetingPlanner.cities')}
        </legend>
        {COMMON_CITIES.map(([city]) => (
          <label
            key={city}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <Checkbox
              checked={cities.includes(city)}
              onCheckedChange={(checked) =>
                setCities(
                  checked
                    ? [...cities, city]
                    : cities.filter((value) => value !== city),
                )
              }
            />
            {t(`worldClock.cities.${city}`)}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {COMMON_CITIES.filter(([city]) => cities.includes(city)).map(
          ([city, timeZone]) => (
            <div key={city} className="rounded-xl border p-4">
              <div className="text-sm text-muted-foreground">
                {t(`worldClock.cities.${city}`)}
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {new Intl.DateTimeFormat(locale, {
                  timeZone,
                  month: 'short',
                  day: '2-digit',
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  hourCycle: 'h23',
                }).format(instant)}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
