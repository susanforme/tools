import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  ASPECT_PRESETS,
  SAFE_AREA_PRESETS,
  contentBox,
  heightFromWidth,
  simplifyRatio,
  widthFromHeight,
} from '@/lib/aspect-ratio';
import { createFileRoute } from '@tanstack/react-router';
import { Check, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

export const Route = createFileRoute('/aspect-ratio')({
  component: AspectRatioPage,
});

type Mode = 'ratio' | 'safe';

function AspectRatioPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'ratio');

  const [presetId, setPresetId] = useState(ASPECT_PRESETS[3]!.id);
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [lastEdited, setLastEdited] = useState<'width' | 'height'>('width');

  const [safeId, setSafeId] = useState(SAFE_AREA_PRESETS[0]!.id);
  const [copied, setCopied] = useState(false);

  const preset =
    ASPECT_PRESETS.find((item) => item.id === presetId) ?? ASPECT_PRESETS[3]!;
  const safe =
    SAFE_AREA_PRESETS.find((item) => item.id === safeId) ??
    SAFE_AREA_PRESETS[0]!;

  const applyPreset = (id: string) => {
    const next = ASPECT_PRESETS.find((item) => item.id === id);
    if (!next) return;
    setPresetId(id);
    if (lastEdited === 'width') {
      setHeight(Math.round(heightFromWidth(width, next.width, next.height)));
    } else {
      setWidth(Math.round(widthFromHeight(height, next.width, next.height)));
    }
  };

  const onWidthChange = (value: number) => {
    setWidth(value);
    setLastEdited('width');
    setHeight(Math.round(heightFromWidth(value, preset.width, preset.height)));
  };

  const onHeightChange = (value: number) => {
    setHeight(value);
    setLastEdited('height');
    setWidth(Math.round(widthFromHeight(value, preset.width, preset.height)));
  };

  const simplified = useMemo(
    () => simplifyRatio(width, height),
    [width, height],
  );

  const box = contentBox(safe.width, safe.height, safe.insets);
  const scale = Math.min(280 / safe.width, 420 / safe.height);
  const frameW = safe.width * scale;
  const frameH = safe.height * scale;

  const envCss = `/* ${safe.label} */
padding-top: env(safe-area-inset-top); /* ${safe.insets.top}px */
padding-right: env(safe-area-inset-right); /* ${safe.insets.right}px */
padding-bottom: env(safe-area-inset-bottom); /* ${safe.insets.bottom}px */
padding-left: env(safe-area-inset-left); /* ${safe.insets.left}px */`;

  const previewStyle = {
    aspectRatio: `${Math.max(width, 1)} / ${Math.max(height, 1)}`,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('aspectRatio.title')}</h1>
      </div>
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList>
          <TabsTrigger value="ratio">{t('aspectRatio.ratio')}</TabsTrigger>
          <TabsTrigger value="safe">{t('aspectRatio.safe')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === 'ratio' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {ASPECT_PRESETS.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant={presetId === item.id ? 'default' : 'outline'}
                  onClick={() => applyPreset(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('aspectRatio.width')}</Label>
                <Input
                  type="number"
                  min={1}
                  value={width}
                  onChange={(event) =>
                    onWidthChange(Number(event.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('aspectRatio.height')}</Label>
                <Input
                  type="number"
                  min={1}
                  value={height}
                  onChange={(event) =>
                    onHeightChange(Number(event.target.value) || 0)
                  }
                />
              </div>
            </div>
            <div className="rounded-md border px-4 py-3 text-sm">
              <p>
                {t('aspectRatio.simplified')}:{' '}
                <span className="font-mono font-semibold">
                  {simplified.w}:{simplified.h}
                </span>
              </p>
              <p className="mt-1 text-muted-foreground">
                {width} × {height}
              </p>
            </div>
          </div>
          <div className="flex min-h-[280px] items-center justify-center rounded-lg border bg-muted/20 p-6">
            <div
              className="flex max-h-64 max-w-full items-center justify-center bg-primary/80 text-sm font-medium text-primary-foreground"
              style={{
                ...previewStyle,
                width: width >= height ? '100%' : 'auto',
                height: height > width ? '100%' : 'auto',
                maxWidth: '100%',
                maxHeight: '16rem',
              }}
            >
              {simplified.w}:{simplified.h}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SAFE_AREA_PRESETS.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant={safeId === item.id ? 'default' : 'outline'}
                  onClick={() => setSafeId(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {t('aspectRatio.device')}
                </p>
                <p className="font-mono">
                  {safe.width} × {safe.height}
                </p>
              </div>
              <div className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {t('aspectRatio.content')}
                </p>
                <p className="font-mono">
                  {box.width} × {box.height}
                </p>
              </div>
            </div>
            <div className="rounded-md border px-3 py-2 text-sm">
              <p className="mb-1 text-xs text-muted-foreground">
                {t('aspectRatio.insets')}
              </p>
              <p className="font-mono text-xs">
                T {safe.insets.top} / R {safe.insets.right} / B{' '}
                {safe.insets.bottom} / L {safe.insets.left}
              </p>
            </div>
            <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
              {envCss}
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                void navigator.clipboard.writeText(envCss).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                });
              }}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {t(copied ? 'aspectRatio.copied' : 'aspectRatio.copy')}
            </Button>
          </div>
          <div className="flex min-h-[360px] items-center justify-center rounded-lg border bg-muted/20 p-6">
            <div
              className="relative overflow-hidden rounded-[28px] border-2 border-foreground/80 bg-background shadow-lg"
              style={{ width: frameW, height: frameH }}
            >
              {/* insets overlay */}
              <div
                className="absolute inset-x-0 top-0 bg-amber-400/40"
                style={{ height: safe.insets.top * scale }}
              />
              <div
                className="absolute inset-x-0 bottom-0 bg-amber-400/40"
                style={{ height: safe.insets.bottom * scale }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-amber-400/40"
                style={{ width: safe.insets.left * scale }}
              />
              <div
                className="absolute inset-y-0 right-0 bg-amber-400/40"
                style={{ width: safe.insets.right * scale }}
              />
              <div
                className="absolute flex items-center justify-center border border-dashed border-primary/50 bg-primary/10 text-[10px] text-muted-foreground"
                style={{
                  top: safe.insets.top * scale,
                  right: safe.insets.right * scale,
                  bottom: safe.insets.bottom * scale,
                  left: safe.insets.left * scale,
                }}
              >
                {t('aspectRatio.safeArea')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
