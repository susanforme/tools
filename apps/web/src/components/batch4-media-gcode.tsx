import { ChoiceField, NumberField } from './calculator-ui';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import type { GcodeResult } from '@/lib/batch4-media-analysis';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
const createWorker = () =>
  new Worker(
    new URL('../lib/batch4-media-analysis.worker.ts', import.meta.url),
    { type: 'module' },
  );
export default function GcodeInspector() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    path: string;
    color: string;
    diameter: number;
  }>({ path: StringParam, color: StringParam, diameter: NumberParam });
  const [layer, setLayer] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const job = useBoundedWorker<{ type: 'gcode'; source: string }, GcodeResult>(
    createWorker,
    10000,
  );
  const canvas = useRef<HTMLCanvasElement>(null),
    ticket = useRef(0);
  useEffect(
    () => () => {
      ticket.current++;
    },
    [],
  );
  const result = job.result;
  async function load(file: File) {
    const id = ++ticket.current;
    job.clear();
    setError(null);
    try {
      if (file.size > 20_000_000) throw new Error('limit');
      const source = await file.text();
      if (ticket.current !== id) return;
      setLayer(0);
      job.run({ type: 'gcode', source });
    } catch (e) {
      if (ticket.current === id) setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (!result || !canvas.current) return;
    const c = canvas.current;
    c.width = 1000;
    c.height = 700;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 1000, 700);
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity,
      maxSpeed = 1;
    for (const s of result.segments) {
      for (const p of [s.from, s.to]) {
        minX = Math.min(minX, p[0]);
        minY = Math.min(minY, p[1]);
        maxX = Math.max(maxX, p[0]);
        maxY = Math.max(maxY, p[1]);
      }
      maxSpeed = Math.max(maxSpeed, s.speed);
    }
    const scale = Math.min(
      940 / Math.max(1, maxX - minX),
      640 / Math.max(1, maxY - minY),
    );
    const z = result.layers[layer];
    for (const s of result.segments) {
      if (z !== undefined && Math.abs(s.to[2] - z) > 0.001) continue;
      if (
        (query.path === 'extrusion' && s.extrusion <= 0) ||
        (query.path === 'travel' && s.extrusion > 0)
      )
        continue;
      ctx.strokeStyle =
        query.color === 'speed'
          ? `hsl(${240 - (240 * s.speed) / maxSpeed} 85% 60%)`
          : s.extrusion > 0
            ? '#34d399'
            : '#94a3b8';
      ctx.lineWidth = s.extrusion > 0 ? 1.8 : 0.7;
      ctx.beginPath();
      ctx.moveTo(
        30 + (s.from[0] - minX) * scale,
        670 - (s.from[1] - minY) * scale,
      );
      ctx.lineTo(30 + (s.to[0] - minX) * scale, 670 - (s.to[1] - minY) * scale);
      ctx.stroke();
    }
  }, [result, layer, query.path, query.color]);
  const diameter = query.diameter ?? 1.75;
  return (
    <div className="space-y-4">
      <Label htmlFor="gcode-file">{t('batch4Media.gcodeFile')}</Label>
      <Input
        id="gcode-file"
        type="file"
        accept=".gcode,.gco,.gc,.txt"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void load(f);
          e.target.value = '';
        }}
      />
      <p className="text-sm text-muted-foreground">
        {t('batch4Media.gcodeLimit')}
      </p>
      <Button
        variant="outline"
        onClick={() => {
          ticket.current++;
          setError(null);
          setLayer(0);
          job.run({
            type: 'gcode',
            source:
              'G21\nG90\nM82\nG1 Z0.2 F1200\nG1 X40 Y0 E1\nG1 X40 Y40 E2\nG1 X0 Y40 E3\nG1 X0 Y0 E4\nG1 Z0.4\nG1 X40 Y0 E5\nG1 X40 Y40 E6\nG1 X0 Y40 E7\nG1 X0 Y0 E8',
          });
        }}
      >
        {t('batch4Media.sample')}
      </Button>
      {job.busy && <p role="status">{t('batch4Media.loading')}</p>}
      {(error || job.error) && (
        <p role="alert" className="text-destructive">
          {t('batch4Media.failed', {
            msg: t(`batch4Media.errors.${error || job.error}`, {
              defaultValue: error || job.error || '',
            }),
          })}
        </p>
      )}
      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <ChoiceField
              label={t('batch4Media.paths')}
              value={query.path ?? 'all'}
              options={['all', 'extrusion', 'travel'].map((value) => ({
                value,
                label: t(`batch4Media.${value}`),
              }))}
              onChange={(path) => setQuery({ path })}
            />
            <ChoiceField
              label={t('batch4Media.color')}
              value={query.color ?? 'kind'}
              options={['kind', 'speed'].map((value) => ({
                value,
                label: t(`batch4Media.${value}`),
              }))}
              onChange={(color) => setQuery({ color })}
            />
            <NumberField
              label={t('batch4Media.diameter')}
              value={diameter}
              min={0.1}
              max={10}
              onChange={(diameter) => setQuery({ diameter })}
            />
          </div>
          <Label htmlFor="gcode-layer">
            {t('batch4Media.layer')} {layer + 1}/
            {Math.max(1, result.layers.length)} · Z={result.layers[layer] ?? 0}{' '}
            mm
          </Label>
          <Input
            id="gcode-layer"
            type="range"
            min={0}
            max={Math.max(0, result.layers.length - 1)}
            value={layer}
            onChange={(e) => setLayer(Number(e.target.value))}
          />
          <canvas
            ref={canvas}
            className="w-full rounded-lg border"
            aria-label={t('batch4Media.titles.gcode')}
          />
          <p className="text-sm">
            {t(
              query.color === 'speed'
                ? 'batch4Media.speedLegend'
                : 'batch4Media.pathLegend',
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <p>
              {t('batch4Media.filament')}: {(result.filament / 1000).toFixed(3)}{' '}
              m
            </p>
            <p>
              {t('batch4Media.volume')}:{' '}
              {Number.isFinite(diameter) && diameter > 0 && diameter <= 10
                ? (
                    (result.filament * Math.PI * (diameter / 2) ** 2) /
                    1000
                  ).toFixed(3)
                : '—'}{' '}
              cm³
            </p>
            <p>
              {t('batch4Media.estimatedTime')}:{' '}
              {(result.seconds / 60).toFixed(2)} min
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('batch4Media.timeNote')}
          </p>
        </>
      )}
    </div>
  );
}
