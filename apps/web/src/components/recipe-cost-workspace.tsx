import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberParam, useQueryParams } from '@/hooks/useQueryParams';
import { recipeCost, type CostIngredient } from '@/lib/life-workspace-data';
import { OrganizerInput } from './organizer-store';
import { Button } from './ui/button';
import { LifeError, LifePrint } from './life-workspace-ui';
export function RecipeCostPanel() {
  const { t } = useTranslation();
  const tr = (k: string) => t(`lifeWorkspace.${k}`);
  const [q, setQ] = useQueryParams<{
    yield: number;
    packaging: number;
    overhead: number;
    margin: number;
  }>({
    yield: NumberParam,
    packaging: NumberParam,
    overhead: NumberParam,
    margin: NumberParam,
  });
  const [rows, setRows] = useState<CostIngredient[]>([
    { id: '1', name: '', used: 100, packageAmount: 1000, price: 10, loss: 0 },
  ]);
  const yieldCount = q.yield ?? 10,
    packaging = q.packaging ?? 0,
    overhead = q.overhead ?? 0,
    margin = q.margin ?? 30;
  let result: ReturnType<typeof recipeCost> | null = null;
  try {
    result = recipeCost(rows, yieldCount, packaging, overhead, margin);
  } catch {}
  const update = (id: string, changes: Partial<CostIngredient>) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{tr('cost.title')}</h1>
      <p className="text-sm text-muted-foreground">{tr('cost.hint')}</p>
      {rows.map((r, i) => (
        <div
          key={r.id}
          className="grid items-end gap-3 rounded border p-3 md:grid-cols-7"
        >
          <OrganizerInput
            label={tr('name')}
            value={r.name}
            maxLength={120}
            onChange={(e) => update(r.id, { name: e.target.value })}
          />
          {(['used', 'packageAmount', 'price', 'loss'] as const).map((k) => (
            <OrganizerInput
              key={k}
              label={tr(`cost.${k}`)}
              type="number"
              min={k === 'packageAmount' ? 0.000001 : 0}
              max={k === 'loss' ? 99.9 : 1e9}
              step="any"
              value={r[k]}
              onChange={(e) => update(r.id, { [k]: Number(e.target.value) })}
            />
          ))}
          <p>
            {tr('cost.subtotal')}: {result?.ingredients[i].toFixed(2) ?? '—'}
          </p>
          <Button
            variant="ghost"
            disabled={rows.length === 1}
            onClick={() => setRows(rows.filter((x) => x.id !== r.id))}
          >
            {tr('delete')}
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        disabled={rows.length >= 100}
        onClick={() =>
          setRows([
            ...rows,
            {
              id: crypto.randomUUID(),
              name: '',
              used: 100,
              packageAmount: 1000,
              price: 10,
              loss: 0,
            },
          ])
        }
      >
        {tr('add')}
      </Button>
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ['yield', yieldCount],
          ['packaging', packaging],
          ['overhead', overhead],
          ['margin', margin],
        ].map(([k, v]) => (
          <OrganizerInput
            key={k}
            label={tr(`cost.${k}`)}
            type="number"
            min={k === 'yield' ? 0.001 : 0}
            max={k === 'margin' ? 99.9 : 1e9}
            step="any"
            value={v}
            onChange={(e) => setQ({ [k]: Number(e.target.value) })}
          />
        ))}
      </div>
      {result ? (
        <>
          <div className="grid gap-3 rounded border p-4 md:grid-cols-3">
            <p>
              {tr('cost.total')}: {result.total.toFixed(2)}
            </p>
            <p>
              {tr('cost.unit')}: {result.unit.toFixed(2)}
            </p>
            <p>
              {tr('cost.selling')}: {result.price.toFixed(2)}
            </p>
          </div>
          <LifePrint
            title={tr('cost.title')}
            filename="recipe-cost.pdf"
            lines={[
              ...rows.map(
                (r, i) =>
                  `${r.name}: ${r.used} / ${r.packageAmount} · ${r.price} · ${r.loss}% → ${result.ingredients[i].toFixed(2)}`,
              ),
              `${tr('cost.yield')}: ${yieldCount}`,
              `${tr('cost.total')}: ${result.total.toFixed(2)}; ${tr('cost.unit')}: ${result.unit.toFixed(2)}; ${tr('cost.selling')}: ${result.price.toFixed(2)}`,
            ]}
          />
        </>
      ) : (
        <LifeError error="costInvalid" />
      )}
    </div>
  );
}
