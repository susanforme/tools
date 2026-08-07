import { Metric, NumberField } from '@/components/calculator-ui';
import { calculatePace } from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/pace-calculator')({
  component: PaceCalculatorPage,
});

function PaceCalculatorPage() {
  const { t } = useTranslation();
  const [distance, setDistance] = useState(10);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(50);
  const [seconds, setSeconds] = useState(0);
  const result = calculatePace(distance, hours * 3600 + minutes * 60 + seconds);
  const roundedPace = Math.round(result.paceSeconds);
  const paceMinutes = Math.floor(roundedPace / 60);
  const paceSeconds = roundedPace % 60;
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('paceCalculator.title')}</h1>
      <div className="grid gap-3 sm:grid-cols-4">
        <NumberField
          label={t('paceCalculator.distance')}
          value={distance}
          onChange={setDistance}
        />
        <NumberField
          label={t('paceCalculator.hours')}
          value={hours}
          onChange={setHours}
          step={1}
        />
        <NumberField
          label={t('paceCalculator.minutes')}
          value={minutes}
          onChange={setMinutes}
          step={1}
        />
        <NumberField
          label={t('paceCalculator.seconds')}
          value={seconds}
          onChange={setSeconds}
          step={1}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric
          label={t('paceCalculator.pace')}
          value={`${paceMinutes}:${String(paceSeconds).padStart(2, '0')} /km`}
        />
        <Metric
          label={t('paceCalculator.speed')}
          value={`${result.speedKmh.toFixed(2)} km/h`}
        />
      </div>
    </div>
  );
}
