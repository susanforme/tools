import { Metric, NumberField } from '@/components/calculator-ui';
import { calculateAnnualSalaryTax } from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/salary-tax')({
  component: SalaryTaxPage,
});

function SalaryTaxPage() {
  const { t } = useTranslation();
  const [gross, setGross] = useState(20_000);
  const [social, setSocial] = useState(3_000);
  const [deduction, setDeduction] = useState(2_000);
  const result = calculateAnnualSalaryTax(gross, social, deduction);
  const money = (value: number) => `¥${value.toFixed(2)}`;
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('salaryTax.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('salaryTax.basis')}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label={t('salaryTax.gross')}
          value={gross}
          onChange={setGross}
        />
        <NumberField
          label={t('salaryTax.social')}
          value={social}
          onChange={setSocial}
        />
        <NumberField
          label={t('salaryTax.deduction')}
          value={deduction}
          onChange={setDeduction}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label={t('salaryTax.monthlyNet')}
          value={money(result.monthlyNet)}
        />
        <Metric
          label={t('salaryTax.monthlyTax')}
          value={money(result.monthlyTax)}
        />
        <Metric
          label={t('salaryTax.annualTax')}
          value={money(result.annualTax)}
        />
        <Metric label={t('salaryTax.taxable')} value={money(result.taxable)} />
      </div>
    </div>
  );
}
