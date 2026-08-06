import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { calculateBmi, calculateWhtr } from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { Activity } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/bmi')({ component: BmiPage });

function BmiPage() {
  const { t } = useTranslation();
  const [height, setHeight] = useState('170');
  const [weight, setWeight] = useState('65');
  const [waist, setWaist] = useState('80');
  const heightValue = Number(height);
  const weightValue = Number(weight);
  const waistValue = Number(waist);
  const validBmi = heightValue > 0 && weightValue > 0;
  const validWhtr = heightValue > 0 && waistValue > 0;
  const bmi = validBmi ? calculateBmi(weightValue, heightValue) : 0;
  const whtr = validWhtr ? calculateWhtr(waistValue, heightValue) : 0;
  const bmiStatus =
    bmi < 18.5
      ? 'underweight'
      : bmi < 24
        ? 'normal'
        : bmi < 28
          ? 'overweight'
          : 'obese';
  const whtrStatus = whtr < 0.5 ? 'low' : whtr < 0.6 ? 'increased' : 'high';
  const minWeight = 18.5 * (heightValue / 100) ** 2;
  const maxWeight = 24 * (heightValue / 100) ** 2;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Activity className="h-6 w-6 text-emerald-500" />
          {t('bmi.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('bmi.description')}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="space-y-4 py-6">
            <label className="space-y-2 text-sm font-medium">
              <span>{t('bmi.height')}</span>
              <Input
                type="number"
                min="1"
                value={height}
                onChange={(event) => setHeight(event.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span>{t('bmi.weight')}</span>
              <Input
                type="number"
                min="1"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span>{t('bmi.waist')}</span>
              <Input
                type="number"
                min="1"
                value={waist}
                onChange={(event) => setWaist(event.target.value)}
              />
              <span className="block text-xs font-normal text-muted-foreground">
                {t('bmi.waistHelp')}
              </span>
            </label>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="flex h-full flex-col justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">BMI</p>
            <p className="mt-2 text-5xl font-bold tabular-nums">
              {validBmi ? bmi.toFixed(1) : '—'}
            </p>
            <p className="mt-3 text-lg font-medium">
              {validBmi ? t(`bmi.status.${bmiStatus}`) : '—'}
            </p>
            {validBmi && (
              <p className="mt-4 text-sm text-muted-foreground">
                {t('bmi.healthyWeight', {
                  min: minWeight.toFixed(1),
                  max: maxWeight.toFixed(1),
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-sky-50/50 dark:bg-sky-950/20">
          <CardContent className="flex h-full flex-col justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">WHtR</p>
            <p className="mt-2 text-5xl font-bold tabular-nums">
              {validWhtr ? whtr.toFixed(2) : '—'}
            </p>
            <p className="mt-3 text-lg font-medium">
              {validWhtr ? t(`bmi.whtrStatus.${whtrStatus}`) : '—'}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              {t('bmi.whtrFormula')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-4 overflow-hidden rounded-lg border text-center text-sm">
        <Range label={t('bmi.status.underweight')} value="< 18.5" />
        <Range label={t('bmi.status.normal')} value="18.5–23.9" />
        <Range label={t('bmi.status.overweight')} value="24.0–27.9" />
        <Range label={t('bmi.status.obese')} value="≥ 28.0" />
      </div>
      <div className="grid grid-cols-3 overflow-hidden rounded-lg border text-center text-sm">
        <Range label={t('bmi.whtrStatus.low')} value="< 0.50" />
        <Range label={t('bmi.whtrStatus.increased')} value="0.50–0.59" />
        <Range label={t('bmi.whtrStatus.high')} value="≥ 0.60" />
      </div>
      <p className="text-xs text-muted-foreground">
        {t('bmi.note')}{' '}
        <a
          href="https://www.nhc.gov.cn/ylyjs/zcwj/202412/75cb79c171c94def9e768193e65484f7/files/1736390749000_59785.pdf"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          {t('bmi.source')}
        </a>
        {' · '}
        <a
          href="https://www.nice.org.uk/guidance/ng246/chapter/Identifying-and-assessing-overweight-obesity-and-central-adiposity"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          {t('bmi.whtrSource')}
        </a>
      </p>
    </div>
  );
}

function Range({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r p-3 last:border-r-0">
      <p className="font-medium">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{value}</p>
    </div>
  );
}
