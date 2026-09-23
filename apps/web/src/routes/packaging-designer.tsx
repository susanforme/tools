import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnalysisFrame, SvgDownloads } from '@/components/analysis-tool-ui';
import { ChoiceField, NumberField } from '@/components/calculator-ui';
import { Button } from '@/components/ui/button';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { packagingPlan, packagingPdf } from '@/lib/analysis-packaging';
import { downloadBytes } from '@/lib/download';
export const Route = createFileRoute('/packaging-designer')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: PackagingDesigner,
});
function PackagingDesigner() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    kind: string;
    width: number;
    height: number;
    depth: number;
    glue: number;
    paper: string;
  }>({
    kind: StringParam,
    width: NumberParam,
    height: NumberParam,
    depth: NumberParam,
    glue: NumberParam,
    paper: StringParam,
  });
  const kind = ['box', 'bag', 'envelope'].includes(query.kind ?? '')
      ? query.kind!
      : 'box',
    width = query.width ?? 80,
    height = query.height ?? 100,
    depth = query.depth ?? 50,
    glue = query.glue ?? 10,
    paper = query.paper === 'actual' ? 'actual' : 'a4';
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const calculation = useMemo(() => {
    try {
      return {
        plan: packagingPlan(kind, width, height, depth, glue),
        error: null,
      };
    } catch (cause) {
      return { plan: null, error: (cause as Error).message };
    }
  }, [kind, width, height, depth, glue]);
  const plan = calculation.plan;
  return (
    <AnalysisFrame tool="packaging" error={error ?? calculation.error}>
      <div className="grid gap-4 md:grid-cols-3">
        <ChoiceField
          label={t('analysis3.packaging.kind')}
          value={kind}
          options={['box', 'envelope', 'bag'].map((value) => ({
            value,
            label: t(`analysis3.packaging.${value}`),
          }))}
          onChange={(kind) => setQuery({ kind })}
        />
        <NumberField
          label={t('analysis3.packaging.width')}
          value={width}
          min={10}
          max={400}
          onChange={(width) => setQuery({ width })}
        />
        <NumberField
          label={t('analysis3.packaging.height')}
          value={height}
          min={10}
          max={500}
          onChange={(height) => setQuery({ height })}
        />
        {kind !== 'envelope' && (
          <NumberField
            label={t('analysis3.packaging.depth')}
            value={depth}
            min={5}
            max={250}
            onChange={(depth) => setQuery({ depth })}
          />
        )}
        <NumberField
          label={t('analysis3.packaging.glue')}
          value={glue}
          min={3}
          max={40}
          onChange={(glue) => setQuery({ glue })}
        />
        <ChoiceField
          label={t('analysis3.packaging.paper')}
          value={paper}
          options={['a4', 'actual'].map((value) => ({
            value,
            label: t(`analysis3.packaging.${value}`),
          }))}
          onChange={(paper) => setQuery({ paper })}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {t('analysis3.packaging.note')}
      </p>
      <p className="text-sm">
        <span className="text-red-600">{t('analysis3.packaging.cut')}</span> ·{' '}
        <span className="text-blue-600">{t('analysis3.packaging.fold')}</span>
      </p>
      {plan && (
        <>
          <p className="text-sm">
            {t('analysis3.packaging.sheet')}: {plan.width.toFixed(1)} ×{' '}
            {plan.height.toFixed(1)} mm
          </p>
          <svg
            ref={svg}
            xmlns="http://www.w3.org/2000/svg"
            width={`${plan.width}mm`}
            height={`${plan.height}mm`}
            viewBox={`0 0 ${plan.width} ${plan.height}`}
            className="h-auto max-h-[65vh] w-full rounded border bg-white"
            role="img"
            aria-label={t('analysis3.packaging.title')}
          >
            <title>{t('analysis3.packaging.title')}</title>
            <rect width={plan.width} height={plan.height} fill="white" />
            {plan.lines.map((line, index) => (
              <line
                key={index}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={line.fold ? '#2659cc' : '#cc2626'}
                strokeWidth="0.2"
                strokeDasharray={line.fold ? '1.5 1' : undefined}
              />
            ))}
            {plan.labels.map((label, i) => (
              <text
                key={i}
                x={label.x}
                y={label.y}
                textAnchor="middle"
                fontFamily="sans-serif"
                fontSize="3"
                fill="#374151"
              >
                {label.text}
              </text>
            ))}
          </svg>
          <div className="flex flex-wrap gap-2">
            <SvgDownloads
              svg={() => svg.current}
              name="packaging"
              onError={setError}
            />
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  downloadBytes(
                    await packagingPdf(plan, paper === 'a4'),
                    'packaging.pdf',
                    'application/pdf',
                  );
                } catch (cause) {
                  setError((cause as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t(busy ? 'analysis3.busy' : 'analysis3.packaging.exportPdf')}
            </Button>
          </div>
        </>
      )}
    </AnalysisFrame>
  );
}
