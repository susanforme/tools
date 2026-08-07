import { Metric, NumberField } from '@/components/calculator-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { applianceEnergy } from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/home-energy')({
  component: HomeEnergyPage,
});
type Appliance = {
  count: number;
  days: number;
  hours: number;
  id: string;
  name: string;
  watts: number;
};
const createAppliance = (): Appliance => ({
  id: crypto.randomUUID(),
  name: '',
  watts: 1000,
  hours: 1,
  days: 30,
  count: 1,
});

function HomeEnergyPage() {
  const { t } = useTranslation();
  const [price, setPrice] = useState(0.6);
  const [items, setItems] = useState<Appliance[]>([createAppliance()]);
  const update = (id: string, changes: Partial<Appliance>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  const total = items.reduce(
    (sum, item) =>
      sum + applianceEnergy(item.watts, item.hours, item.days, item.count),
    0,
  );
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('homeEnergy.title')}</h1>
      <div className="max-w-xs">
        <NumberField
          label={t('homeEnergy.price')}
          value={price}
          min={0}
          step={0.01}
          onChange={setPrice}
        />
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid items-end gap-3 rounded-xl border p-4 sm:grid-cols-6"
          >
            <Input
              aria-label={t('homeEnergy.name')}
              value={item.name}
              placeholder={t('homeEnergy.name')}
              onChange={(event) =>
                update(item.id, { name: event.target.value })
              }
            />
            <NumberField
              label={t('homeEnergy.watts')}
              value={item.watts}
              onChange={(watts) => update(item.id, { watts })}
            />
            <NumberField
              label={t('homeEnergy.hours')}
              value={item.hours}
              step={0.1}
              onChange={(hours) => update(item.id, { hours })}
            />
            <NumberField
              label={t('homeEnergy.days')}
              value={item.days}
              step={1}
              onChange={(days) => update(item.id, { days })}
            />
            <NumberField
              label={t('homeEnergy.count')}
              value={item.count}
              min={1}
              step={1}
              onChange={(count) => update(item.id, { count })}
            />
            <Button
              variant="ghost"
              disabled={items.length === 1}
              onClick={() =>
                setItems((current) =>
                  current.filter(({ id }) => id !== item.id),
                )
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        onClick={() => setItems((current) => [...current, createAppliance()])}
      >
        <Plus className="h-4 w-4" />
        {t('homeEnergy.add')}
      </Button>
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric
          label={t('homeEnergy.energy')}
          value={`${total.toFixed(2)} kWh`}
        />
        <Metric
          label={t('homeEnergy.cost')}
          value={`¥${(total * price).toFixed(2)}`}
        />
      </div>
    </div>
  );
}
