import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { downloadBlob } from '@/lib/download';
import type { AudioAnalysis } from '@/lib/batch4-media-analysis';
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
export default function AudioAnalyzer() {
  const { t } = useTranslation();
  const job = useBoundedWorker<
    { type: 'audio'; channels: Float32Array[]; sampleRate: number },
    AudioAnalysis
  >(createWorker, 20000);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null),
    [decoding, setDecoding] = useState(false);
  const ticket = useRef(0);
  const context = useRef<AudioContext | null>(null);
  useEffect(
    () => () => {
      ticket.current++;
      void context.current?.close();
    },
    [],
  );
  async function load(file: File) {
    const id = ++ticket.current;
    job.clear();
    setError(null);
    setDecoding(true);
    try {
      if (file.size > 100_000_000) throw new Error('limit');
      const ctx = new AudioContext();
      context.current = ctx;
      try {
        const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
        if (id !== ticket.current) return;
        job.run({
          type: 'audio',
          channels: Array.from({ length: buffer.numberOfChannels }, (_, i) =>
            buffer.getChannelData(i),
          ),
          sampleRate: buffer.sampleRate,
        });
      } finally {
        await ctx.close();
        if (context.current === ctx) context.current = null;
      }
    } catch (e) {
      if (id === ticket.current) setError((e as Error).message);
    } finally {
      if (id === ticket.current) setDecoding(false);
    }
  }
  const result = job.result;
  useEffect(() => {
    if (!result || !canvas.current) return;
    const c = canvas.current;
    c.width = result.spectrogram.length;
    c.height = 512;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const image = ctx.createImageData(c.width, c.height);
    result.spectrogram.forEach((frame, x) =>
      frame.forEach((db, y) => {
        const value = Math.max(0, Math.min(1, (db + 100) / 100)),
          i = ((511 - y) * c.width + x) * 4;
        image.data[i] = Math.round(255 * value);
        image.data[i + 1] = Math.round(255 * value ** 3);
        image.data[i + 2] = Math.round(150 * Math.sin(Math.PI * value));
        image.data[i + 3] = 255;
      }),
    );
    ctx.putImageData(image, 0, 0);
  }, [result]);
  return (
    <div className="space-y-4">
      <Label htmlFor="analysis-file">{t('batch4Media.audioFile')}</Label>
      <Input
        id="analysis-file"
        type="file"
        accept="audio/*"
        disabled={decoding || job.busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void load(f);
          e.target.value = '';
        }}
      />
      <p className="text-sm text-muted-foreground">
        {t('batch4Media.audioLimit')}
      </p>
      {(decoding || job.busy) && (
        <p role="status">{t('batch4Media.loading')}</p>
      )}
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
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ['duration', result.duration.toFixed(2) + ' s'],
                ['rms', result.rmsDb?.toFixed(2) ?? '−∞'],
                ['peak', result.peakDb?.toFixed(2) ?? '−∞'],
                ['clipping', result.clipped],
                ['correlation', result.correlation?.toFixed(4) ?? '—'],
                ['sampleRate', result.sampleRate + ' Hz'],
              ] as const
            ).map(([label, value]) => (
              <div className="rounded-lg border p-3" key={label}>
                <p className="text-sm text-muted-foreground">
                  {t(`batch4Media.${label}`)}
                </p>
                <p className="font-mono text-lg">{value}</p>
              </div>
            ))}
          </div>
          <h2 className="font-semibold">{t('batch4Media.spectrum')}</h2>
          <svg
            viewBox="0 0 800 220"
            className="w-full rounded border bg-muted/20"
            role="img"
            aria-label={t('batch4Media.spectrum')}
          >
            <path
              d={result.spectrum
                .map(
                  (v, i) =>
                    `${i ? 'L' : 'M'}${(i / 511) * 760 + 30},${10 - v * 1.8}`,
                )
                .join(' ')}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="1.5"
            />
            <text x="30" y="212" fontSize="12" fill="currentColor">
              0 Hz
            </text>
            <text x="660" y="212" fontSize="12" fill="currentColor">
              {result.sampleRate / 2} Hz
            </text>
            <text x="32" y="22" fontSize="12" fill="currentColor">
              0 dBFS
            </text>
            <text x="32" y="188" fontSize="12" fill="currentColor">
              −100 dBFS
            </text>
          </svg>
          <h2 className="font-semibold">{t('batch4Media.spectrogram')}</h2>
          <canvas
            ref={canvas}
            className="h-64 w-full rounded border"
            aria-label={t('batch4Media.spectrogram')}
          />
          <p className="text-sm">
            {t('batch4Media.spectrogramAxes', {
              duration: result.duration.toFixed(2),
              frequency: result.sampleRate / 2,
            })}
          </p>
          <Button
            onClick={() =>
              downloadBlob(
                new Blob(
                  [
                    JSON.stringify(
                      { ...result, spectrogram: undefined },
                      null,
                      2,
                    ),
                  ],
                  { type: 'application/json' },
                ),
                'audio-analysis.json',
              )
            }
          >
            {t('batch4Media.report')}
          </Button>
        </>
      )}
    </div>
  );
}
