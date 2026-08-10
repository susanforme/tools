import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  borderRadiusCss,
  boxShadowCss,
  type RadiusCorners,
} from '@/lib/css-effects';
import { createFileRoute } from '@tanstack/react-router';
import { Check, Copy, Link2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Slider } from '../components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

export const Route = createFileRoute('/css-shadow')({
  component: CssShadowPage,
});

type Mode = 'shadow' | 'radius';
type Unit = 'px' | '%';

function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <Label>{label}</Label>
        <span className="font-mono text-muted-foreground">{value}</span>
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

function CopyCssButton({ css }: { css: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5"
      disabled={!css}
      onClick={() => {
        void navigator.clipboard.writeText(css).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {t(copied ? 'cssShadow.copied' : 'cssShadow.copy')}
    </Button>
  );
}

function CssShadowPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'shadow');

  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(8);
  const [blur, setBlur] = useState(24);
  const [spread, setSpread] = useState(0);
  const [color, setColor] = useState('rgba(0,0,0,0.18)');
  const [inset, setInset] = useState(false);

  const [linked, setLinked] = useState(true);
  const [unit, setUnit] = useState<Unit>('px');
  const [corners, setCorners] = useState<RadiusCorners>({
    topLeft: 16,
    topRight: 16,
    bottomRight: 16,
    bottomLeft: 16,
  });

  const shadowCss = `box-shadow: ${boxShadowCss([
    { inset, offsetX, offsetY, blur, spread, color },
  ])};`;
  const radiusValue = borderRadiusCss(corners, unit);
  const radiusCss = `border-radius: ${radiusValue};`;

  const setCorner = (key: keyof RadiusCorners, value: number) => {
    if (linked) {
      setCorners({
        topLeft: value,
        topRight: value,
        bottomRight: value,
        bottomLeft: value,
      });
      return;
    }
    setCorners((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('cssShadow.title')}</h1>
      </div>
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList>
          <TabsTrigger value="shadow">{t('cssShadow.shadow')}</TabsTrigger>
          <TabsTrigger value="radius">{t('cssShadow.radius')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === 'shadow' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <RangeField
              label={t('cssShadow.offsetX')}
              value={offsetX}
              min={-50}
              max={50}
              onChange={setOffsetX}
            />
            <RangeField
              label={t('cssShadow.offsetY')}
              value={offsetY}
              min={-50}
              max={50}
              onChange={setOffsetY}
            />
            <RangeField
              label={t('cssShadow.blur')}
              value={blur}
              min={0}
              max={100}
              onChange={setBlur}
            />
            <RangeField
              label={t('cssShadow.spread')}
              value={spread}
              min={-50}
              max={50}
              onChange={setSpread}
            />
            <div className="space-y-1.5">
              <Label>{t('cssShadow.color')}</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#000000'}
                  aria-label={t('cssShadow.color')}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-9 w-10 cursor-pointer rounded-md border bg-background p-1"
                />
                <Input
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={inset}
                onCheckedChange={(checked) => setInset(checked === true)}
              />
              {t('cssShadow.inset')}
            </label>
            <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
              {shadowCss}
            </pre>
            <CopyCssButton css={shadowCss} />
          </div>
          <div className="flex min-h-[280px] items-center justify-center rounded-lg border bg-[linear-gradient(45deg,#f0f0f0_25%,transparent_25%),linear-gradient(-45deg,#f0f0f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f0f0f0_75%),linear-gradient(-45deg,transparent_75%,#f0f0f0_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] dark:bg-muted/20">
            <div
              className="h-36 w-36 rounded-xl bg-background"
              style={{
                boxShadow: boxShadowCss([
                  { inset, offsetX, offsetY, blur, spread, color },
                ]),
              }}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={linked}
                  onCheckedChange={(checked) => setLinked(checked === true)}
                />
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                {t('cssShadow.linked')}
              </label>
              <Tabs
                value={unit}
                onValueChange={(value) => setUnit(value as Unit)}
              >
                <TabsList>
                  <TabsTrigger value="px">px</TabsTrigger>
                  <TabsTrigger value="%">%</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {(
              [
                ['topLeft', t('cssShadow.topLeft')],
                ['topRight', t('cssShadow.topRight')],
                ['bottomRight', t('cssShadow.bottomRight')],
                ['bottomLeft', t('cssShadow.bottomLeft')],
              ] as const
            ).map(([key, label]) => (
              <RangeField
                key={key}
                label={label}
                value={corners[key]}
                min={0}
                max={unit === '%' ? 50 : 80}
                onChange={(value) => setCorner(key, value)}
              />
            ))}
            <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
              {radiusCss}
            </pre>
            <CopyCssButton css={radiusCss} />
          </div>
          <div className="flex min-h-[280px] items-center justify-center rounded-lg border bg-muted/20">
            <div
              className="h-40 w-40 bg-primary/80"
              style={{ borderRadius: radiusValue }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
