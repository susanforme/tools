import { Metric, NumberField } from '@/components/calculator-ui';
import { calculateHomeBudget } from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/home-budget')({
  component: HomeBudgetPage,
});

function HomeBudgetPage() {
  const { t } = useTranslation();
  const [area, setArea] = useState(100);
  const [shared, setShared] = useState(20);
  const [unitPrice, setUnitPrice] = useState(1_500);
  const [fixed, setFixed] = useState(30_000);
  const result = calculateHomeBudget(area, shared, unitPrice, fixed);
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('homeBudget.title')}</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField
          label={t('homeBudget.grossArea')}
          value={area}
          onChange={setArea}
        />
        <NumberField
          label={t('homeBudget.sharedRate')}
          value={shared}
          onChange={setShared}
        />
        <NumberField
          label={t('homeBudget.unitPrice')}
          value={unitPrice}
          onChange={setUnitPrice}
        />
        <NumberField
          label={t('homeBudget.fixed')}
          value={fixed}
          onChange={setFixed}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label={t('homeBudget.sharedArea')}
          value={`${result.sharedArea.toFixed(2)} ㎡`}
        />
        <Metric
          label={t('homeBudget.usableArea')}
          value={`${result.usableArea.toFixed(2)} ㎡`}
        />
        <Metric
          label={t('homeBudget.renovation')}
          value={`¥${result.renovation.toFixed(2)}`}
        />
        <Metric
          label={t('homeBudget.total')}
          value={`¥${result.total.toFixed(2)}`}
        />
      </div>
    </div>
  );
}
