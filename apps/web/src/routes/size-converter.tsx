import { Metric, NumberField } from '@/components/calculator-ui';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { convertShoeSize } from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

export const Route = createFileRoute('/size-converter')({
  component: SizeConverterPage,
});

function SizeConverterPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<'shoe' | 'clothing'>(
    'mode',
    StringParam,
    'shoe',
  );
  const [foot, setFoot] = useState(25);
  const [chest, setChest] = useState(96);
  const shoe = convertShoeSize(foot);
  const clothing =
    chest < 84
      ? ['XS', '160/80A', '0']
      : chest < 92
        ? ['S', '165/84A', '2-4']
        : chest < 100
          ? ['M', '170/92A', '6-8']
          : chest < 108
            ? ['L', '175/100A', '10-12']
            : chest < 116
              ? ['XL', '180/108A', '14-16']
              : ['2XL', '185/116A', '18-20'];
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('sizeConverter.title')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('sizeConverter.reference')}
      </p>
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as 'shoe' | 'clothing')}
      >
        <TabsList>
          <TabsTrigger value="shoe">{t('sizeConverter.shoe')}</TabsTrigger>
          <TabsTrigger value="clothing">
            {t('sizeConverter.clothing')}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === 'shoe' ? (
        <>
          <NumberField
            label={t('sizeConverter.footLength')}
            value={foot}
            onChange={setFoot}
          />
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="CN" value={String(shoe.cn)} />
            <Metric label="EU" value={String(shoe.eu)} />
            <Metric label="US" value={shoe.us.toFixed(1)} />
            <Metric label="UK" value={shoe.uk.toFixed(1)} />
          </div>
        </>
      ) : (
        <>
          <NumberField
            label={t('sizeConverter.chest')}
            value={chest}
            onChange={setChest}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label={t('sizeConverter.international')}
              value={clothing[0]}
            />
            <Metric label="CN" value={clothing[1]} />
            <Metric label="US" value={clothing[2]} />
          </div>
        </>
      )}
    </div>
  );
}
