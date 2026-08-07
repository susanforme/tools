import { Metric } from '@/components/calculator-ui';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  calculateAge,
  countWorkdays,
  dateInterval,
} from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

export const Route = createFileRoute('/date-calculator')({
  component: DateCalculatorPage,
});
type Mode = 'age' | 'interval' | 'countdown' | 'workdays';

function DateCalculatorPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'age');
  const [start, setStart] = useState('2000-01-01');
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [target, setTarget] = useState(
    `${new Date().getFullYear() + 1}-01-01T00:00`,
  );
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const from = new Date(`${start}T00:00:00`);
  const to = new Date(`${end}T00:00:00`);
  const age = calculateAge(from, to);
  const interval = dateInterval(from, to);
  const remaining = Math.max(0, new Date(target).getTime() - now);
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('dateCalculator.title')}</h1>
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList>
          <TabsTrigger value="age">{t('dateCalculator.age')}</TabsTrigger>
          <TabsTrigger value="interval">
            {t('dateCalculator.interval')}
          </TabsTrigger>
          <TabsTrigger value="countdown">
            {t('dateCalculator.countdown')}
          </TabsTrigger>
          <TabsTrigger value="workdays">
            {t('dateCalculator.workdays')}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === 'countdown' ? (
        <DateField label={t('dateCalculator.target')}>
          <Input
            type="datetime-local"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </DateField>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <DateField label={t('dateCalculator.start')}>
            <Input
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </DateField>
          <DateField label={t('dateCalculator.end')}>
            <Input
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </DateField>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {mode === 'age' && (
          <>
            <Metric
              label={t('dateCalculator.fullYears')}
              value={String(age.years)}
            />
            <Metric
              label={t('dateCalculator.nextBirthday')}
              value={String(age.daysToBirthday)}
            />
          </>
        )}
        {mode === 'interval' && (
          <>
            <Metric
              label={t('dateCalculator.days')}
              value={String(interval.days)}
            />
            <Metric
              label={t('dateCalculator.hours')}
              value={String(interval.hours)}
            />
          </>
        )}
        {mode === 'workdays' && (
          <Metric
            label={t('dateCalculator.workdayCount')}
            value={String(countWorkdays(from, to))}
          />
        )}
        {mode === 'countdown' && (
          <>
            <Metric label={t('dateCalculator.days')} value={String(days)} />
            <Metric label={t('dateCalculator.hours')} value={String(hours)} />
            <Metric
              label={t('dateCalculator.minutes')}
              value={String(minutes)}
            />
            <Metric
              label={t('dateCalculator.seconds')}
              value={String(seconds)}
            />
          </>
        )}
      </div>
    </div>
  );
}

function DateField({
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
