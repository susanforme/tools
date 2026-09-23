import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import type {
  StatisticsRequest,
  StatisticsResult,
} from '@/lib/statistical-tests';
import { downloadBlob } from '@/lib/download';
import { ChoiceField, NumberField, Metric } from './calculator-ui';
import { PracticalText } from './practical-ui';
import { ScienceResultFrame } from './science-result-frame';
import { Button } from './ui/button';
const worker = () =>
  new Worker(
    new URL('../workers/statistical-tests.worker.ts', import.meta.url),
    { type: 'module' },
  );
const EXAMPLES: Record<string, string> = {
  welch: '12, 15, 14, 10, 13\n16, 18, 17, 14, 20',
  paired: '10, 12, 14, 11, 15\n12, 15, 14, 13, 18',
  one: '8, 9, 10, 11, 12',
  chi: '30, 20\n10, 40',
  anova: '10, 12, 11, 13\n14, 15, 16, 14\n18, 20, 19, 17',
  regression: '1, 2\n2, 3.8\n3, 6.2\n4, 7.9\n5, 10.3',
};
export default function StatisticalTests() {
  const { t } = useTranslation(),
    l = (key: string) => t(`scienceExpansion.${key}`),
    s = (key: string) => l(`stats.${key}`);
  const [q, set] = useQueryParams<{
    test: string;
    mu: number;
    confidence: number;
  }>({ test: StringParam, mu: NumberParam, confidence: NumberParam });
  const mode = Object.hasOwn(EXAMPLES, q.test ?? '') ? q.test! : 'welch',
    mu = q.mu ?? 0,
    confidence = q.confidence ?? 0.95;
  const [text, setText] = useState(EXAMPLES[mode]);
  const job = useBoundedWorker<StatisticsRequest, StatisticsResult>(
    worker,
    10000,
  );
  useEffect(() => job.clear(), [text, mode, mu, confidence, job.clear]);
  const result = job.result,
    points = result?.residuals;
  const minX = points ? Math.min(...points.map((p) => p.fitted)) : 0,
    maxX = points ? Math.max(...points.map((p) => p.fitted)) : 1,
    maxY = points
      ? Math.max(1e-9, ...points.map((p) => Math.abs(p.residual)))
      : 1;
  return (
    <ScienceResultFrame title="stats.title" error={job.error}>
      <div className="grid gap-3 md:grid-cols-3">
        <ChoiceField
          label={l('mode')}
          value={mode}
          options={Object.keys(EXAMPLES).map((value) => ({
            value,
            label: s(value),
          }))}
          onChange={(test) => {
            set({ test });
            setText(EXAMPLES[test]);
          }}
        />
        <ChoiceField
          label={s('confidence')}
          value={String(confidence)}
          options={[0.9, 0.95, 0.99].map((n) => ({
            value: String(n),
            label: `${n * 100}%`,
          }))}
          onChange={(n) => set({ confidence: +n })}
        />
        {['one', 'paired'].includes(mode) && (
          <NumberField
            label={s('mu')}
            value={mu}
            min={-1e9}
            max={1e9}
            onChange={(mu) => set({ mu })}
          />
        )}
      </div>
      <PracticalText
        label={s('input')}
        value={text}
        onChange={setText}
        multiline
        maxLength={100000}
      />
      <p className="text-sm text-muted-foreground">
        {s(
          mode === 'chi'
            ? 'matrixHint'
            : mode === 'regression'
              ? 'xyHint'
              : 'vectorHint',
        )}
      </p>
      {mode !== 'chi' && (
        <p className="text-sm text-muted-foreground">
          {s(
            mode === 'anova'
              ? 'assumptionAnova'
              : mode === 'regression'
                ? 'assumptionRegression'
                : 'assumptionT',
          )}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          disabled={job.busy}
          onClick={() => job.run({ mode, text, mu, confidence })}
        >
          {l('run')}
        </Button>
        {job.busy && (
          <Button variant="outline" onClick={job.cancel}>
            {l('cancel')}
          </Button>
        )}
      </div>
      {result && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {Object.entries(result.metrics).map(([key, value]) => (
              <Metric
                key={key}
                label={s(key === 'chi' ? 'chiValue' : key)}
                value={
                  key === 'p' && value < 1e-12
                    ? '< 1e-12'
                    : value.toPrecision(7)
                }
              />
            ))}
          </div>
          {result.smallExpected && (
            <p role="status" className="text-sm text-amber-600">
              {s('smallExpected')}
            </p>
          )}
          {result.expected && (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <caption>{s('expected')}</caption>
                <tbody>
                  {result.expected.map((row, i) => (
                    <tr key={i}>
                      {row.map((v, j) => (
                        <td key={j} className="border p-2">
                          {v.toFixed(3)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {points && (
            <>
              <h2 className="font-semibold">{s('residuals')}</h2>
              <svg
                role="img"
                aria-label={s('residuals')}
                viewBox="0 0 700 280"
                className="w-full rounded border bg-white"
              >
                <line x1="45" y1="140" x2="680" y2="140" stroke="#94a3b8" />
                <line x1="45" y1="20" x2="45" y2="260" stroke="#94a3b8" />
                <text x="8" y="24" fontSize="12" fill="#334155">
                  {maxY.toPrecision(3)}
                </text>
                <text x="8" y="256" fontSize="12" fill="#334155">
                  {-Number(maxY.toPrecision(3))}
                </text>
                <text x="45" y="276" fontSize="12" fill="#334155">
                  {minX.toPrecision(3)}
                </text>
                <text x="600" y="276" fontSize="12" fill="#334155">
                  {maxX.toPrecision(3)}
                </text>
                {points.map((p, i) => (
                  <circle
                    key={i}
                    cx={45 + ((p.fitted - minX) / (maxX - minX || 1)) * 630}
                    cy={140 - (p.residual / maxY) * 110}
                    r="3"
                    fill="#2563eb"
                  />
                ))}
              </svg>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                downloadBlob(
                  new Blob(
                    [
                      JSON.stringify(
                        { mode, confidence, mu, ...result },
                        null,
                        2,
                      ),
                    ],
                    { type: 'application/json' },
                  ),
                  'statistics.json',
                )
              }
            >
              {s('report')}
            </Button>
            {points && (
              <Button
                variant="outline"
                onClick={() =>
                  downloadBlob(
                    new Blob(
                      [
                        'x,y,fitted,residual\n' +
                          points
                            .map((p) =>
                              [p.x, p.y, p.fitted, p.residual].join(','),
                            )
                            .join('\n'),
                      ],
                      { type: 'text/csv' },
                    ),
                    'residuals.csv',
                  )
                }
              >
                {s('residualCsv')}
              </Button>
            )}
          </div>
        </>
      )}
    </ScienceResultFrame>
  );
}
