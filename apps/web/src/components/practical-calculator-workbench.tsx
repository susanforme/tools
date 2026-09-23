import { Metric, NumberField } from '@/components/calculator-ui';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import {
  CALCULATOR_FIELDS,
  BUSINESS_MODES,
  HOME_MODES,
  STUDY_MODES,
  calculateWorkbench,
  type CalculatorMode,
} from '@/lib/practical-workbenches';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Group = 'home' | 'business' | 'study';
const GROUP_MODES = {
  home: HOME_MODES,
  business: BUSINESS_MODES,
  study: STUDY_MODES,
};

function defaults(mode: CalculatorMode): Record<string, number> {
  return Object.fromEntries(
    CALCULATOR_FIELDS[mode].map(({ id, initial }) => [id, initial]),
  );
}

export function PracticalCalculatorWorkbench({ group }: { group: Group }) {
  const { t, i18n } = useTranslation();
  const modes: readonly CalculatorMode[] = GROUP_MODES[group];
  const [queryMode, setMode] = useQueryParam<CalculatorMode>(
    'tool',
    StringParam,
    modes[0],
  );
  const mode = modes.includes(queryMode) ? queryMode : modes[0];
  const [stored, setStored] = useState<Record<string, Record<string, number>>>(
    {},
  );
  const values = stored[mode] ?? defaults(mode);
  let output: ReturnType<typeof calculateWorkbench> = [];
  let error: string | null = null;
  try {
    output = calculateWorkbench(mode, values);
  } catch (cause) {
    error = (cause as Error).message;
  }
  const exportResult = () => {
    if (error) return;
    const text = [
      t(`practicalWorkbenches.modes.${mode}`),
      ...CALCULATOR_FIELDS[mode].map(
        ({ id }) => `${t(`practicalWorkbenches.fields.${id}`)}: ${values[id]}`,
      ),
      ...output.map(
        ({ id, value, unit }) =>
          `${t(`practicalWorkbenches.results.${id}`)}: ${value.toFixed(2)} ${unit}`,
      ),
    ].join('\n');
    downloadBlob(
      new Blob([text], { type: 'text/plain;charset=utf-8' }),
      `${mode}.txt`,
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t(`practicalWorkbenches.groups.${group}.title`)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(`practicalWorkbenches.groups.${group}.description`)}
        </p>
      </div>
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as CalculatorMode)}
      >
        <TabsList className="h-auto flex-wrap">
          {modes.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`practicalWorkbenches.modes.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CALCULATOR_FIELDS[mode].map(({ id, min, max }) => (
          <NumberField
            key={`${mode}-${id}`}
            label={t(`practicalWorkbenches.fields.${id}`)}
            value={values[id]}
            min={min}
            max={max}
            onChange={(value) =>
              setStored((current) => ({
                ...current,
                [mode]: { ...values, [id]: value },
              }))
            }
          />
        ))}
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {t(`practicalWorkbenches.errors.${error}`, {
            defaultValue: t('practicalWorkbenches.errors.invalid'),
          })}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {output.map(({ id, value, unit }) => (
            <Metric
              key={id}
              label={t(`practicalWorkbenches.results.${id}`)}
              value={`${value.toLocaleString(i18n.language, { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`}
            />
          ))}
        </div>
      )}
      {mode === 'finalTarget' && !error && output[1]?.value > 100 && (
        <p role="status" className="text-sm text-destructive">
          {t('practicalWorkbenches.unreachable')}
        </p>
      )}
      <Button variant="outline" disabled={!!error} onClick={exportResult}>
        <Download className="h-4 w-4" />
        {t('practicalWorkbenches.export')}
      </Button>
      <p className="text-xs text-muted-foreground">
        {t(`practicalWorkbenches.notes.${mode}`)}
      </p>
    </div>
  );
}
