import { Metric, NumberField } from '@/components/calculator-ui';
import { BankValidationPanel } from '@/components/recommended-tool-panels';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  calculatePrepayment,
  futureValue,
  purchasingPower,
  requiredMonthlySavings,
} from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/finance-calculator')({
  component: FinanceCalculatorPage,
});
type Mode =
  | 'compound'
  | 'investment'
  | 'goal'
  | 'prepayment'
  | 'inflation'
  | 'bank';

function FinanceCalculatorPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'compound');
  const [initial, setInitial] = useState(100_000);
  const [monthly, setMonthly] = useState(3_000);
  const [rate, setRate] = useState(4);
  const [years, setYears] = useState(10);
  const [target, setTarget] = useState(1_000_000);
  const [months, setMonths] = useState(240);
  const [prepayment, setPrepayment] = useState(100_000);
  const future = futureValue(
    initial,
    mode === 'compound' ? 0 : monthly,
    rate,
    years,
  );
  const prepay = calculatePrepayment(initial, rate, months, prepayment);
  const result =
    mode === 'goal'
      ? requiredMonthlySavings(target, initial, rate, years)
      : mode === 'inflation'
        ? purchasingPower(initial, rate, years)
        : future;
  const money = (value: number) => `¥${value.toFixed(2)}`;
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('financeCalculator.title')}</h1>
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList className="h-auto flex-wrap">
          {(
            [
              'compound',
              'investment',
              'goal',
              'prepayment',
              'inflation',
              'bank',
            ] as const
          ).map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`financeCalculator.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {mode === 'bank' ? (
        <BankValidationPanel />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField
              label={t(
                mode === 'prepayment'
                  ? 'financeCalculator.principal'
                  : 'financeCalculator.initial',
              )}
              value={initial}
              onChange={setInitial}
            />
            {mode === 'investment' && (
              <NumberField
                label={t('financeCalculator.monthly')}
                value={monthly}
                onChange={setMonthly}
              />
            )}
            {mode === 'goal' && (
              <NumberField
                label={t('financeCalculator.target')}
                value={target}
                onChange={setTarget}
              />
            )}
            {mode === 'prepayment' && (
              <>
                <NumberField
                  label={t('financeCalculator.months')}
                  value={months}
                  step={1}
                  onChange={setMonths}
                />
                <NumberField
                  label={t('financeCalculator.prepaymentAmount')}
                  value={prepayment}
                  onChange={setPrepayment}
                />
              </>
            )}
            <NumberField
              label={t(
                mode === 'inflation'
                  ? 'financeCalculator.inflationRate'
                  : 'financeCalculator.rate',
              )}
              value={rate}
              step={0.1}
              onChange={setRate}
            />
            {mode !== 'prepayment' && (
              <NumberField
                label={t('financeCalculator.years')}
                value={years}
                step={1}
                onChange={setYears}
              />
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {mode === 'prepayment' ? (
              <>
                <Metric
                  label={t('financeCalculator.beforePayment')}
                  value={money(prepay.before)}
                />
                <Metric
                  label={t('financeCalculator.afterPayment')}
                  value={money(prepay.after)}
                />
                <Metric
                  label={t('financeCalculator.interestSaved')}
                  value={money(prepay.interestSaved)}
                />
              </>
            ) : (
              <Metric
                label={t(
                  mode === 'goal'
                    ? 'financeCalculator.requiredMonthly'
                    : mode === 'inflation'
                      ? 'financeCalculator.purchasingPower'
                      : 'financeCalculator.futureValue',
                )}
                value={money(result)}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
