import {
  NumberParam,
  ArrayParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberField } from './calculator-ui';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
const worker = () =>
  new Worker(new URL('../lib/sheet-music.worker.ts', import.meta.url), {
    type: 'module',
  });
export default function ScoreViewer() {
  const { t } = useTranslation(),
    label = (key: string) => t(`mediaWorkspace.${key}`);
  const [q, setQ] = useQueryParams<{
    zoom: number;
    transpose: number;
    parts: string[];
  }>({ zoom: NumberParam, transpose: NumberParam, parts: ArrayParam });
  const job = useBoundedWorker<File, string>(worker, 15000);
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [parts, setParts] = useState<string[]>([]);
  const host = useRef<HTMLDivElement>(null),
    osmd = useRef<OpenSheetMusicDisplay | null>(null),
    generation = useRef(0);
  const zoom = Math.max(0.25, Math.min(2, q.zoom ?? 1)),
    transpose = Math.max(-24, Math.min(24, Math.round(q.transpose ?? 0)));
  const latestOptions = useRef({ zoom, transpose, parts: q.parts });
  latestOptions.current = { zoom, transpose, parts: q.parts };
  useEffect(() => {
    if (!job.result || !host.current) return;
    const id = ++generation.current;
    setError(null);
    setBusy(true);
    const container = document.createElement('div');
    container.className = 'w-full';
    host.current.replaceChildren(container);
    let instance: OpenSheetMusicDisplay | null = null;
    void (async () => {
      const xml = new DOMParser().parseFromString(
        job.result!,
        'application/xml',
      );
      if (
        xml.querySelector('parsererror') ||
        xml.documentElement.tagName !== 'score-partwise' ||
        xml.querySelectorAll('measure').length > 300 ||
        xml.querySelectorAll('note').length > 20000 ||
        xml.querySelectorAll('score-part').length > 32 ||
        xml.querySelector('script,iframe,credit-image')
      )
        throw new Error('scoreLimit');
      const module = await import('opensheetmusicdisplay');
      const { OpenSheetMusicDisplay, TransposeCalculator } = (
        'default' in module ? module.default : module
      ) as typeof module;
      if (id !== generation.current) return;
      instance = new OpenSheetMusicDisplay(container, {
        autoResize: false,
        backend: 'svg',
        drawTitle: true,
        pageFormat: 'A4_P',
      });
      instance.TransposeCalculator = new TransposeCalculator();
      await instance.load(xml);
      if (id !== generation.current) {
        instance.clear();
        return;
      }
      osmd.current = instance;
      const current = latestOptions.current;
      instance.Zoom = current.zoom;
      instance.Sheet.Transpose = current.transpose;
      const validParts =
        current.parts?.filter(
          (value) => instance!.Sheet.Instruments[Number(value)] !== undefined,
        ) ?? [];
      instance.Sheet.Instruments.forEach((instrument, i) => {
        instrument.Visible =
          !validParts.length || validParts.includes(String(i));
      });
      instance.render();
      setParts(
        instance.Sheet.Instruments.map(
          (instrument, i) => instrument.Name || `${label('part')} ${i + 1}`,
        ),
      );
    })()
      .catch((e) => {
        if (id === generation.current) setError((e as Error).message);
      })
      .finally(() => {
        if (id === generation.current) setBusy(false);
      });
    return () => {
      generation.current++;
      instance?.clear();
      osmd.current = null;
      container.remove();
    };
  }, [job.result]);
  useEffect(() => {
    const instance = osmd.current;
    if (!instance) return;
    try {
      const current = latestOptions.current;
      instance.Zoom = current.zoom;
      instance.Sheet.Transpose = current.transpose;
      const validParts =
        current.parts?.filter(
          (value) => instance!.Sheet.Instruments[Number(value)] !== undefined,
        ) ?? [];
      instance.Sheet.Instruments.forEach((instrument, i) => {
        instrument.Visible =
          !validParts.length || validParts.includes(String(i));
      });
      instance.updateGraphic();
      instance.render();
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [zoom, transpose, JSON.stringify(q.parts)]);
  function print() {
    if (!host.current) return;
    const popup = window.open('', '_blank');
    if (!popup) {
      setError('popup');
      return;
    }
    const doc = popup.document;
    doc.title = label('titles.score');
    const style = doc.createElement('style');
    style.textContent =
      '@page {size:A4 portrait;margin:10mm} body{margin:0;background:white} svg{max-width:100%;height:auto;break-inside:avoid} svg:not(:last-child){break-after:page}';
    doc.head.append(style);
    host.current
      .querySelectorAll('svg')
      .forEach((svg) => doc.body.append(doc.importNode(svg, true)));
    popup.focus();
    popup.print();
  }
  return (
    <div className="space-y-4">
      <Label htmlFor="score-file">{label('scoreFile')}</Label>
      <Input
        id="score-file"
        type="file"
        accept=".xml,.musicxml,.mxl"
        disabled={busy || job.busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setParts([]);
            setError(null);
            job.run(f);
          }
          e.target.value = '';
        }}
      />
      <p className="text-sm text-muted-foreground">{label('scoreHint')}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <NumberField
          label={label('zoom')}
          value={zoom}
          min={0.25}
          max={2}
          step={0.1}
          onChange={(zoom) => setQ({ zoom })}
        />
        <NumberField
          label={label('transpose')}
          value={transpose}
          min={-24}
          max={24}
          step={1}
          onChange={(transpose) => setQ({ transpose })}
        />
      </div>
      <div className="flex flex-wrap gap-4">
        {parts.map((part, i) => (
          <Label key={i} className="flex items-center gap-2">
            <Checkbox
              checked={!q.parts?.length || q.parts.includes(String(i))}
              onCheckedChange={(checked) => {
                const current = q.parts?.length
                  ? q.parts
                  : parts.map((_, i) => String(i));
                const next = checked
                  ? [...new Set([...current, String(i)])]
                  : current.filter((p) => p !== String(i));
                if (next.length) setQ({ parts: next });
              }}
            />
            {part}
          </Label>
        ))}
      </div>
      <Button
        variant="outline"
        disabled={!parts.length || busy || job.busy || !!error}
        onClick={print}
      >
        {label('print')}
      </Button>
      {(busy || job.busy) && <p role="status">{label('processing')}</p>}
      {(error || job.error) && (
        <p role="alert" className="text-destructive">
          {t('mediaWorkspace.failed', {
            msg: t(`mediaWorkspace.errors.${error || job.error}`, {
              defaultValue: error || job.error || '',
            }),
          })}
        </p>
      )}
      <div ref={host} className="overflow-x-auto rounded border bg-white p-3" />
    </div>
  );
}
