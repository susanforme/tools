import { MonacoTextEditor } from '@/components/monaco-editor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import {
  DEFAULT_GRADIENT_COMPOSITION,
  GRADIENT_PRESETS,
  generateGradientCss,
  parseGradientComposition,
  serializeGradientComposition,
  type AnimationDirection,
  type GradientComposition,
  type GradientType,
  type PatternStyle,
} from '@/lib/gradient-css';
import { cn } from '@/lib/utils';
import { createFileRoute } from '@tanstack/react-router';
import {
  Check,
  Copy,
  Download,
  Grip,
  Layers3,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/gradient-studio')({
  component: GradientStudioPage,
});

type Layer = 'base' | 'gradient' | 'pattern' | 'noise' | 'animation';

const LAYERS = [
  { id: 'base', icon: Layers3 },
  { id: 'gradient', icon: Grip },
  { id: 'pattern', icon: Sparkles },
  { id: 'noise', icon: Sparkles },
  { id: 'animation', icon: Sparkles },
] as const;

const PRESET_CLASSES = [
  'bg-gradient-to-r from-indigo-400 via-violet-500 to-fuchsia-400',
  'bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-800',
  'bg-gradient-to-r from-red-500 via-orange-500 to-amber-300',
  'bg-gradient-to-r from-cyan-400 via-blue-600 to-blue-950',
  'bg-gradient-to-r from-teal-800 via-emerald-400 to-lime-200',
  'bg-gradient-to-r from-rose-300 via-orange-100 to-pink-300',
] as const;

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-10 cursor-pointer rounded-md border bg-background p-1"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 font-mono text-xs"
          maxLength={7}
        />
      </div>
    </div>
  );
}

function RangeField({
  label,
  value,
  display,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <Label>{label}</Label>
        <span className="font-mono text-muted-foreground">{display}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(values) => onChange(values[0] ?? value)}
      />
    </div>
  );
}

