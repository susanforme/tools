import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import { transformSvgPath } from '@/lib/svg-path-workbench';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function SvgPathPanel() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    pathX: number;
    pathY: number;
    pathScale: number;
    pathRotate: number;
    pathMode: string;
  }>({
    pathX: NumberParam,
    pathY: NumberParam,
    pathScale: NumberParam,
    pathRotate: NumberParam,
    pathMode: StringParam,
  });
  const [input, setInput] = useState(
    'M10 80 C40 10 65 10 95 80 S150 150 180 80',
  );
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState({
    length: 0,
    bounds: '',
    viewBox: '0 0 200 200',
  });
  const pathRef = useRef<SVGPathElement>(null);
  const epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  useEffect(() => {
    if (!output || !pathRef.current) return;
    try {
      const box = pathRef.current.getBBox();
      const pad = Math.max(box.width, box.height, 1) * 0.08;
      const length = pathRef.current.getTotalLength();
      if (![box.x, box.y, box.width, box.height, length].every(Number.isFinite))
        throw new Error('INVALID');
      setMetrics({
        length,
        bounds: [box.x, box.y, box.width, box.height]
          .map((v) => v.toFixed(2))
          .join(', '),
        viewBox: `${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`,
      });
    } catch (cause) {
      setError((cause as Error).message);
      setOutput('');
    }
  }, [output]);
  function invalidate() {
    epoch.current++;
    setOutput('');
    setError(null);
    setBusy(false);
  }
  async function run() {
    invalidate();
    const version = epoch.current;
    setBusy(true);
    try {
      const next = await transformSvgPath(input, {
        x: query.pathX ?? 0,
        y: query.pathY ?? 0,
        scale: query.pathScale ?? 1,
        rotate: query.pathRotate ?? 0,
        mode: query.pathMode ?? 'absolute',
      });
      if (epoch.current === version) setOutput(next);
    } catch (cause) {
      if (epoch.current === version) setError((cause as Error).message);
    } finally {
      if (epoch.current === version) setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('communityVisual.path.limit')}
      </p>
      <Label htmlFor="svg-path-input">{t('communityVisual.path.source')}</Label>
      <Textarea
        id="svg-path-input"
        className="min-h-32 font-mono"
        value={input}
        onChange={(e) => {
          invalidate();
          setInput(e.target.value);
        }}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(
          [
            ['pathX', 'x', 0],
            ['pathY', 'y', 0],
            ['pathScale', 'scale', 1],
            ['pathRotate', 'rotate', 0],
          ] as const
        ).map(([key, label, fallback]) => (
          <div className="space-y-2" key={key}>
            <Label htmlFor={key}>{t(`communityVisual.path.${label}`)}</Label>
            <Input
              id={key}
              type="number"
              value={query[key] ?? fallback}
              onChange={(e) => {
                invalidate();
                setQuery({ [key]: e.target.valueAsNumber });
              }}
            />
          </div>
        ))}
        <div className="space-y-2">
          <Label>{t('communityVisual.path.mode')}</Label>
          <Select
            value={query.pathMode === 'relative' ? 'relative' : 'absolute'}
            onValueChange={(value) => {
              invalidate();
              setQuery({ pathMode: value });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="absolute">
                {t('communityVisual.path.absolute')}
              </SelectItem>
              <SelectItem value="relative">
                {t('communityVisual.path.relative')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button disabled={busy} onClick={() => void run()}>
        {t(busy ? 'communityVisual.loading' : 'communityVisual.run')}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t('communityVisual.failed', {
            msg: t(`communityVisual.errors.${error}`, { defaultValue: error }),
          })}
        </p>
      )}
      {output && (
        <>
          <svg
            role="img"
            aria-label={t('communityVisual.path.preview')}
            viewBox={metrics.viewBox}
            className="h-72 w-full rounded-md border bg-muted/30"
          >
            <path
              ref={pathRef}
              d={output}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <p className="break-all text-sm">
            {t('communityVisual.path.length')}: {metrics.length.toFixed(3)} ·{' '}
            {t('communityVisual.path.bounds')}: {metrics.bounds}
          </p>
          <Textarea
            readOnly
            value={output}
            className="font-mono"
            aria-label={t('communityVisual.output')}
          />
          <Button
            variant="outline"
            onClick={() =>
              downloadBlob(
                new Blob(
                  [
                    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${metrics.viewBox}"><path d="${output}" fill="none" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`,
                  ],
                  { type: 'image/svg+xml' },
                ),
                'path.svg',
              )
            }
          >
            {t('communityVisual.download')}
          </Button>
        </>
      )}
    </div>
  );
}
