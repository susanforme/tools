import { ChoiceField, Metric, NumberField } from './calculator-ui';
import { PracticalText } from './practical-ui';
import { Button } from './ui/button';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import type {
  calculateFunctions,
  FunctionRequest,
} from '@/lib/function-workbench';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
const createWorker = () =>
  new Worker(new URL('../lib/function-workbench.worker.ts', import.meta.url), {
    type: 'module',
  });
const MODES = [
  'plot',
  'parametric',
  'difference',
  'tangent',
  'derivative',
  'integral',
];
export function FunctionWorkbench() {
  const { t } = useTranslation();
  const label = (key: string) => t(`batch3Calc.${key}`);
  const [q, set] = useQueryParams<{
    mode: string;
    from: number;
    to: number;
    parameter: number;
    at: number;
  }>({
    mode: StringParam,
    from: NumberParam,
    to: NumberParam,
    parameter: NumberParam,
    at: NumberParam,
  });
  const mode = MODES.includes(q.mode ?? '') ? q.mode! : 'plot';
  const from = q.from ?? -5,
    to = q.to ?? 5,
    parameter = q.parameter ?? 1,
    at = q.at ?? 1;
  const [f, setF] = useState('x^2'),
    [g, setG] = useState('x+2');
  const job = useBoundedWorker<
    FunctionRequest,
    ReturnType<typeof calculateFunctions>
  >(createWorker);
  const { clear } = job;
  useEffect(() => clear(), [f, g, mode, from, to, parameter, at, clear]);
  const result = job.result;
  const all = result
    ? [...result.points, ...result.second].filter(
        (p): p is [number, number] => p !== null,
      )
    : [];
  const xs = all.map((p) => p[0]),
    ys = all.map((p) => p[1]).sort((a, b) => a - b);
  const xMin = mode === 'parametric' ? Math.min(...xs) : from,
    xMax = mode === 'parametric' ? Math.max(...xs) : to;
  const yMin = ys[Math.floor(ys.length * 0.02)] ?? -1,
    yMax = ys[Math.floor(ys.length * 0.98)] ?? 1;
  const dx = xMax - xMin || 1,
    dy = yMax - yMin || 1;
  const px = (x: number) => 40 + ((x - xMin) / dx) * 700,
    py = (y: number) => 340 - ((y - yMin) / dy) * 300;
  const path = (points: ([number, number] | null)[]) => {
    let previous: number | null = null;
    return points
      .map((p) => {
        if (!p || p[1] < yMin - dy || p[1] > yMax + dy) {
          previous = null;
          return '';
        }
        const y = py(p[1]),
          command =
            previous === null || Math.abs(y - previous) > 150 ? 'M' : 'L';
        previous = y;
        return `${command}${px(p[0]).toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  };
  return (
    <div className="space-y-4">
      <ChoiceField
        label={label('mode')}
        value={mode}
        options={MODES.map((value) => ({ value, label: label(value) }))}
        onChange={(mode) => set({ mode })}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <PracticalText label={label('f')} value={f} onChange={setF} />
        {['difference', 'parametric'].includes(mode) && (
          <PracticalText label={label('g')} value={g} onChange={setG} />
        )}
      </div>
      <p className="text-xs text-muted-foreground">{label('syntax')}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(['from', 'to', 'parameter', 'at'] as const)
          .filter((key) => key !== 'at' || mode === 'tangent')
          .map((key) => (
            <NumberField
              key={key}
              label={label(key)}
              value={{ from, to, parameter, at }[key]}
              min={-1e6}
              max={1e6}
              onChange={(n) => set({ [key]: n })}
            />
          ))}
      </div>
      <Button
        disabled={job.busy}
        onClick={() => job.run({ mode, f, g, from, to, parameter, at })}
      >
        {label('calculate')}
      </Button>
      {job.busy && (
        <Button variant="outline" onClick={job.cancel}>
          {label('cancel')}
        </Button>
      )}
      {job.error && (
        <p role="alert" className="text-destructive">
          {t('batch3Calc.error', { message: label(job.error) })}
        </p>
      )}
      {result && (
        <>
          <svg
            viewBox="0 0 780 390"
            className="w-full rounded-lg border bg-background"
            role="img"
            aria-label={label('graph')}
          >
            <defs>
              <clipPath id="function-plot">
                <rect x="40" y="20" width="700" height="340" />
              </clipPath>
            </defs>
            <path
              d="M40,20V360H740"
              className="stroke-muted-foreground"
              fill="none"
            />
            <g clipPath="url(#function-plot)">
              <path
                d={`M40,${py(0)}H740M${px(0)},20V360`}
                className="stroke-muted"
                fill="none"
              />
              <path
                d={path(result.points)}
                className="stroke-blue-500"
                strokeWidth="2"
                fill="none"
              />
              <path
                d={path(result.second)}
                className="stroke-orange-500"
                strokeWidth="2"
                fill="none"
              />
              {result.slope !== null && result.value !== null && (
                <path
                  d={`M${px(from)},${py(result.value + result.slope * (from - at))}L${px(to)},${py(result.value + result.slope * (to - at))}`}
                  className="stroke-rose-500"
                  strokeWidth="2"
                  fill="none"
                />
              )}
            </g>
            <text
              x="40"
              y="382"
              className="fill-muted-foreground"
              fontSize="12"
            >
              {xMin.toPrecision(4)}
            </text>
            <text
              x="700"
              y="382"
              className="fill-muted-foreground"
              fontSize="12"
            >
              {xMax.toPrecision(4)}
            </text>
          </svg>
          <p className="text-xs text-muted-foreground">
            {t('batch3Calc.bounds', {
              min: yMin.toPrecision(5),
              max: yMax.toPrecision(5),
            })}
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {(['slope', 'value', 'area'] as const).map(
              (key) =>
                result[key] !== null && (
                  <Metric
                    key={key}
                    label={label(key)}
                    value={result[key].toPrecision(10)}
                  />
                ),
            )}
          </div>
          {mode === 'difference' && (
            <Metric
              label={label('roots')}
              value={
                result.roots.length
                  ? result.roots.map((n) => n.toPrecision(8)).join(', ')
                  : label('noRoots')
              }
            />
          )}
        </>
      )}
    </div>
  );
}
