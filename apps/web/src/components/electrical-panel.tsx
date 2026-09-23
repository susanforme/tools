import { ChoiceField, Metric, NumberField } from './calculator-ui';
import { PracticalText } from './practical-ui';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { electrical } from '@/lib/electrical-baking';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
const MODES = ['ohm', 'network', 'divider', 'led', 'rc'];
export function ElectricalPanel() {
  const { t } = useTranslation();
  const label = (key: string) => t(`batch3Calc.${key}`);
  const [q, set] = useQueryParams<{
    circuit: string;
    a: number;
    b: number;
    c: number;
    network: string;
  }>({
    circuit: StringParam,
    a: NumberParam,
    b: NumberParam,
    c: NumberParam,
    network: StringParam,
  });
  const mode = MODES.includes(q.circuit ?? '') ? q.circuit! : 'ohm';
  const a = q.a ?? 12,
    b = q.b ?? (mode === 'led' ? 2 : 1000),
    c = q.c ?? (mode === 'led' ? 20 : 2000),
    network = q.network === 'parallel' ? 'parallel' : 'series';
  const [resistors, setResistors] = useState('100, 200, 300');
  let result: ReturnType<typeof electrical> | null = null,
    error: string | null = null;
  try {
    result = electrical(
      mode,
      mode === 'network'
        ? resistors
            .trim()
            .split(/[\s,，]+/)
            .slice(0, 101)
            .map(Number)
        : mode === 'divider' || mode === 'led'
          ? [a, b, c]
          : [a, b],
      network,
    );
  } catch (cause) {
    error = label(
      (cause as Error).message === 'voltage' ? 'voltageError' : 'invalid',
    );
  }
  const fields =
    mode === 'ohm'
      ? ['voltage', 'resistance']
      : mode === 'divider'
        ? ['supply', 'r1', 'r2']
        : mode === 'led'
          ? ['supply', 'forward', 'milliamps']
          : ['resistance', 'capacitance'];
  return (
    <section className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{label('electrical')}</h1>
      <ChoiceField
        label={label('mode')}
        value={mode}
        options={MODES.map((value) => ({ value, label: label(value) }))}
        onChange={(circuit) =>
          set({ circuit, a: undefined, b: undefined, c: undefined })
        }
      />
      {mode === 'network' ? (
        <>
          <ChoiceField
            label={label('network')}
            value={network}
            options={['series', 'parallel'].map((value) => ({
              value,
              label: label(value),
            }))}
            onChange={(network) => set({ network })}
          />
          <PracticalText
            label={label('resistances')}
            value={resistors}
            onChange={setResistors}
          />
        </>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {fields.map((field, i) => (
            <NumberField
              key={field}
              label={label(field)}
              value={[a, b, c][i]}
              min={
                i === 0 && (mode === 'ohm' || mode === 'divider') ? -1e12 : 0
              }
              max={1e12}
              onChange={(n) => set({ [['a', 'b', 'c'][i]]: n })}
            />
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {result && (
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(result)
            .filter(
              (entry): entry is [string, number] =>
                typeof entry[1] === 'number',
            )
            .map(([key, value]) => (
              <Metric
                key={key}
                label={label(key)}
                value={value.toPrecision(7)}
              />
            ))}
        </div>
      )}
    </section>
  );
}
