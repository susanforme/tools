import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  laserPlan,
  laserSvg,
  laserDxf,
  type LaserOptions,
} from '@/lib/laser-design';
import { packagingPdf } from '@/lib/analysis-packaging';
import { downloadBlob, downloadBytes } from '@/lib/download';
import { svgToDataUri } from '@/lib/svg-tools';
import { ChoiceField, NumberField } from './calculator-ui';
import { useLatestJob } from './practical-ui';
import { Button } from './ui/button';
import { VisualError } from './visual-design-ui';
export function LaserDesigner() {
  const { t } = useTranslation();
  const [q, setQ] = useQueryParams<LaserOptions & { paper: string }>({
    kind: StringParam,
    width: NumberParam,
    depth: NumberParam,
    height: NumberParam,
    thickness: NumberParam,
    kerf: NumberParam,
    clearance: NumberParam,
    rows: NumberParam,
    columns: NumberParam,
    paper: StringParam,
  });
  const options: LaserOptions = {
    kind: ['box', 'dividers', 'card'].includes(q.kind ?? '') ? q.kind! : 'box',
    width: q.width ?? 100,
    depth: q.depth ?? 80,
    height: q.height ?? 60,
    thickness: q.thickness ?? 3,
    kerf: q.kerf ?? 0.15,
    clearance: q.clearance ?? 0,
    rows: q.rows ?? 2,
    columns: q.columns ?? 2,
  };
  const key = JSON.stringify([options, q.paper]);
  const job = useLatestJob<Uint8Array>(key);
  const result = useMemo(() => {
    try {
      return { plan: laserPlan(options), error: null };
    } catch (e) {
      return { plan: null, error: (e as Error).message };
    }
  }, [key]);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('visualDesign.laserHint')}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <ChoiceField
          label={t('visualDesign.model')}
          value={options.kind}
          options={['box', 'dividers', 'card'].map((value) => ({
            value,
            label: t(`visualDesign.${value}`),
          }))}
          onChange={(kind) => setQ({ kind })}
        />
        {(
          [
            'width',
            'depth',
            'height',
            'thickness',
            'kerf',
            'clearance',
          ] as const
        )
          .filter(
            (field) =>
              options.kind !== 'card' ||
              ['thickness', 'kerf', 'clearance'].includes(field),
          )
          .map((field) => (
            <NumberField
              key={field}
              label={t(`visualDesign.${field}`)}
              value={options[field]}
              min={field === 'clearance' ? -0.5 : 0}
              onChange={(value) => setQ({ [field]: value })}
            />
          ))}
        {options.kind === 'dividers' &&
          (['rows', 'columns'] as const).map((field) => (
            <NumberField
              key={field}
              label={t(`visualDesign.${field}`)}
              value={options[field]}
              min={1}
              max={8}
              step={1}
              onChange={(value) => setQ({ [field]: value })}
            />
          ))}
      </div>
      {result.plan && (
        <>
          <p>
            {result.plan.width.toFixed(1)} × {result.plan.height.toFixed(1)} mm
          </p>
          <img
            src={svgToDataUri(laserSvg(result.plan))}
            alt={t('visualDesign.laserTitle')}
            className="max-h-[65vh] w-full rounded border bg-white"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                downloadBlob(
                  new Blob([laserSvg(result.plan!)], { type: 'image/svg+xml' }),
                  'laser-cut.svg',
                )
              }
            >
              SVG
            </Button>
            <Button
              onClick={() =>
                downloadBlob(
                  new Blob([laserDxf(result.plan!)], {
                    type: 'application/dxf',
                  }),
                  'laser-cut.dxf',
                )
              }
            >
              DXF
            </Button>
            <ChoiceField
              label={t('visualDesign.paper')}
              value={q.paper ?? 'a4'}
              options={[
                { value: 'a4', label: 'A4' },
                { value: 'actual', label: t('visualDesign.actual') },
              ]}
              onChange={(paper) => setQ({ paper })}
            />
            <Button
              disabled={job.busy}
              onClick={() => {
                setError(null);
                void job.run(() =>
                  packagingPdf(result.plan!, q.paper !== 'actual'),
                );
              }}
            >
              PDF
            </Button>
            {job.result && (
              <Button
                onClick={() =>
                  downloadBytes(job.result!, 'laser-cut.pdf', 'application/pdf')
                }
              >
                {t('visualDesign.download')}
              </Button>
            )}
          </div>
        </>
      )}
      <VisualError error={error ?? result.error ?? job.error} />
    </div>
  );
}
