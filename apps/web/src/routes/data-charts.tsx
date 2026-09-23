import { ToolExtensionSelector } from '@/components/tool-extension-selector';
import ImageAnalysis from '@/components/image-analysis-workspace';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnalysisFrame, SvgDownloads } from '@/components/analysis-tool-ui';
import { ChoiceField } from '@/components/calculator-ui';
import {
  PracticalText,
  ExportText,
  useLatestJob,
} from '@/components/practical-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import {
  aggregateChart,
  parseChartData,
  type ChartPoint,
} from '@/lib/analysis-charts';
export const Route = createFileRoute('/data-charts')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => (
    <ToolExtensionSelector base={<DataChartModes />} panels={['profile']} />
  ),
});
const PALETTE = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#4d7c0f',
];
function Plot({
  points,
  type,
  title,
  svgRef,
}: {
  points: ChartPoint[];
  type: string;
  title: string;
  svgRef: React.RefObject<SVGSVGElement | null>;
}) {
  const width = 900,
    height = type === 'pie' ? Math.max(500, points.length * 22 + 80) : 560;
  const top = 55,
    bottom = 430,
    left = 85,
    right = 860;
  const minY = Math.min(0, ...points.map((p) => p.y));
  const maxY = Math.max(0, ...points.map((p) => p.y)) || 1;
  const y = (n: number): number =>
    bottom - ((n - minY) / (maxY - minY)) * (bottom - top);
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const x = (point: ChartPoint, index: number): number =>
    type === 'scatter'
      ? left + ((point.x - minX) / (maxX - minX || 1)) * (right - left)
      : left + ((index + 0.5) * (right - left)) / points.length;
  let angle = -Math.PI / 2;
  const total = points.reduce((sum, p) => sum + p.y, 0);
  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={title}
      className="w-full rounded border bg-white"
      fontFamily="sans-serif"
    >
      <title>{title}</title>
      <rect width={width} height={height} fill="white" />
      <text x="30" y="30" fontSize="20" fill="#111827">
        {title}
      </text>
      {type === 'pie' ? (
        <>
          {points.map((point, index) => {
            const start = angle;
            const arc = (point.y / total) * Math.PI * 2;
            angle += arc;
            const fill = PALETTE[index % PALETTE.length];
            const sx = 260 + Math.cos(start) * 180,
              sy = 260 + Math.sin(start) * 180,
              ex = 260 + Math.cos(angle) * 180,
              ey = 260 + Math.sin(angle) * 180;
            return (
              <g key={point.label}>
                {arc >= Math.PI * 2 - 1e-10 ? (
                  <circle cx="260" cy="260" r="180" fill={fill} />
                ) : (
                  arc > 0 && (
                    <path
                      d={`M260 260 L${sx} ${sy} A180 180 0 ${arc > Math.PI ? 1 : 0} 1 ${ex} ${ey} Z`}
                      fill={fill}
                    >
                      <title>
                        {point.label}: {point.y}
                      </title>
                    </path>
                  )
                )}
                <rect
                  x="500"
                  y={65 + index * 22}
                  width="12"
                  height="12"
                  fill={fill}
                />
                <text x="522" y={76 + index * 22} fontSize="12" fill="#111827">
                  {point.label.slice(0, 32)}: {Number(point.y.toPrecision(6))} (
                  {((point.y / total) * 100).toFixed(1)}%)
                </text>
              </g>
            );
          })}
        </>
      ) : (
        <>
          {Array.from({ length: 6 }, (_, i) => {
            const value = minY + ((maxY - minY) * i) / 5;
            return (
              <g key={i}>
                <line
                  x1={left}
                  x2={right}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="#e5e7eb"
                />
                <text
                  x={left - 8}
                  y={y(value) + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="#4b5563"
                >
                  {Number(value.toPrecision(4))}
                </text>
              </g>
            );
          })}
          <line x1={left} x2={right} y1={y(0)} y2={y(0)} stroke="#6b7280" />
          {type === 'line' && (
            <polyline
              points={points
                .map((point, i) => `${x(point, i)},${y(point.y)}`)
                .join(' ')}
              fill="none"
              stroke={PALETTE[0]}
              strokeWidth="2"
            />
          )}
          {points.map((point, i) => (
            <g key={`${point.label}-${i}`}>
              {type === 'bar' ? (
                <rect
                  x={x(point, i) - ((right - left) / points.length) * 0.36}
                  y={Math.min(y(0), y(point.y))}
                  width={((right - left) / points.length) * 0.72}
                  height={Math.abs(y(point.y) - y(0))}
                  fill={PALETTE[i % PALETTE.length]}
                >
                  <title>
                    {point.label}: {point.y}
                  </title>
                </rect>
              ) : (
                <circle
                  cx={x(point, i)}
                  cy={y(point.y)}
                  r="4"
                  fill={PALETTE[0]}
                >
                  <title>
                    {point.x}, {point.y}
                  </title>
                </circle>
              )}
              {type !== 'scatter' &&
                i % Math.max(1, Math.ceil(points.length / 20)) === 0 && (
                  <text
                    x={x(point, i)}
                    y={bottom + 20}
                    transform={`rotate(40 ${x(point, i)} ${bottom + 20})`}
                    fontSize="11"
                    fill="#4b5563"
                  >
                    {point.label.slice(0, 14)}
                  </text>
                )}
            </g>
          ))}
          {type === 'scatter' &&
            Array.from({ length: 6 }, (_, i) => (
              <text
                key={i}
                x={left + (i / 5) * (right - left)}
                y={bottom + 22}
                textAnchor="middle"
                fontSize="12"
                fill="#4b5563"
              >
                {Number((minX + ((maxX - minX) * i) / 5).toPrecision(4))}
              </text>
            ))}
        </>
      )}
    </svg>
  );
}
function DataCharts() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    format: string;
    type: string;
    aggregate: string;
    x: string;
    y: string;
  }>({
    format: StringParam,
    type: StringParam,
    aggregate: StringParam,
    x: StringParam,
    y: StringParam,
  });
  const format = query.format === 'json' ? 'json' : 'csv',
    type = ['bar', 'line', 'scatter', 'pie'].includes(query.type ?? '')
      ? query.type!
      : 'bar',
    aggregate = ['sum', 'mean', 'count', 'min', 'max'].includes(
      query.aggregate ?? '',
    )
      ? query.aggregate!
      : 'sum';
  const [input, setInput] = useState('Category,Value\nA,12\nB,18\nA,8\nC,15');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const job = useLatestJob<Awaited<ReturnType<typeof parseChartData>>>(
    `${format}:${input}`,
  );
  const data = job.result;
  const x = data?.columns.includes(query.x ?? '')
      ? query.x!
      : (data?.columns[0] ?? ''),
    y = data?.columns.includes(query.y ?? '')
      ? query.y!
      : (data?.columns[1] ?? data?.columns[0] ?? '');
  const derived = useMemo(() => {
    try {
      return {
        points: data ? aggregateChart(data.rows, x, y, aggregate, type) : null,
        error: null,
      };
    } catch (cause) {
      return { points: null, error: (cause as Error).message };
    }
  }, [data, x, y, aggregate, type]);
  const options = (items: string[]) =>
    items.map((value) => ({
      value,
      label: t(`analysisTools.charts.${value}`),
    }));
  return (
    <AnalysisFrame tool="charts" error={error ?? job.error ?? derived.error}>
      <p className="text-sm text-muted-foreground">
        {t('analysisTools.charts.limit')}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <ChoiceField
          label={t('analysisTools.format')}
          value={format}
          options={[
            { value: 'csv', label: 'CSV' },
            { value: 'json', label: 'JSON' },
          ]}
          onChange={(format) => setQuery({ format })}
        />
        <Input
          type="file"
          accept=".csv,.json,.tsv,text/csv,application/json"
          aria-label={t('analysisTools.import')}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            try {
              if (file.size > 2_000_000) throw new Error('dataLimit');
              setInput(await file.text());
              setQuery({
                format: file.name.toLowerCase().endsWith('.json')
                  ? 'json'
                  : 'csv',
              });
              setError(null);
            } catch (cause) {
              setError((cause as Error).message);
            }
          }}
        />
      </div>
      <PracticalText
        label={t('analysisTools.source')}
        value={input}
        onChange={(value) => {
          setInput(value);
          setError(null);
        }}
        multiline
        maxLength={2_000_000}
      />
      <Button
        onClick={() => job.run(() => parseChartData(input, format))}
        disabled={job.busy}
      >
        {t(job.busy ? 'analysisTools.busy' : 'analysisTools.import')}
      </Button>
      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <ChoiceField
              label={t('analysisTools.charts.type')}
              value={type}
              options={options(['bar', 'line', 'scatter', 'pie'])}
              onChange={(type) => setQuery({ type })}
            />
            <ChoiceField
              label={t('analysisTools.charts.x')}
              value={x}
              options={data.columns.map((value) => ({ value, label: value }))}
              onChange={(x) => setQuery({ x })}
            />
            <ChoiceField
              label={t('analysisTools.charts.y')}
              value={y}
              options={data.columns.map((value) => ({ value, label: value }))}
              onChange={(y) => setQuery({ y })}
            />
            {type !== 'scatter' && (
              <ChoiceField
                label={t('analysisTools.charts.aggregate')}
                value={aggregate}
                options={options(['sum', 'mean', 'count', 'min', 'max'])}
                onChange={(aggregate) => setQuery({ aggregate })}
              />
            )}
          </div>
          <PracticalText
            label={t('analysisTools.charts.caption')}
            value={title}
            onChange={setTitle}
            maxLength={100}
          />
          {derived.points && (
            <>
              <Plot
                points={derived.points}
                type={type}
                title={title || `${x} / ${y}`}
                svgRef={svg}
              />
              <SvgDownloads
                svg={() => svg.current}
                name="chart"
                onError={setError}
              />
              <details className="rounded border p-3">
                <summary>{t('analysisTools.charts.pivot')}</summary>
                <div className="max-h-80 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="p-2 text-left">{x}</th>
                        <th>{y}</th>
                        <th>{t('analysisTools.charts.count')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {derived.points.map((point, i) => (
                        <tr className="border-t" key={i}>
                          <td className="p-2">
                            {type === 'scatter' ? point.x : point.label}
                          </td>
                          <td className="text-center">{point.y}</td>
                          <td className="text-center">{point.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ExportText
                  value={JSON.stringify(derived.points, null, 2)}
                  name="pivot.json"
                  type="application/json"
                />
              </details>
            </>
          )}
        </>
      )}
    </AnalysisFrame>
  );
}

function DataChartModes() {
  const { t } = useTranslation();
  const [q, set] = useQueryParams<{ workspace: string }>({
    workspace: StringParam,
  });
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <ChoiceField
          label={t('scienceExpansion.mode')}
          value={q.workspace === 'digitizer' ? 'digitizer' : 'charts'}
          options={[
            { value: 'charts', label: t('scienceExpansion.originalChart') },
            {
              value: 'digitizer',
              label: t('scienceExpansion.image.digitizer'),
            },
          ]}
          onChange={(workspace) => set({ workspace })}
        />
      </div>
      {q.workspace === 'digitizer' ? (
        <ImageAnalysis digitize />
      ) : (
        <DataCharts />
      )}
    </>
  );
}
