import { Metric, NumberField } from '@/components/calculator-ui';
import { scaleRecipe } from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/recipe-scale')({
  component: RecipeScalePage,
});

function RecipeScalePage() {
  const { t } = useTranslation();
  const [original, setOriginal] = useState(4);
  const [target, setTarget] = useState(6);
  const [amount, setAmount] = useState(250);
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('recipeScale.title')}</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label={t('recipeScale.original')}
          value={original}
          onChange={setOriginal}
          min={1}
        />
        <NumberField
          label={t('recipeScale.target')}
          value={target}
          onChange={setTarget}
          min={1}
        />
        <NumberField
          label={t('recipeScale.amount')}
          value={amount}
          onChange={setAmount}
        />
      </div>
      <Metric
        label={t('recipeScale.scaled')}
        value={scaleRecipe(amount, original, target).toFixed(2)}
      />
    </div>
  );
}
