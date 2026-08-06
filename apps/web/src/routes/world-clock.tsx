import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Clock, Globe2, LoaderCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/world-clock')({
  component: WorldClockPage,
});

const CITIES = [
  ['shanghai', 'Asia/Shanghai'],
  ['tokyo', 'Asia/Tokyo'],
  ['singapore', 'Asia/Singapore'],
  ['dubai', 'Asia/Dubai'],
  ['london', 'Europe/London'],
  ['paris', 'Europe/Paris'],
  ['moscow', 'Europe/Moscow'],
  ['newYork', 'America/New_York'],
  ['losAngeles', 'America/Los_Angeles'],
  ['saoPaulo', 'America/Sao_Paulo'],
  ['sydney', 'Australia/Sydney'],
  ['auckland', 'Pacific/Auckland'],
] as const;

async function fetchUtcTime() {
  const requestStartedAt = Date.now();
  try {
    const response = await api.time.$get();
    if (!response.ok) throw new Error('UTC time request failed');
    const { utc } = await response.json();
    const receivedAt = Date.now();
    const utcMs = Date.parse(utc);
    if (Number.isNaN(utcMs)) throw new Error('Invalid UTC time');
    return {
      receivedAt,
      utcMs: utcMs + (receivedAt - requestStartedAt) / 2,
    };
  } catch {
    const now = Date.now();
    return { receivedAt: now, utcMs: now };
  }
}

function WorldClockPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith('zh') ? 'zh-CN' : 'en-US';
  const [tick, setTick] = useState(Date.now());
  const clock = useQuery({
    queryKey: ['utc-time'],
    queryFn: fetchUtcTime,
    refetchInterval: 5 * 60 * 1000,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const now = clock.data
    ? new Date(clock.data.utcMs + tick - clock.data.receivedAt)
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Globe2 className="h-6 w-6 text-sky-500" />
            {t('worldClock.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('worldClock.description')}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={clock.isFetching}
          onClick={() => clock.refetch()}
        >
          {clock.isFetching ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {t('worldClock.sync')}
        </Button>
      </div>

      <Card className="border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/20">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <p className="text-sm text-muted-foreground">
              {t('worldClock.serverUtc')}
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums sm:text-3xl">
              {now?.toISOString().replace('T', ' ').slice(0, 19) ?? '—'} UTC
            </p>
          </div>
          <Clock className="h-10 w-10 text-sky-500" />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {CITIES.map(([city, timeZone]) => (
          <CityClock
            key={city}
            city={t(`worldClock.cities.${city}`)}
            date={now}
            locale={locale}
            timeZone={timeZone}
          />
        ))}
      </div>
    </div>
  );
}

function CityClock({
  city,
  date,
  locale,
  timeZone,
}: {
  city: string;
  date: Date | null;
  locale: string;
  timeZone: string;
}) {
  const time = date
    ? new Intl.DateTimeFormat(locale, {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).format(date)
    : '—';
  const day = date
    ? new Intl.DateTimeFormat(locale, {
        timeZone,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        weekday: 'short',
      }).format(date)
    : '—';
  const offset = date
    ? new Intl.DateTimeFormat('en', {
        timeZone,
        timeZoneName: 'shortOffset',
      })
        .formatToParts(date)
        .find((part) => part.type === 'timeZoneName')?.value
    : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>{city}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {offset}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-3xl font-semibold tabular-nums">{time}</p>
        <p className="mt-2 text-sm text-muted-foreground">{day}</p>
        <p className="mt-1 text-xs text-muted-foreground">{timeZone}</p>
      </CardContent>
    </Card>
  );
}
