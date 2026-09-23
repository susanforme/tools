import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  patternSvg,
  patternPeriod,
  patternPng,
  cleanMotifSvg,
  type PatternOptions,
} from '@/lib/seamless-pattern';
import { svgToDataUri } from '@/lib/svg-tools';
import { downloadBlob } from '@/lib/download';
import { ChoiceField, NumberField } from '@/components/calculator-ui';
import { useLatestJob } from '@/components/practical-ui';
import { VisualError } from '@/components/visual-design-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export const Route = createFileRoute('/pattern-designer')({
  component: PatternDesigner,
});
function PatternDesigner() {
  const { t } = useTranslation();
  const [q, setQ] = useQueryParams<PatternOptions>({
    layout: StringParam,
    width: NumberParam,
    height: NumberParam,
    size: NumberParam,
    angle: NumberParam,
    x: NumberParam,
    y: NumberParam,
    repeat: NumberParam,
    background: StringParam,
    color: StringParam,
    shape: StringParam,
  });
  const options: PatternOptions = {
    layout: q.layout ?? 'grid',
    width: q.width ?? 120,
    height: q.height ?? 120,
    size: q.size ?? 60,
    angle: q.angle ?? 0,
    x: q.x ?? 50,
    y: q.y ?? 50,
    repeat: q.repeat ?? 4,
    background: q.background ?? '#ffffff',
    color: q.color ?? '#e11d48',
    shape: q.shape ?? 'leaf',
  };
  const [motif, setMotif] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  const key = JSON.stringify([options, motif]);
  const job = useLatestJob<{ blob: Blob; name: string }>(key);
  const result = useMemo(() => {
    try {
      return {
        svg: patternSvg(options, motif, true),
        unit: patternSvg(options, motif, false),
        period: patternPeriod(options),
        error: null,
      };
    } catch (cause) {
      return {
        svg: '',
        unit: '',
        period: null,
        error: (cause as Error).message,
      };
    }
  }, [key]);
  async function load(file: File) {
    const ticket = ++request.current;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('size');
      let data: string;
      if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name))
        data = svgToDataUri(cleanMotifSvg(await file.text()));
      else {
        const bitmap = await createImageBitmap(file);
        try {
          if (bitmap.width * bitmap.height > 16000000) throw new Error('size');
          const canvas = document.createElement('canvas');
          const scale = Math.min(
            1,
            1024 / Math.max(bitmap.width, bitmap.height),
          );
          canvas.width = Math.ceil(bitmap.width * scale);
          canvas.height = Math.ceil(bitmap.height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('canvas');
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          data = canvas.toDataURL('image/png');
          canvas.width = canvas.height = 0;
        } finally {
          bitmap.close();
        }
      }
      if (ticket === request.current) {
        setMotif(data);
        setError(null);
      }
    } catch (cause) {
      if (ticket === request.current) setError((cause as Error).message);
    }
  }
  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('visualDesign.patternTitle')}</h1>
      <div className="grid gap-3 md:grid-cols-3">
        <ChoiceField
          label={t('visualDesign.layout')}
          value={options.layout}
          options={['grid', 'halfDrop', 'mirror'].map((value) => ({
            value,
            label: t(`visualDesign.${value}`),
          }))}
          onChange={(layout) => setQ({ layout })}
        />
        <ChoiceField
          label={t('visualDesign.shape')}
          value={options.shape}
          options={['dot', 'leaf', 'star'].map((value) => ({
            value,
            label: t(`visualDesign.${value}`),
          }))}
          onChange={(shape) => {
            request.current++;
            setMotif(null);
            setQ({ shape });
          }}
        />
        {(
          ['width', 'height', 'size', 'angle', 'x', 'y', 'repeat'] as const
        ).map((field) => (
          <NumberField
            key={field}
            label={t(`visualDesign.pattern_${field}`)}
            value={options[field]}
            min={0}
            max={field === 'repeat' ? 8 : 512}
            onChange={(value) => setQ({ [field]: value })}
          />
        ))}
        <label className="space-y-1 text-sm">
          {t('visualDesign.color')}
          <Input
            type="color"
            value={options.color}
            onChange={(e) => setQ({ color: e.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          {t('visualDesign.background')}
          <Input
            type="color"
            value={
              options.background === 'transparent'
                ? '#ffffff'
                : options.background
            }
            onChange={(e) => setQ({ background: e.target.value })}
          />
        </label>
        <Button
          variant="outline"
          onClick={() =>
            setQ({
              background:
                options.background === 'transparent'
                  ? '#ffffff'
                  : 'transparent',
            })
          }
        >
          {t('visualDesign.transparent')}
        </Button>
      </div>
      <label className="block space-y-1 text-sm">
        {t('visualDesign.motif')}
        <Input
          type="file"
          accept=".svg,image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void load(file);
          }}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        {t('visualDesign.patternHint')}
      </p>
      {result.svg && (
        <>
          <p>
            {t('visualDesign.unit')}: {result.period!.width} ×{' '}
            {result.period!.height} px
          </p>
          <img
            src={svgToDataUri(result.svg)}
            alt={t('visualDesign.patternTitle')}
            className="max-h-[65vh] w-full rounded border bg-white object-contain"
          />
          <div className="flex flex-wrap gap-2">
            {[false, true].map((large) => (
              <div key={String(large)} className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadBlob(
                      new Blob([large ? result.svg : result.unit], {
                        type: 'image/svg+xml',
                      }),
                      `${large ? 'pattern' : 'tile'}.svg`,
                    )
                  }
                >
                  {t(`visualDesign.${large ? 'large' : 'unit'}`)} SVG
                </Button>
                <Button
                  disabled={job.busy}
                  onClick={() =>
                    void job.run(async () => ({
                      blob: await patternPng(large ? result.svg : result.unit),
                      name: `${large ? 'pattern' : 'tile'}.png`,
                    }))
                  }
                >
                  {t(`visualDesign.${large ? 'large' : 'unit'}`)} PNG
                </Button>
              </div>
            ))}
          </div>
          {job.result && (
            <Button
              onClick={() => downloadBlob(job.result!.blob, job.result!.name)}
            >
              {t('visualDesign.download')}
            </Button>
          )}
        </>
      )}
      <VisualError error={error ?? result.error ?? job.error} />
    </main>
  );
}
