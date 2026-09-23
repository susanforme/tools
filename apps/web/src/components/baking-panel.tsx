import { ChoiceField, Metric, NumberField } from './calculator-ui';
import { PracticalText, ExportText } from './practical-ui';
import { Button } from './ui/button';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  recipeBatch,
  moldVolume,
  type Ingredient,
} from '@/lib/electrical-baking';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
export function BakingPanel({ mode }: { mode: string }) {
  const { t } = useTranslation();
  const label = (key: string) => t(`batch3Calc.${key}`);
  const [q, set] = useQueryParams<{
    factor: number;
    shape1: string;
    shape2: string;
    width1: number;
    width2: number;
    height1: number;
    height2: number;
    length1: number;
    length2: number;
  }>({
    factor: NumberParam,
    shape1: StringParam,
    shape2: StringParam,
    width1: NumberParam,
    width2: NumberParam,
    height1: NumberParam,
    height2: NumberParam,
    length1: NumberParam,
    length2: NumberParam,
  });
  const [rows, setRows] = useState<Ingredient[]>([
    { name: label('flour'), grams: 500, kind: 'flour' },
    { name: label('water'), grams: 350, kind: 'water' },
  ]);
  const factor = q.factor ?? 1.5;
  let result: ReturnType<typeof recipeBatch> | null = null,
    volumes: number[] | null = null,
    error: string | null = null;
  try {
    if (mode === 'mold') {
      volumes = [1, 2].map((n) => {
        const i = n as 1 | 2;
        return moldVolume(
          q[`shape${i}`] ?? 'round',
          q[`width${i}`] ?? (i === 1 ? 15 : 20),
          q[`height${i}`] ?? 5,
          q[`length${i}`] ?? 20,
        );
      });
    } else result = recipeBatch(rows, factor);
  } catch {
    error = label('invalid');
  }
  const update = (index: number, value: Partial<Ingredient>) =>
    setRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, ...value } : r)),
    );
  return (
    <div className="space-y-4">
      {mode === 'mold' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {([1, 2] as const).map((i) => (
              <fieldset key={i} className="space-y-3 rounded-lg border p-4">
                <legend>{label(i === 1 ? 'moldFrom' : 'moldTo')}</legend>
                <ChoiceField
                  label={label('shape')}
                  value={q[`shape${i}`] ?? 'round'}
                  options={['round', 'rectangle'].map((value) => ({
                    value,
                    label: label(value),
                  }))}
                  onChange={(n) => set({ [`shape${i}`]: n })}
                />
                {(['width', 'height', 'length'] as const)
                  .filter(
                    (k) => k !== 'length' || q[`shape${i}`] === 'rectangle',
                  )
                  .map((k) => (
                    <NumberField
                      key={k}
                      label={label(k)}
                      value={
                        q[`${k}${i}`] ??
                        (k === 'height'
                          ? 5
                          : k === 'width' && i === 1
                            ? 15
                            : 20)
                      }
                      onChange={(n) => set({ [`${k}${i}`]: n })}
                    />
                  ))}
              </fieldset>
            ))}
          </div>
          {volumes && (
            <Metric
              label={label('factor')}
              value={(volumes[1] / volumes[0]).toFixed(5)}
            />
          )}
        </>
      ) : (
        <>
          <NumberField
            label={label('factor')}
            value={factor}
            min={0.001}
            max={1e6}
            onChange={(factor) => set({ factor })}
          />
          <div className="space-y-3">
            {rows.map((row, i) => (
              <div
                key={i}
                className="grid gap-3 rounded-lg border p-3 md:grid-cols-4"
              >
                <PracticalText
                  label={label('ingredient')}
                  value={row.name}
                  onChange={(name) => update(i, { name })}
                />
                <NumberField
                  label={label('grams')}
                  value={row.grams}
                  max={1e9}
                  onChange={(grams) => update(i, { grams })}
                />
                <ChoiceField
                  label={label('kind')}
                  value={row.kind}
                  options={['flour', 'water', 'other'].map((value) => ({
                    value,
                    label: label(value),
                  }))}
                  onChange={(kind) =>
                    update(i, { kind: kind as Ingredient['kind'] })
                  }
                />
                <Button
                  variant="outline"
                  className="self-end"
                  disabled={rows.length <= 1}
                  onClick={() => setRows(rows.filter((_, n) => n !== i))}
                >
                  {label('remove')}
                </Button>
              </div>
            ))}
          </div>
          <Button
            disabled={rows.length >= 100}
            variant="outline"
            onClick={() =>
              setRows([...rows, { name: '', grams: 0, kind: 'other' }])
            }
          >
            {label('add')}
          </Button>
          {result && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {['ingredient', 'scaled', 'percent'].map((key) => (
                        <th key={key} className="p-2">
                          {label(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i}>
                        <td className="p-2">{row.name}</td>
                        <td className="p-2">{row.scaled.toFixed(2)}</td>
                        <td className="p-2">
                          {row.percent === null
                            ? '—'
                            : `${row.percent.toFixed(2)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Metric
                  label={label('total')}
                  value={result.total.toFixed(2)}
                />
                <Metric
                  label={label('hydration')}
                  value={
                    result.hydration === null
                      ? '—'
                      : `${result.hydration.toFixed(2)}%`
                  }
                />
              </div>
              {result.hydration === null && (
                <p className="text-sm text-muted-foreground">
                  {label('noFlour')}
                </p>
              )}
              <ExportText
                value={JSON.stringify(result, null, 2)}
                name="recipe.json"
                type="application/json"
              />
            </>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
