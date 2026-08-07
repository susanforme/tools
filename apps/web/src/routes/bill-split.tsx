import { Metric, NumberField } from '@/components/calculator-ui';
import { splitBill } from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/bill-split')({
  component: BillSplitPage,
});

function BillSplitPage() {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(500);
  const [tip, setTip] = useState(10);
  const [people, setPeople] = useState(4);
  const result = splitBill(amount, tip, people);
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('billSplit.title')}</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label={t('billSplit.amount')}
          value={amount}
          onChange={setAmount}
        />
        <NumberField label={t('billSplit.tip')} value={tip} onChange={setTip} />
        <NumberField
          label={t('billSplit.people')}
          value={people}
          onChange={setPeople}
          min={1}
          step={1}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label={t('billSplit.tipAmount')}
          value={`¥${result.tip.toFixed(2)}`}
        />
        <Metric
          label={t('billSplit.total')}
          value={`¥${result.total.toFixed(2)}`}
        />
        <Metric
          label={t('billSplit.perPerson')}
          value={`¥${result.perPerson.toFixed(2)}`}
        />
      </div>
    </div>
  );
}
