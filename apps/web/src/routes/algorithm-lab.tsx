import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnalysisFrame } from '@/components/analysis-tool-ui';
import { ChoiceField, NumberField } from '@/components/calculator-ui';
import { PracticalText, ExportText } from '@/components/practical-ui';
import { Button } from '@/components/ui/button';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  binaryTrace,
  parseAlgorithmNumbers,
  pathTrace,
  sortTrace,
} from '@/lib/analysis-algorithms';
export const Route = createFileRoute('/algorithm-lab')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: AlgorithmLab,
});
const SORTS = ['bubble', 'insertion', 'selection'];
function AlgorithmLab() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    mode: string;
    algorithm: string;
    speed: number;
  }>({ mode: StringParam, algorithm: StringParam, speed: NumberParam });
  const mode = ['sort', 'binary', 'path'].includes(query.mode ?? '')
    ? query.mode!
    : 'sort';
  const choices = mode === 'path' ? ['bfs', 'dijkstra'] : SORTS;
  const algorithm = choices.includes(query.algorithm ?? '')
    ? query.algorithm!
    : choices[0];
  const speed = Math.max(50, Math.min(2000, query.speed ?? 350));
  const [source, setSource] = useState('8, 3, 6, 2, 9, 1, 5, 4');
  const [target, setTarget] = useState(5);
  const [grid, setGrid] = useState(() => Array<number>(64).fill(1));
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const calculation = useMemo(() => {
    try {
      const input = mode === 'path' ? [] : parseAlgorithmNumbers(source);
      const frames =
        mode === 'path'
          ? pathTrace(grid, 8, algorithm)
          : mode === 'binary'
            ? binaryTrace(input, target)
            : sortTrace(input, algorithm);
      const comparison =
        mode === 'sort'
          ? SORTS.map((name) => ({
              name,
              result: sortTrace(input, name).at(-1)!,
            }))
          : mode === 'path'
            ? ['bfs', 'dijkstra'].map((name) => ({
                name,
                result: pathTrace(grid, 8, name).at(-1)!,
              }))
            : [];
      return { frames, comparison, error: null };
    } catch (cause) {
      return { frames: [], comparison: [], error: (cause as Error).message };
    }
  }, [mode, source, grid, algorithm, target]);
  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [calculation]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setStep((current) => {
          if (current >= calculation.frames.length - 1) {
            setPlaying(false);
            return current;
          }
          return current + 1;
        }),
      speed,
    );
    return () => clearInterval(timer);
  }, [playing, speed, calculation.frames.length]);
  const current =
    calculation.frames[Math.min(step, calculation.frames.length - 1)];
  const done = step >= calculation.frames.length - 1;
  return (
    <AnalysisFrame tool="algorithms" error={calculation.error}>
      <div className="grid gap-4 md:grid-cols-3">
        <ChoiceField
          label={t('analysisTools.mode')}
          value={mode}
          options={['sort', 'binary', 'path'].map((value) => ({
            value,
            label: t(`analysisTools.algorithms.${value}`),
          }))}
          onChange={(mode) => setQuery({ mode, algorithm: undefined })}
        />
        {mode !== 'binary' && (
          <ChoiceField
            label={t('analysisTools.algorithms.algorithm')}
            value={algorithm}
            options={choices.map((value) => ({
              value,
              label: t(`analysisTools.algorithms.${value}`),
            }))}
            onChange={(algorithm) => setQuery({ algorithm })}
          />
        )}
        <NumberField
          label={t('analysisTools.algorithms.speed')}
          value={speed}
          min={50}
          max={2000}
          step={50}
          onChange={(speed) => setQuery({ speed })}
        />
      </div>
      {mode !== 'path' ? (
        <>
          <PracticalText
            label={t(
              mode === 'binary'
                ? 'analysisTools.algorithms.sorted'
                : 'analysisTools.algorithms.numbers',
            )}
            value={source}
            onChange={setSource}
            maxLength={1000}
          />
          {mode === 'binary' && (
            <NumberField
              label={t('analysisTools.algorithms.target')}
              value={target}
              min={-1000000}
              max={1000000}
              onChange={setTarget}
            />
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t('analysisTools.algorithms.gridHint')}
        </p>
      )}
      {current && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                if (done) setStep(0);
                setPlaying(!playing);
              }}
            >
              {t(playing ? 'analysisTools.pause' : 'analysisTools.play')}
            </Button>
            <Button
              variant="outline"
              disabled={step === 0}
              onClick={() => {
                setPlaying(false);
                setStep(Math.max(0, step - 1));
              }}
            >
              {t('analysisTools.previous')}
            </Button>
            <Button
              variant="outline"
              disabled={done}
              onClick={() => {
                setPlaying(false);
                setStep(step + 1);
              }}
            >
              {t('analysisTools.next')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPlaying(false);
                setStep(0);
              }}
            >
              {t('analysisTools.reset')}
            </Button>
            <span className="text-sm tabular-nums">
              {Math.min(step + 1, calculation.frames.length)} /{' '}
              {calculation.frames.length}
            </span>
          </div>
          {mode === 'path' ? (
            <div className="grid max-w-lg grid-cols-8 gap-1">
              {grid.map((cost, index) => (
                <Button
                  variant="outline"
                  key={index}
                  className={`aspect-square h-auto min-w-0 p-0 ${current.path.includes(index) ? 'bg-emerald-500 text-white' : current.active.includes(index) ? 'bg-orange-500 text-white' : cost === 0 ? 'bg-slate-700 text-white' : current.visited.includes(index) ? 'bg-blue-200 text-slate-900' : cost > 1 ? 'bg-amber-100 text-slate-900' : ''}`}
                  aria-label={`${t('analysisTools.algorithms.cell')} ${Math.floor(index / 8) + 1}, ${(index % 8) + 1}: ${cost}`}
                  disabled={index === 0 || index === 63}
                  onClick={() =>
                    setGrid((old) =>
                      old.map((value, i) =>
                        i === index
                          ? value === 1
                            ? 0
                            : value === 0
                              ? 5
                              : 1
                          : value,
                      ),
                    )
                  }
                >
                  {index === 0
                    ? 'S'
                    : index === 63
                      ? 'G'
                      : cost === 0
                        ? '×'
                        : cost}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 rounded border p-4">
              {current.values.map((value, index) => (
                <div
                  key={index}
                  className={`min-w-12 rounded border p-3 text-center ${current.found === index ? 'bg-emerald-500 text-white' : current.active.includes(index) ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                >
                  <div className="text-xs opacity-70">{index}</div>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          )}
          <p role="status" className="text-sm">
            {t('analysisTools.algorithms.comparisons')}: {current.comparisons} ·{' '}
            {t('analysisTools.algorithms.writes')}: {current.writes}
            {done &&
              mode !== 'sort' &&
              ` · ${current.found === null ? t('analysisTools.algorithms.notFound') : mode === 'binary' ? `${t('analysisTools.algorithms.index')}: ${current.found}` : `${t('analysisTools.algorithms.cost')}: ${current.cost}`}`}
          </p>
          {calculation.comparison.length > 0 && (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left">
                      {t('analysisTools.algorithms.algorithm')}
                    </th>
                    <th>{t('analysisTools.algorithms.comparisons')}</th>
                    <th>
                      {t(
                        mode === 'path'
                          ? 'analysisTools.algorithms.cost'
                          : 'analysisTools.algorithms.writes',
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {calculation.comparison.map(({ name, result }) => (
                    <tr key={name} className="border-t">
                      <td className="p-2">
                        {t(`analysisTools.algorithms.${name}`)}
                      </td>
                      <td className="text-center">{result.comparisons}</td>
                      <td className="text-center">
                        {mode === 'path' ? (result.cost ?? '—') : result.writes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mode === 'path' && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('analysisTools.algorithms.pathMetric')}
                </p>
              )}
            </div>
          )}
          <ExportText
            value={JSON.stringify(calculation.frames, null, 2)}
            name="algorithm-trace.json"
            type="application/json"
          />
        </>
      )}
    </AnalysisFrame>
  );
}
