import { ChoiceField, Metric, NumberField } from '@/components/calculator-ui';
import { ScienceFrame } from '@/components/batch4-science-ui';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { physics } from '@/lib/batch4-science';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/physics-toolbox')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: PhysicsToolbox,
});
type Field = { key: string; value: number; units?: Record<string, number> };
const MASS = { kg: 1, g: 0.001, t: 1000 },
  LENGTH = { m: 1, cm: 0.01, mm: 0.001 },
  SPEED = { 'm/s': 1, 'km/h': 1 / 3.6 };
const MODES: Record<string, Field[]> = {
  motion: [
    { key: 'initialVelocity', value: 0, units: SPEED },
    { key: 'acceleration', value: 9.81 },
    { key: 'time', value: 2 },
  ],
  force: [
    { key: 'bodyMass', value: 10, units: MASS },
    { key: 'acceleration', value: 2 },
  ],
  work: [
    { key: 'forceInput', value: 10 },
    { key: 'distanceInput', value: 5, units: LENGTH },
    { key: 'angleInput', value: 0 },
  ],
  kinetic: [
    { key: 'bodyMass', value: 2, units: MASS },
    { key: 'velocityInput', value: 3, units: SPEED },
  ],
  potential: [
    { key: 'bodyMass', value: 2, units: MASS },
    { key: 'height', value: 10, units: LENGTH },
    { key: 'gravity', value: 9.81 },
  ],
  heat: [
    { key: 'bodyMass', value: 1, units: MASS },
    { key: 'specificHeat', value: 4184 },
    { key: 'temperatureChange', value: 20 },
  ],
  gas: [
    { key: 'amount', value: 1 },
    { key: 'temperature', value: 273.15 },
    {
      key: 'gasVolume',
      value: 0.022414,
      units: { 'm³': 1, L: 0.001, mL: 0.000001 },
    },
  ],
  lens: [
    { key: 'focalDistance', value: 0.1, units: LENGTH },
    { key: 'objectDistance', value: 0.3, units: LENGTH },
  ],
};
function PhysicsToolbox() {
  const { t } = useTranslation();
  const label = (key: string) => t(`batch4Science.${key}`);
  const [q, set] = useQueryParams<{
    mode: string;
    a: number;
    b: number;
    c: number;
    ua: string;
    ub: string;
    uc: string;
  }>({
    mode: StringParam,
    a: NumberParam,
    b: NumberParam,
    c: NumberParam,
    ua: StringParam,
    ub: StringParam,
    uc: StringParam,
  });
  const mode = Object.hasOwn(MODES, q.mode ?? '') ? q.mode! : 'motion';
  const fields = MODES[mode];
  const keys = ['a', 'b', 'c'] as const;
  const value = (i: number) => q[keys[i]] ?? fields[i].value;
  const unit = (i: number) => {
    const units = fields[i].units;
    return units && Object.hasOwn(units, q[`u${keys[i]}`] ?? '')
      ? q[`u${keys[i]}`]!
      : (Object.keys(units ?? {})[0] ?? '');
  };
  let result: Record<string, number> | null = null,
    error: string | null = null;
  try {
    result = physics(
      mode,
      fields.map((field, i) => value(i) * (field.units?.[unit(i)] ?? 1)),
    );
  } catch (cause) {
    error = (cause as Error).message;
  }
  return (
    <ScienceFrame tool="physics" error={error}>
      <ChoiceField
        label={label('mode')}
        value={mode}
        options={Object.keys(MODES).map((value) => ({
          value,
          label: label(value),
        }))}
        onChange={(mode) =>
          set({
            mode,
            a: undefined,
            b: undefined,
            c: undefined,
            ua: undefined,
            ub: undefined,
            uc: undefined,
          })
        }
      />
      <div className="grid gap-3 md:grid-cols-3">
        {fields.map((field, i) => (
          <div key={field.key} className="space-y-2">
            <NumberField
              label={label(field.key)}
              value={value(i)}
              min={-1e12}
              max={1e12}
              onChange={(n) => set({ [keys[i]]: n })}
            />
            {field.units && (
              <ChoiceField
                label={label('unit')}
                value={unit(i)}
                options={Object.keys(field.units).map((value) => ({
                  value,
                  label: value,
                }))}
                onChange={(value) => set({ [`u${keys[i]}`]: value })}
              />
            )}
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{label('physicsHint')}</p>
      {result && (
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(result).map(([key, value]) => (
            <Metric
              key={key}
              label={label(
                ['force', 'work', 'heat'].includes(key) ? `${key}Result` : key,
              )}
              value={value.toPrecision(9)}
            />
          ))}
        </div>
      )}
    </ScienceFrame>
  );
}
