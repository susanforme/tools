import { ChoiceField, Metric, NumberField } from '@/components/calculator-ui';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { materialEstimate, slopeMetrics } from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/geometry-calculator')({
  component: GeometryCalculatorPage,
});
type Mode = 'area' | 'volume' | 'slope' | 'material';
type Shape = 'rectangle' | 'circle' | 'box' | 'cylinder';

function GeometryCalculatorPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'area');
  const [shape, setShape] = useQueryParam<Shape>(
    'shape',
    StringParam,
    'rectangle',
  );
  const [a, setA] = useState(10);
  const [b, setB] = useState(5);
  const [c, setC] = useState(3);
  const [price, setPrice] = useState(20);
  const isRound =
    (mode === 'area' || mode === 'volume') &&
    (shape === 'circle' || shape === 'cylinder');
  const area = isRound ? Math.PI * a ** 2 : a * b;
  const volume = shape === 'cylinder' ? Math.PI * a ** 2 * c : a * b * c;
  const slope = slopeMetrics(a, b);
  const material = materialEstimate(a, b, c, price);
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('geometryCalculator.title')}</h1>
      <Tabs
        value={mode}
        onValueChange={(value) => {
          const next = value as Mode;
          setMode(next);
          if (next === 'area') setShape('rectangle');
          if (next === 'volume') setShape('box');
        }}
      >
        <TabsList>
          {(['area', 'volume', 'slope', 'material'] as const).map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`geometryCalculator.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {(mode === 'area' || mode === 'volume') && (
        <ChoiceField
          label={t('geometryCalculator.shape')}
          value={shape}
          onChange={(value) => setShape(value as Shape)}
          options={(mode === 'area'
            ? (['rectangle', 'circle'] as const)
            : (['box', 'cylinder'] as const)
          ).map((value) => ({
            value,
            label: t(`geometryCalculator.${value}`),
          }))}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField
          label={t(
            mode === 'slope'
              ? 'geometryCalculator.rise'
              : mode === 'material'
                ? 'geometryCalculator.materialArea'
                : isRound
                  ? 'geometryCalculator.radius'
                  : 'geometryCalculator.length',
          )}
          value={a}
          onChange={setA}
        />
        {!isRound && mode !== 'material' && (
          <NumberField
            label={t(
              mode === 'slope'
                ? 'geometryCalculator.run'
                : 'geometryCalculator.width',
            )}
            value={b}
            onChange={setB}
          />
        )}
        {mode === 'volume' && (
          <NumberField
            label={t('geometryCalculator.height')}
            value={c}
            onChange={setC}
          />
        )}
        {mode === 'material' && (
          <>
            <NumberField
              label={t('geometryCalculator.loss')}
              value={b}
              onChange={setB}
            />
            <NumberField
              label={t('geometryCalculator.coverage')}
              value={c}
              onChange={setC}
            />
            <NumberField
              label={t('geometryCalculator.unitPrice')}
              value={price}
              onChange={setPrice}
            />
          </>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {mode === 'area' && (
          <Metric
            label={t('geometryCalculator.areaResult')}
            value={area.toFixed(2)}
          />
        )}
        {mode === 'volume' && (
          <Metric
            label={t('geometryCalculator.volumeResult')}
            value={volume.toFixed(2)}
          />
        )}
        {mode === 'slope' && (
          <>
            <Metric
              label={t('geometryCalculator.slopePercent')}
              value={`${slope.percent.toFixed(2)}%`}
            />
            <Metric
              label={t('geometryCalculator.angle')}
              value={`${slope.angle.toFixed(2)}°`}
            />
          </>
        )}
        {mode === 'material' && (
          <>
            <Metric
              label={t('geometryCalculator.requiredArea')}
              value={material.requiredArea.toFixed(2)}
            />
            <Metric
              label={t('geometryCalculator.units')}
              value={String(material.units)}
            />
            <Metric
              label={t('geometryCalculator.cost')}
              value={`¥${material.cost.toFixed(2)}`}
            />
          </>
        )}
      </div>
    </div>
  );
}
