import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { downloadBytes } from '@/lib/download';
import type { SequenceRequest } from '@/lib/stop-motion.worker';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceField, NumberField } from './calculator-ui';
import { DocumentUpload, useImageDocuments } from './image-document-inputs';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
const worker = () =>
  new Worker(
    new URL('../lib/stop-motion.worker.ts', import.meta.url),
    { type: 'module' },
  );
type Frame = { id: string; image: string; duration: number };
export default function Sequence() {
  const { t } = useTranslation(),
    label = (key: string) => t(`mediaWorkspace.${key}`);
  const documents = useImageDocuments();
  const [frames, setFrames] = useState<Frame[]>([]),
    [active, setActive] = useState(0),
    [playing, setPlaying] = useState(false);
  const seen = useRef(new Set<string>());
  const [q, setQ] = useQueryParams<{
    width: number;
    height: number;
    duration: number;
    format: string;
    onion: string;
  }>({
    width: NumberParam,
    height: NumberParam,
    duration: NumberParam,
    format: StringParam,
    onion: StringParam,
  });
  const width = q.width ?? 640,
    height = q.height ?? 480,
    duration = q.duration ?? 200,
    format = q.format === 'webm' ? 'webm' : 'gif';
  const job = useBoundedWorker<SequenceRequest, Uint8Array>(worker, 120000);
  useEffect(() => {
    const added = documents.images.filter((i) => !seen.current.has(i.id));
    if (added.length) {
      added.forEach((i) => seen.current.add(i.id));
      setFrames((old) => [
        ...old,
        ...added.map((i) => ({
          id: crypto.randomUUID(),
          image: i.id,
          duration,
        })),
      ]);
    }
  }, [documents.images, duration]);
  useEffect(() => {
    job.clear();
    setPlaying(false);
  }, [frames, width, height, format, job.clear]);
  useEffect(() => {
    if (!playing || !frames.length) return;
    const total = frames.reduce((s, f) => s + f.duration, 0);
    if (!Number.isFinite(total) || total <= 0) {
      setPlaying(false);
      return;
    }
    const started = performance.now();
    let id = 0;
    const step = (now: number) => {
      let elapsed = (now - started) % total,
        index = 0;
      while (index < frames.length - 1 && elapsed >= frames[index]!.duration) {
        elapsed -= frames[index]!.duration;
        index++;
      }
      setActive(index);
      id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [playing, frames]);
  const current = documents.images.find((i) => i.id === frames[active]?.image),
    previous = documents.images.find(
      (i) => i.id === frames[Math.max(0, active - 1)]?.image,
    );
  const move = (from: number, to: number) => {
    if (to < 0 || to >= frames.length) return;
    setFrames((old) => {
      const next = [...old];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
    setActive(to);
  };
  return (
    <div className="space-y-4">
      <DocumentUpload
        disabled={job.busy || documents.loading}
        onFiles={(files) => void documents.add(files)}
      />
      <p className="text-sm text-muted-foreground">{label('sequenceHint')}</p>
      <fieldset disabled={job.busy} className="min-w-0 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <NumberField
            label={label('width')}
            value={width}
            min={64}
            max={1920}
            step={1}
            onChange={(width) => setQ({ width })}
          />
          <NumberField
            label={label('height')}
            value={height}
            min={64}
            max={1920}
            step={1}
            onChange={(height) => setQ({ height })}
          />
          <NumberField
            label={label('frameDuration')}
            value={duration}
            min={20}
            max={10000}
            onChange={(duration) => setQ({ duration })}
          />
          <ChoiceField
            label={label('format')}
            value={format}
            options={[
              { value: 'gif', label: 'GIF' },
              { value: 'webm', label: 'WebM' },
            ]}
            onChange={(format) => setQ({ format })}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setFrames(frames.map((f) => ({ ...f, duration })))}
          >
            {label('applyDuration')}
          </Button>
          <Button
            variant="outline"
            disabled={!frames.length}
            onClick={() => setPlaying(!playing)}
          >
            {label(playing ? 'stop' : 'play')}
          </Button>
          <Label className="flex items-center gap-2">
            <Checkbox
              checked={q.onion === 'true'}
              onCheckedChange={(onion) =>
                setQ({ onion: String(onion === true) })
              }
            />
            {label('onion')}
          </Label>
        </div>
        {current && (
          <div className="relative flex h-80 items-center justify-center overflow-hidden rounded border bg-black">
            <img
              src={current.url}
              alt={current.name}
              className="h-full max-w-full object-contain"
            />
            {q.onion === 'true' && previous && active > 0 && (
              <img
                src={previous.url}
                alt=""
                className="absolute inset-0 h-full w-full object-contain opacity-40"
              />
            )}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          {frames.map((f, i) => {
            const image = documents.images.find((im) => im.id === f.image);
            return (
              <div
                key={f.id}
                className={`space-y-2 rounded border p-3 ${active === i ? 'border-primary' : ''}`}
              >
                <Button
                  variant="ghost"
                  className="h-auto w-full"
                  onClick={() => {
                    setPlaying(false);
                    setActive(i);
                  }}
                >
                  <img
                    src={image?.url}
                    alt={image?.name ?? ''}
                    className="h-24 max-w-full object-contain"
                  />
                </Button>
                <p className="truncate text-sm">
                  {i + 1}. {image?.name}
                </p>
                <NumberField
                  label={label('frameDuration')}
                  value={f.duration}
                  min={20}
                  max={10000}
                  onChange={(duration) =>
                    setFrames(
                      frames.map((fr) =>
                        fr.id === f.id ? { ...fr, duration } : fr,
                      ),
                    )
                  }
                />
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={i === frames.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={frames.length >= 120}
                    onClick={() => {
                      const next = [...frames];
                      next.splice(i + 1, 0, { ...f, id: crypto.randomUUID() });
                      setFrames(next);
                    }}
                  >
                    {label('duplicate')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFrames(frames.filter((fr) => fr.id !== f.id));
                      setActive(0);
                    }}
                  >
                    {label('remove')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={job.busy || !frames.length || documents.loading}
          onClick={() =>
            job.run({
              frames: frames.map((f) => ({
                blob: documents.images.find((i) => i.id === f.image)!.blob,
                duration: f.duration,
              })),
              width,
              height,
              format,
            })
          }
        >
          {label('generate')}
        </Button>
        {job.busy && (
          <Button variant="outline" onClick={job.cancel}>
            {label('cancel')}
          </Button>
        )}
        {job.result && (
          <Button
            onClick={() =>
              downloadBytes(
                job.result!,
                `sequence.${format}`,
                format === 'gif' ? 'image/gif' : 'video/webm',
              )
            }
          >
            {label('download')}
          </Button>
        )}
      </div>
      {job.busy && <p role="status">{label('processing')}</p>}
      {(job.error || documents.error) && (
        <p role="alert" className="text-destructive">
          {t('mediaWorkspace.failed', {
            msg:
              documents.error ||
              t(`mediaWorkspace.errors.${job.error}`, {
                defaultValue: job.error ?? '',
              }),
          })}
        </p>
      )}
    </div>
  );
}
