import { NumberParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob, downloadBytes } from '@/lib/download';
import {
  seekStoryboardFrame,
  storyboardTimes,
  videoTimecode,
} from '@/lib/batch4-media-storyboard';
import { printLines, sheetImages, studySheet } from '@/lib/study-print';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberField } from './calculator-ui';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
type Frame = { id: string; time: number; image: string; note: string };
export default function Storyboard() {
  const { t } = useTranslation();
  const [source, setSource] = useState<string | null>(null),
    [frames, setFrames] = useState<Frame[]>([]),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [duration, setDuration] = useState(0),
    [progress, setProgress] = useState(0);
  const [interval, setInterval] = useQueryParam<number>(
    'interval',
    NumberParam,
    10,
  );
  const video = useRef<HTMLVideoElement>(null),
    url = useRef<string | null>(null),
    abort = useRef<AbortController | null>(null),
    ticket = useRef(0);
  useEffect(
    () => () => {
      ticket.current++;
      abort.current?.abort();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  function load(file: File) {
    ticket.current++;
    abort.current?.abort();
    setError(null);
    setBusy(false);
    if (file.size > 1_000_000_000) {
      setError('limit');
      return;
    }
    if (url.current) URL.revokeObjectURL(url.current);
    const next = URL.createObjectURL(file);
    url.current = next;
    setSource(next);
    setDuration(0);
    setFrames([]);
  }
  function capture(): Frame {
    const v = video.current;
    if (!v || v.readyState < 2 || !v.videoWidth) throw new Error('video');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 960 / v.videoWidth, 540 / v.videoHeight);
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL('image/jpeg', 0.86);
    canvas.width = canvas.height = 0;
    return { id: crypto.randomUUID(), time: v.currentTime, image, note: '' };
  }
  async function extract() {
    const v = video.current;
    if (!v) return;
    setError(null);
    const id = ++ticket.current;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setProgress(0);
    try {
      const times = storyboardTimes(duration, interval);
      const next: Frame[] = [];
      v.pause();
      for (const [i, time] of times.entries()) {
        await seekStoryboardFrame(v, time, controller.signal);
        if (id !== ticket.current) return;
        next.push(capture());
        setProgress((i + 1) / times.length);
      }
      setFrames(next);
    } catch (e) {
      if (id === ticket.current) setError((e as Error).message);
    } finally {
      if (id === ticket.current) setBusy(false);
      if (abort.current === controller) abort.current = null;
    }
  }
  async function sheets() {
    const images: string[] = [];
    for (let offset = 0; offset < frames.length; offset += 6) {
      const sheet = studySheet(),
        ctx = sheet.context;
      ctx.font = '6px sans-serif';
      ctx.fillText(t('batch4Media.titles.storyboard'), 12, 9);
      const rows = frames.slice(offset, offset + 6);
      for (const [i, frame] of rows.entries()) {
        const x = 12 + (i % 2) * 96,
          y = 24 + Math.floor(i / 2) * 87;
        const image = new Image();
        image.src = frame.image;
        await image.decode();
        const scale = Math.min(89 / image.width, 58 / image.height);
        ctx.drawImage(
          image,
          x + (89 - image.width * scale) / 2,
          y,
          image.width * scale,
          image.height * scale,
        );
        ctx.font = '3.5px monospace';
        ctx.fillText(
          `${offset + i + 1} · ${videoTimecode(frame.time)}`,
          x,
          y + 60,
        );
        const lines = printLines(ctx, frame.note, 89, 3.3);
        for (let j = 0; j < Math.min(5, lines.length); j++)
          ctx.fillText(lines[j]!, x, y + 66 + j * 3.5);
      }
      images.push(...sheetImages([sheet]));
    }
    return images;
  }
  async function exportBook(format: 'pdf' | 'png') {
    const id = ++ticket.current;
    setBusy(true);
    setError(null);
    try {
      const images = await sheets();
      if (id !== ticket.current) return;
      if (format === 'pdf') {
        const { PDFDocument } = await import('pdf-lib');
        const pdf = await PDFDocument.create();
        for (const image of images) {
          const embedded = await pdf.embedPng(image);
          const page = pdf.addPage([595.28, 841.89]);
          page.drawImage(embedded, {
            x: 0,
            y: 0,
            width: 595.28,
            height: 841.89,
          });
        }
        const bytes = await pdf.save();
        if (id === ticket.current)
          downloadBytes(bytes, 'storyboard.pdf', 'application/pdf');
      } else {
        const blobs = await Promise.all(
          images.map((image) => fetch(image).then((r) => r.blob())),
        );
        if (blobs.length === 1) downloadBlob(blobs[0]!, 'storyboard.png');
        else {
          const { zip } = await import('fflate');
          const files: Record<string, Uint8Array> = {};
          for (const [i, blob] of blobs.entries())
            files[`storyboard-${String(i + 1).padStart(2, '0')}.png`] =
              new Uint8Array(await blob.arrayBuffer());
          const bytes = await new Promise<Uint8Array>((resolve, reject) =>
            zip(files, { level: 0 }, (e, data) =>
              e ? reject(e) : resolve(data),
            ),
          );
          if (id === ticket.current)
            downloadBytes(bytes, 'storyboard-pages.zip', 'application/zip');
        }
      }
    } catch (e) {
      if (id === ticket.current) setError((e as Error).message);
    } finally {
      if (id === ticket.current) setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <Label htmlFor="storyboard-file">{t('batch4Media.videoFile')}</Label>
      <Input
        id="storyboard-file"
        type="file"
        accept="video/*"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) load(f);
          e.target.value = '';
        }}
      />
      <p className="text-sm text-muted-foreground">
        {t('batch4Media.videoLimit')}
      </p>
      {source && (
        <video
          ref={video}
          src={source}
          controls={!busy}
          muted
          playsInline
          className="max-h-[420px] w-full rounded-lg bg-black"
          onLoadedMetadata={(e) =>
            setDuration(
              Number.isFinite(e.currentTarget.duration)
                ? e.currentTarget.duration
                : 0,
            )
          }
          onError={() => setError('video')}
        />
      )}
      <NumberField
        label={t('batch4Media.frameInterval')}
        value={interval}
        min={0.1}
        max={36000}
        onChange={setInterval}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !duration} onClick={() => void extract()}>
          {t('batch4Media.extract')}
        </Button>
        <Button
          variant="outline"
          disabled={busy || !duration || frames.length >= 60}
          onClick={() => {
            try {
              setFrames([...frames, capture()].sort((a, b) => a.time - b.time));
              setError(null);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {t('batch4Media.capture')}
        </Button>
        <Button
          variant="outline"
          disabled={!frames.length || busy}
          onClick={() => void exportBook('pdf')}
        >
          {t('batch4Media.exportPdf')}
        </Button>
        <Button
          variant="outline"
          disabled={!frames.length || busy}
          onClick={() => void exportBook('png')}
        >
          {t('batch4Media.exportPng')}
        </Button>
        {busy && (
          <Button
            variant="outline"
            onClick={() => {
              ticket.current++;
              abort.current?.abort();
              setBusy(false);
            }}
          >
            {t('batch4Media.cancel')}
          </Button>
        )}
      </div>
      {busy && <progress max={1} value={progress} className="w-full" />}
      {error && (
        <p role="alert" className="text-destructive">
          {t('batch4Media.failed', {
            msg: t(`batch4Media.errors.${error}`, { defaultValue: error }),
          })}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {frames.map((frame, i) => (
          <div className="space-y-2 rounded-lg border p-3" key={frame.id}>
            <img
              src={frame.image}
              alt={`${i + 1} · ${videoTimecode(frame.time)}`}
              className="aspect-video w-full object-contain"
            />
            <p className="font-mono text-sm">
              {i + 1} · {videoTimecode(frame.time)}
            </p>
            <Label htmlFor={`frame-${frame.id}`}>{t('batch4Media.note')}</Label>
            <Textarea
              id={`frame-${frame.id}`}
              value={frame.note}
              maxLength={200}
              disabled={busy}
              onChange={(e) =>
                setFrames(
                  frames.map((f) =>
                    f.id === frame.id ? { ...f, note: e.target.value } : f,
                  ),
                )
              }
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setFrames(frames.filter((f) => f.id !== frame.id))}
            >
              {t('batch4Media.remove')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
