import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { calculateMortgage, type MortgageMethod } from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { Calculator, House } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/mortgage')({
  component: MortgagePage,
});

function money(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  }).format(value);
}

function MortgagePage() {
  const { t } = useTranslation();
  const [methodQuery, setMethod] = useQueryParam<MortgageMethod>(
    'method',
    StringParam,
    'equal-payment',
  );
  const method: MortgageMethod =
    methodQuery === 'equal-principal' ? methodQuery : 'equal-payment';
  const [amount, setAmount] = useState('100');
  const [years, setYears] = useState('30');
  const [rate, setRate] = useState('3');
  const principal = Math.max(0, Number(amount) || 0) * 10_000;
  const result = calculateMortgage(
    principal,
    Math.max(1, Number(years) || 1),
    Math.max(0, Number(rate) || 0),
    method,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <House className="h-6 w-6 text-blue-500" />
          {t('mortgage.title')}
        </h1>
      </div>

      <Card>
        <CardContent className="grid gap-4 py-6 md:grid-cols-3">
          <NumberField
            label={t('mortgage.amount')}
            value={amount}
            onChange={setAmount}
          />
          <NumberField
            label={t('mortgage.years')}
            value={years}
            onChange={setYears}
          />
          <NumberField
            label={t('mortgage.rate')}
            value={rate}
            onChange={setRate}
            step="0.01"
          />
          <div className="flex gap-2 md:col-span-3">
            <Button
              type="button"
              variant={method === 'equal-payment' ? 'default' : 'outline'}
              onClick={() => setMethod('equal-payment')}
            >
              {t('mortgage.equalPayment')}
            </Button>
            <Button
              type="button"
              variant={method === 'equal-principal' ? 'default' : 'outline'}
              onClick={() => setMethod('equal-principal')}
            >
              {t('mortgage.equalPrincipal')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ResultCard
          label={
            method === 'equal-payment'
              ? t('mortgage.monthlyPayment')
              : t('mortgage.firstPayment')
          }
          value={money(result.firstPayment)}
        />
        <ResultCard
          label={t('mortgage.totalInterest')}
          value={money(result.totalInterest)}
        />
        <ResultCard
          label={t('mortgage.totalPayment')}
          value={money(result.totalPayment)}
        />
        <ResultCard
          label={t('mortgage.months')}
          value={String(result.months)}
        />
      </div>

      {method === 'equal-principal' && (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm">
          {t('mortgage.monthlyDecrease')}：{money(result.monthlyDecrease)}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('mortgage.note')}</p>
    </div>
  );
}

function NumberField({
  label,
  onChange,
  step = '1',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  step?: string;
  value: string;
}) {
  return (
    <label className="space-y-2 text-sm font-medium">
      <span>{label}</span>
      <Input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ResultCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Calculator className="h-4 w-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xl font-semibold tabular-nums">
        {value}
      </CardContent>
    </Card>
  );
}
