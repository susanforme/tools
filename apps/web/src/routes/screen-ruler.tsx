import { ChoiceField } from '@/components/calculator-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/screen-ruler')({
  component: ScreenRulerPage,
});
const STORAGE_KEY = 'tools-screen-ruler-calibration';
type Calibration = { pixelsPerMm: number; display: string };
const displaySignature = () =>
  JSON.stringify([
    window.screen.width,
    window.screen.height,
    window.devicePixelRatio,
    window.visualViewport?.scale ?? 1,
  ]);

function ScreenRulerPage() {
  const { t } = useTranslation();
  const [rawUnit, setUnit] = useQueryParam<string>('unit', StringParam, 'cm');
  const unit = rawUnit === 'inch' ? 'inch' : 'cm';
  const [pixelsPerMm, setPixelsPerMm] = useState(96 / 25.4);
  const [referenceMm, setReferenceMm] = useState(85.6);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [display, setDisplay] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDisplay(displaySignature());
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? 'null',
      );
      if (
        saved &&
        typeof saved === 'object' &&
        'pixelsPerMm' in saved &&
        typeof saved.pixelsPerMm === 'number' &&
        Number.isFinite(saved.pixelsPerMm) &&
        saved.pixelsPerMm >= 1 &&
        saved.pixelsPerMm <= 16 &&
        'display' in saved &&
        typeof saved.display === 'string'
      ) {
        setPixelsPerMm(saved.pixelsPerMm);
        setCalibration({
          pixelsPerMm: saved.pixelsPerMm,
          display: saved.display,
        });
      }
    } catch {
      /* 本地保存不可用时仍可手动校准。 */
    }
    const timer = window.setInterval(
      () => setDisplay(displaySignature()),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const calibrated =
    calibration?.display === display &&
    calibration?.pixelsPerMm === pixelsPerMm;
  const save = () => {
    setError(null);
    const value = { pixelsPerMm, display: displaySignature() };
    setDisplay(value.display);
    setCalibration(value);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      setError(t('screenRuler.saveError'));
    }
  };
  const stepMm = unit === 'cm' ? 1 : 25.4 / 16;
  const ticks = unit === 'cm' ? 300 : 192;
  const width = ticks * stepMm * pixelsPerMm + 32;
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('screenRuler.title')}</h1>
      <div className="grid gap-4 rounded-xl border p-4 md:grid-cols-2">
        <div className="space-y-4">
          <ChoiceField
            label={t('screenRuler.unit')}
            value={unit}
            onChange={setUnit}
            options={['cm', 'inch'].map((value) => ({
              value,
              label: t(`screenRuler.${value}`),
            }))}
          />
          <div className="space-y-1.5">
            <Label htmlFor="ruler-reference">
              {t('screenRuler.reference')}
            </Label>
            <Input
              id="ruler-reference"
              type="number"
              value={referenceMm}
              min={10}
              max={300}
              step={0.1}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) setReferenceMm(value);
              }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('screenRuler.card')}
          </p>
        </div>
        <div className="space-y-4">
          <Label htmlFor="ruler-scale">{t('screenRuler.adjust')}</Label>
          <Input
            id="ruler-scale"
            type="range"
            min={1}
            max={16}
            step={0.001}
            value={pixelsPerMm}
            onChange={(event) => setPixelsPerMm(Number(event.target.value))}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              aria-label={t('screenRuler.decrease')}
              onClick={() =>
                setPixelsPerMm((value) => Math.max(1, value - 0.005))
              }
            >
              −
            </Button>
            <Button
              variant="outline"
              aria-label={t('screenRuler.increase')}
              onClick={() =>
                setPixelsPerMm((value) => Math.min(16, value + 0.005))
              }
            >
              +
            </Button>
            <Button
              onClick={save}
              disabled={referenceMm < 10 || referenceMm > 300}
            >
              {t('screenRuler.save')}
            </Button>
          </div>
          <p
            role="status"
            className={
              calibrated ? 'text-sm text-primary' : 'text-sm text-destructive'
            }
          >
            {t(
              calibrated
                ? 'screenRuler.calibrated'
                : 'screenRuler.needsCalibration',
            )}
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg bg-muted p-3 md:col-span-2">
          <svg
            width={Math.max(10, Math.min(300, referenceMm)) * pixelsPerMm + 32}
            height={85}
            aria-label={t('screenRuler.referenceLine')}
            role="img"
            className="max-w-none"
          >
            <path
              d={`M16 15 V65 M16 40 H${16 + Math.max(10, Math.min(300, referenceMm)) * pixelsPerMm} M${16 + Math.max(10, Math.min(300, referenceMm)) * pixelsPerMm} 15 V65`}
              stroke="currentColor"
              strokeWidth={2}
              fill="none"
            />
            <text x={24} y={78} className="fill-current text-xs">
              {referenceMm} mm
            </text>
          </svg>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('screenRuler.warning')}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border bg-muted/30 p-3">
        <svg
          width={width}
          height={150}
          role="img"
          aria-label={t('screenRuler.title')}
          className="max-w-none"
        >
          <path d={`M16 20 H${width - 16}`} stroke="currentColor" />
          {Array.from({ length: ticks + 1 }, (_, i) => {
            const major = i % (unit === 'cm' ? 10 : 16) === 0;
            const middle = i % (unit === 'cm' ? 5 : 8) === 0;
            const x = 16 + i * stepMm * pixelsPerMm;
            return (
              <g key={i}>
                <path
                  d={`M${x} 20 V${major ? 85 : middle ? 65 : 45}`}
                  stroke="currentColor"
                />
                {major && (
                  <text
                    x={x}
                    y={110}
                    textAnchor="middle"
                    className="fill-current text-sm"
                  >
                    {i / (unit === 'cm' ? 10 : 16)}
                  </text>
                )}
              </g>
            );
          })}
          <text x={16} y={140} className="fill-current text-xs">
            {t(`screenRuler.${unit}`)}
          </text>
        </svg>
      </div>
    </div>
  );
}