function GradientStudioPage() {
  const { t } = useTranslation();
  const [config, setConfig] = useQueryParam('config', StringParam);
  const [selectedLayer, setSelectedLayer] = useQueryParam<Layer>(
    'layer',
    StringParam,
    'gradient',
  );
  const [composition, setComposition] = useState<GradientComposition>(() =>
    parseGradientComposition(config),
  );
  const [showCss, setShowCss] = useState(false);
  const [copied, setCopied] = useState(false);
  const css = useMemo(() => generateGradientCss(composition), [composition]);
  const previewCss = css.replace('.gradient', '#gradient-studio-preview');

  useEffect(() => {
    setConfig(serializeGradientComposition(composition));
  }, [composition, setConfig]);

  const enabledLayers = LAYERS.filter(
    ({ id }) => composition[id].enabled,
  ).length;

  function updateLayer<K extends Layer>(
    layer: K,
    value: GradientComposition[K],
  ) {
    setComposition((current) => ({ ...current, [layer]: value }));
  }

  function applyPreset(index: number) {
    const preset = GRADIENT_PRESETS[index];
    if (!preset) return;
    const denominator = Math.max(1, preset.colors.length - 1);
    updateLayer('gradient', {
      ...composition.gradient,
      stops: preset.colors.map((color, colorIndex) => ({
        id: crypto.randomUUID(),
        color,
        position: Math.round((colorIndex / denominator) * 100),
      })),
      meshPoints: composition.gradient.meshPoints.map((point, pointIndex) => ({
        ...point,
        color: preset.colors[pointIndex % preset.colors.length] ?? '#000000',
      })),
    });
  }

  async function copyCss() {
    await navigator.clipboard.writeText(css);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function reset() {
    setComposition(structuredClone(DEFAULT_GRADIENT_COMPOSITION));
    setSelectedLayer('gradient');
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-4 px-4 py-5 sm:px-6 lg:px-8">
      <style>{previewCss}</style>
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold">{t('gradientTool.title')}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw />
          {t('gradientTool.reset')}
        </Button>
        <Button
          variant={showCss ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowCss((current) => !current)}
        >
          {t('gradientTool.viewCss')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadBlob(new Blob([css], { type: 'text/css' }), 'gradient.css')
          }
        >
          <Download />
          {t('gradientTool.export')}
        </Button>
        <Button size="sm" onClick={() => void copyCss()}>
          {copied ? <Check /> : <Copy />}
          {t(copied ? 'panel.copied' : 'gradientTool.copyCss')}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <div
            id="gradient-studio-preview"
            className="relative min-h-[520px] overflow-hidden rounded-2xl border shadow-sm"
          >
            <span className="absolute left-5 top-5 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-white backdrop-blur">
              {t('gradientTool.livePreview')}
            </span>
            <span className="absolute bottom-5 left-5 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-xs text-white backdrop-blur">
              {enabledLayers}/5 {t('gradientTool.active')}
            </span>
          </div>
          {showCss && (
            <MonacoTextEditor
              value={css}
              label="CSS"
              language="css"
              height="300px"
              readOnly
            />
          )}
        </div>

        <aside className="min-w-0 rounded-2xl border bg-card p-3 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="font-semibold">{t('gradientTool.layers')}</h2>
            <span className="text-xs text-muted-foreground">
              {enabledLayers}/5
            </span>
          </div>
          <div className="space-y-2">
            {LAYERS.map(({ id, icon: Icon }) => (
              <div key={id} className="overflow-hidden rounded-xl border">
                <div className="flex items-center gap-2 bg-muted/30 px-3 py-2">
                  <Checkbox
                    checked={composition[id].enabled}
                    aria-label={t(`gradientTool.layersList.${id}`)}
                    onCheckedChange={(checked) =>
                      updateLayer(id, {
                        ...composition[id],
                        enabled: checked === true,
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedLayer(id)}
                    className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    {t(`gradientTool.layersList.${id}`)}
                  </button>
                </div>
                {selectedLayer === id && (
                  <div className="space-y-4 border-t p-3">
                    {id === 'base' && (
                      <ColorField
                        label={t('gradientTool.color')}
                        value={composition.base.color}
                        onChange={(color) =>
                          updateLayer('base', { ...composition.base, color })
                        }
                      />
                    )}

                    {id === 'gradient' && (
                      <GradientControls
                        composition={composition}
                        update={updateLayer}
                        applyPreset={applyPreset}
                      />
                    )}

                    {id === 'pattern' && (
                      <PatternControls
                        composition={composition}
                        update={updateLayer}
                      />
                    )}

                    {id === 'noise' && (
                      <div className="space-y-4">
                        <RangeField
                          label={t('gradientTool.intensity')}
                          value={composition.noise.intensity}
                          display={`${Math.round(composition.noise.intensity * 100)}%`}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(intensity) =>
                            updateLayer('noise', {
                              ...composition.noise,
                              intensity,
                            })
                          }
                        />
                        <RangeField
                          label={t('gradientTool.opacity')}
                          value={composition.noise.opacity}
                          display={`${Math.round(composition.noise.opacity * 100)}%`}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(opacity) =>
                            updateLayer('noise', {
                              ...composition.noise,
                              opacity,
                            })
                          }
                        />
                      </div>
                    )}

                    {id === 'animation' && (
                      <AnimationControls
                        composition={composition}
                        update={updateLayer}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function GradientControls({
  composition,
  update,
  applyPreset,
}: {
  composition: GradientComposition;
  update: <K extends Layer>(layer: K, value: GradientComposition[K]) => void;
  applyPreset: (index: number) => void;
}) {
  const { t } = useTranslation();
  const gradient = composition.gradient;
  const types: GradientType[] = ['linear', 'radial', 'conic', 'mesh'];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {types.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => update('gradient', { ...gradient, type })}
            className={cn(
              'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              gradient.type === type
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`gradientTool.types.${type}`)}
          </button>
        ))}
      </div>

      {gradient.type !== 'radial' && gradient.type !== 'mesh' && (
        <RangeField
          label={t('gradientTool.angle')}
          value={gradient.angle}
          display={`${gradient.angle}°`}
          min={0}
          max={360}
          onChange={(angle) => update('gradient', { ...gradient, angle })}
        />
      )}

      {gradient.type === 'mesh' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{t('gradientTool.meshPoints')}</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={gradient.meshPoints.length >= 8}
              onClick={() =>
                update('gradient', {
                  ...gradient,
                  meshPoints: [
                    ...gradient.meshPoints,
                    {
                      id: crypto.randomUUID(),
                      color: '#ffffff',
                      x: 50,
                      y: 50,
                    },
                  ],
                })
              }
            >
              <Plus />
              {t('gradientTool.add')}
            </Button>
          </div>
          {gradient.meshPoints.map((point) => (
            <div key={point.id} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <ColorField
                    label={t('gradientTool.color')}
                    value={point.color}
                    onChange={(color) =>
                      update('gradient', {
                        ...gradient,
                        meshPoints: gradient.meshPoints.map((item) =>
                          item.id === point.id ? { ...item, color } : item,
                        ),
                      })
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={gradient.meshPoints.length <= 2}
                  aria-label={t('gradientTool.remove')}
                  onClick={() =>
                    update('gradient', {
                      ...gradient,
                      meshPoints: gradient.meshPoints.filter(
                        (item) => item.id !== point.id,
                      ),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
              <RangeField
                label="X"
                value={point.x}
                display={`${point.x}%`}
                min={0}
                max={100}
                onChange={(x) =>
                  update('gradient', {
                    ...gradient,
                    meshPoints: gradient.meshPoints.map((item) =>
                      item.id === point.id ? { ...item, x } : item,
                    ),
                  })
                }
              />
              <RangeField
                label="Y"
                value={point.y}
                display={`${point.y}%`}
                min={0}
                max={100}
                onChange={(y) =>
                  update('gradient', {
                    ...gradient,
                    meshPoints: gradient.meshPoints.map((item) =>
                      item.id === point.id ? { ...item, y } : item,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{t('gradientTool.colorStops')}</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={gradient.stops.length >= 8}
              onClick={() =>
                update('gradient', {
                  ...gradient,
                  stops: [
                    ...gradient.stops,
                    {
                      id: crypto.randomUUID(),
                      color: '#ffffff',
                      position: 50,
                    },
                  ],
                })
              }
            >
              <Plus />
              {t('gradientTool.add')}
            </Button>
          </div>
          {gradient.stops.map((stop) => (
            <div key={stop.id} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <ColorField
                    label={t('gradientTool.color')}
                    value={stop.color}
                    onChange={(color) =>
                      update('gradient', {
                        ...gradient,
                        stops: gradient.stops.map((item) =>
                          item.id === stop.id ? { ...item, color } : item,
                        ),
                      })
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={gradient.stops.length <= 2}
                  aria-label={t('gradientTool.remove')}
                  onClick={() =>
                    update('gradient', {
                      ...gradient,
                      stops: gradient.stops.filter(
                        (item) => item.id !== stop.id,
                      ),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
              <RangeField
                label={t('gradientTool.position')}
                value={stop.position}
                display={`${stop.position}%`}
                min={0}
                max={100}
                onChange={(position) =>
                  update('gradient', {
                    ...gradient,
                    stops: gradient.stops.map((item) =>
                      item.id === stop.id ? { ...item, position } : item,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs">{t('gradientTool.presets')}</Label>
        <div className="grid grid-cols-3 gap-2">
          {GRADIENT_PRESETS.map((preset, index) => (
            <button
              key={preset.name}
              type="button"
              aria-label={t(`gradientTool.presetNames.${preset.name}`)}
              onClick={() => applyPreset(index)}
              className={cn(
                'h-10 rounded-lg border transition-transform hover:scale-[1.03]',
                PRESET_CLASSES[index],
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PatternControls({
  composition,
  update,
}: {
  composition: GradientComposition;
  update: <K extends Layer>(layer: K, value: GradientComposition[K]) => void;
}) {
  const { t } = useTranslation();
  const pattern = composition.pattern;
  const styles: PatternStyle[] = [
    'dots',
    'grid',
    'lines',
    'diagonal',
    'checker',
    'crosses',
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {styles.map((style) => (
          <button
            key={style}
            type="button"
            onClick={() => update('pattern', { ...pattern, style })}
            className={cn(
              'rounded-lg border px-2 py-2 text-xs transition-colors',
              pattern.style === style
                ? 'border-primary bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`gradientTool.patterns.${style}`)}
          </button>
        ))}
      </div>
      <RangeField
        label={t('gradientTool.size')}
        value={pattern.size}
        display={`${pattern.size}px`}
        min={4}
        max={80}
        onChange={(size) => update('pattern', { ...pattern, size })}
      />
      <ColorField
        label={t('gradientTool.color')}
        value={pattern.color}
        onChange={(color) => update('pattern', { ...pattern, color })}
      />
      <RangeField
        label={t('gradientTool.opacity')}
        value={pattern.opacity}
        display={`${Math.round(pattern.opacity * 100)}%`}
        min={0}
        max={1}
        step={0.01}
        onChange={(opacity) => update('pattern', { ...pattern, opacity })}
      />
    </div>
  );
}

function AnimationControls({
  composition,
  update,
}: {
  composition: GradientComposition;
  update: <K extends Layer>(layer: K, value: GradientComposition[K]) => void;
}) {
  const { t } = useTranslation();
  const animation = composition.animation;
  const directions: AnimationDirection[] = ['normal', 'reverse', 'alternate'];
  return (
    <div className="space-y-4">
      <RangeField
        label={t('gradientTool.speed')}
        value={animation.speed}
        display={`${animation.speed.toFixed(2)}×`}
        min={0.25}
        max={3}
        step={0.25}
        onChange={(speed) => update('animation', { ...animation, speed })}
      />
      <div className="space-y-2">
        <Label className="text-xs">{t('gradientTool.direction')}</Label>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {directions.map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => update('animation', { ...animation, direction })}
              className={cn(
                'rounded-md px-2 py-1.5 text-xs font-medium',
                animation.direction === direction
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {t(`gradientTool.directions.${direction}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
