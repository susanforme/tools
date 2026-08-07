import { Metric, NumberField } from '@/components/calculator-ui';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { calculateTravelCost } from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

export const Route = createFileRoute('/travel-cost')({
  component: TravelCostPage,
});

function TravelCostPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<'fuel' | 'electric'>(
    'mode',
    StringParam,
    'fuel',
  );
  const [distance, setDistance] = useState(500);
  const [consumption, setConsumption] = useState(8);
  const [price, setPrice] = useState(8);
  const [fixed, setFixed] = useState(200);
  const [people, setPeople] = useState(2);
  const result = calculateTravelCost(
    distance,
    consumption,
    price,
    fixed,
    people,
  );
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('travelCost.title')}</h1>
      <Tabs
        value={mode}
        onValueChange={(value) => {
          const next = value as 'fuel' | 'electric';
          setMode(next);
          setConsumption(next === 'fuel' ? 8 : 15);
          setPrice(next === 'fuel' ? 8 : 0.6);
        }}
      >
        <TabsList>
          <TabsTrigger value="fuel">{t('travelCost.fuel')}</TabsTrigger>
          <TabsTrigger value="electric">{t('travelCost.electric')}</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <NumberField
          label={t('travelCost.distance')}
          value={distance}
          onChange={setDistance}
        />
        <NumberField
          label={t(
            mode === 'fuel'
              ? 'travelCost.fuelConsumption'
              : 'travelCost.powerConsumption',
          )}
          value={consumption}
          onChange={setConsumption}
        />
        <NumberField
          label={t(
            mode === 'fuel' ? 'travelCost.fuelPrice' : 'travelCost.powerPrice',
          )}
          value={price}
          onChange={setPrice}
        />
        <NumberField
          label={t('travelCost.fixed')}
          value={fixed}
          onChange={setFixed}
        />
        <NumberField
          label={t('travelCost.people')}
          value={people}
          onChange={setPeople}
          min={1}
          step={1}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label={t('travelCost.energyCost')}
          value={`¥${result.energyCost.toFixed(2)}`}
        />
        <Metric
          label={t('travelCost.total')}
          value={`¥${result.total.toFixed(2)}`}
        />
        <Metric
          label={t('travelCost.perPerson')}
          value={`¥${result.perPerson.toFixed(2)}`}
        />
      </div>
    </div>
  );
}
