import { ScienceFrame } from '@/components/science-workspace-ui';
import { ChoiceField, Metric, NumberField } from '@/components/calculator-ui';
import { PracticalText } from '@/components/practical-ui';
import { Button } from '@/components/ui/button';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  balanceEquation,
  molarMass,
  solutionCalculation,
} from '@/lib/chemistry-calculations';
import { ELEMENTS } from '@/lib/chemistry-elements';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/chemistry-toolbox')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: Chemistry,
});
const worker = () =>
  new Worker(
    new URL('../workers/chemistry-calculations.worker.ts', import.meta.url),
    { type: 'module' },
  );
const MODES = ['elements', 'formula', 'balance', 'solution', 'dilution'];
function Chemistry() {
  const { t, i18n } = useTranslation();
  const label = (key: string) => t(`scienceTools.${key}`);
  const [q, set] = useQueryParams<{
    mode: string;
    a: number;
    b: number;
    c: number;
  }>({ mode: StringParam, a: NumberParam, b: NumberParam, c: NumberParam });
  const mode = MODES.includes(q.mode ?? '') ? q.mode! : 'elements';
  const [search, setSearch] = useState(''),
    [formula, setFormula] = useState('Ca(OH)2'),
    [equation, setEquation] = useState('Fe + O2 = Fe2O3');
  const job = useBoundedWorker<string, ReturnType<typeof balanceEquation>>(
    worker,
    5000,
  );
  useEffect(() => job.clear(), [equation, mode, job.clear]);
  let mass: ReturnType<typeof molarMass> | null = null,
    solution: ReturnType<typeof solutionCalculation> | null = null,
    error: string | null = null;
  const values = [
    q.a ?? (mode === 'dilution' ? 2 : 5.844),
    q.b ?? (mode === 'dilution' ? 100 : 58.44),
    q.c ?? (mode === 'dilution' ? 0.5 : 1000),
  ];
  try {
    if (mode === 'formula') mass = molarMass(formula);
    if (mode === 'solution' || mode === 'dilution')
      solution = solutionCalculation(mode, values[0], values[1], values[2]);
  } catch (cause) {
    error = (cause as Error).message;
  }
  const filtered = ELEMENTS.filter(
    (e) =>
      !search ||
      `${e.number} ${e.symbol} ${e.name} ${e.zh}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <ScienceFrame tool="chemistry" error={error ?? job.error}>
      <ChoiceField
        label={label('mode')}
        value={mode}
        options={MODES.map((value) => ({ value, label: label(value) }))}
        onChange={(mode) =>
          set({ mode, a: undefined, b: undefined, c: undefined })
        }
      />
      {mode === 'elements' ? (
        <>
          <PracticalText
            label={label('search')}
            value={search}
            onChange={setSearch}
          />
          <p className="text-sm text-muted-foreground">
            {label('weightsSource')}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {filtered.map((e) => (
              <div key={e.symbol} className="space-y-1 rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{e.number}</div>
                <div className="text-2xl font-bold text-emerald-500">
                  {e.symbol}
                </div>
                <div>{i18n.language.startsWith('zh') ? e.zh : e.name}</div>
                <div className="text-sm">{e.mass ?? '—'}</div>
                <div className="break-all text-xs text-muted-foreground">
                  {e.configuration}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : mode === 'formula' ? (
        <>
          <PracticalText
            label={label('formulaLabel')}
            value={formula}
            onChange={setFormula}
          />
          <p className="text-sm text-muted-foreground">
            {label('formulaHint')}
          </p>
          {mass && (
            <>
              <Metric label={label('mass')} value={mass.mass.toFixed(5)} />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {['symbol', 'atoms', 'percent'].map((key) => (
                        <th className="p-2" key={key}>
                          {label(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mass.parts.map((p) => (
                      <tr key={p.symbol}>
                        <td className="p-2">{p.symbol}</td>
                        <td className="p-2">{p.count}</td>
                        <td className="p-2">{p.percent.toFixed(3)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : mode === 'balance' ? (
        <>
          <PracticalText
            label={label('equation')}
            value={equation}
            onChange={setEquation}
          />
          <p className="text-sm text-muted-foreground">
            {label('formulaHint')}
          </p>
          <div className="flex gap-2">
            <Button disabled={job.busy} onClick={() => job.run(equation)}>
              {label('calculate')}
            </Button>
            {job.busy && (
              <Button variant="outline" onClick={job.cancel}>
                {label('cancel')}
              </Button>
            )}
          </div>
          {job.result && (
            <div className="break-words rounded-lg border p-4 font-mono text-lg">
              {job.result.equation}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {(mode === 'dilution'
              ? ['concentration', 'stockVolume', 'targetConcentration']
              : ['massInput', 'molarMass', 'volumeInput']
            ).map((key, i) => (
              <NumberField
                key={key}
                label={label(key)}
                value={values[i]}
                min={0}
                max={1e9}
                onChange={(n) => set({ [['a', 'b', 'c'][i]]: n })}
              />
            ))}
          </div>
          {solution && (
            <div className="grid gap-3 md:grid-cols-3">
              {Object.entries(solution).map(([key, value]) => (
                <Metric
                  key={key}
                  label={label(key)}
                  value={value.toPrecision(8)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </ScienceFrame>
  );
}
