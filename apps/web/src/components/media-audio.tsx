import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import type { AudioTask, processAudio } from '@/lib/media-audio';
import { downloadBytes } from '@/lib/download';
import { NumberField, ChoiceField } from './calculator-ui';
import { FileDropzone } from './file-dropzone';
import { Button } from './ui/button';
const createWorker = () =>
  new Worker(new URL('../workers/media-audio.worker.ts', import.meta.url), {
    type: 'module',
  });
export function MediaAudio() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    normalize: string;
    peak: number;
    fadeIn: number;
    fadeOut: number;
    speed: number;
    channels: string;
    silence: number;
    minimum: number;
  }>({
    normalize: StringParam,
    peak: NumberParam,
    fadeIn: NumberParam,
    fadeOut: NumberParam,
    speed: NumberParam,
    channels: StringParam,
    silence: NumberParam,
    minimum: NumberParam,
  });
  const [source, setSource] = useState<{
      channels: Float32Array[];
      sampleRate: number;
      name: string;
      duration: number;
    } | null>(null),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [url, setUrl] = useState<string | null>(null);
  const revision = useRef(0),
    decoder = useRef<AudioContext | null>(null);
  const task = useBoundedWorker<AudioTask, ReturnType<typeof processAudio>>(
    createWorker,
    60000,
  );
  useEffect(() => {
    task.clear();
  }, [
    query.normalize,
    query.peak,
    query.fadeIn,
    query.fadeOut,
    query.speed,
    query.channels,
    query.silence,
    query.minimum,
    source,
    task.clear,
  ]);
  useEffect(() => {
    if (!task.result) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(
      new Blob([new Uint8Array(task.result.wav)], { type: 'audio/wav' }),
    );
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [task.result]);
  useEffect(
    () => () => {
      revision.current++;
      void decoder.current?.close().catch(() => undefined);
    },
    [],
  );
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('mediaWorkflow.audioLimit')}
      </p>
      <FileDropzone
        accept="audio/*"
        disabled={loading}
        onFiles={async (files) => {
          const file = files[0]?.file;
          if (!file) return;
          const ticket = ++revision.current;
          setLoading(true);
          setError(null);
          setSource(null);
          task.clear();
          let context: AudioContext | null = null;
          try {
            if (file.size > 40 * 1024 * 1024) throw new Error('limit');
            context = new AudioContext();
            decoder.current = context;
            const decoded = await context.decodeAudioData(
              await file.arrayBuffer(),
            );
            if (
              decoded.duration > 600 ||
              decoded.numberOfChannels > 2 ||
              decoded.length * decoded.numberOfChannels > 60_000_000
            )
              throw new Error('limit');
            if (ticket === revision.current)
              setSource({
                channels: Array.from(
                  { length: decoded.numberOfChannels },
                  (_, i) => decoded.getChannelData(i).slice(),
                ),
                sampleRate: decoded.sampleRate,
                name: file.name,
                duration: decoded.duration,
              });
          } catch (cause) {
            if (ticket === revision.current) setError((cause as Error).message);
          } finally {
            if (context?.state !== 'closed')
              await context?.close().catch(() => undefined);
            if (decoder.current === context) decoder.current = null;
            if (ticket === revision.current) setLoading(false);
          }
        }}
      >
        {t('audioEditor.select')}
      </FileDropzone>
      {source && (
        <p>
          {source.name} · {source.duration.toFixed(2)} s · {source.sampleRate}{' '}
          Hz · {source.channels.length} {t('mediaWorkflow.channels')}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <ChoiceField
          label={t('mediaWorkflow.normalize')}
          value={query.normalize ?? 'true'}
          options={['true', 'false'].map((value) => ({
            value,
            label: t(value === 'true' ? 'studio20.yes' : 'studio20.no'),
          }))}
          onChange={(normalize) => setQuery({ normalize })}
        />
        <NumberField
          label={t('mediaWorkflow.peak')}
          value={query.peak ?? -1}
          min={-30}
          max={0}
          onChange={(peak) => setQuery({ peak })}
        />
        <NumberField
          label={t('mediaWorkflow.speed')}
          value={query.speed ?? 1}
          min={0.25}
          max={4}
          onChange={(speed) => setQuery({ speed })}
        />
        <NumberField
          label={t('mediaWorkflow.fadeIn')}
          value={query.fadeIn ?? 0}
          onChange={(fadeIn) => setQuery({ fadeIn })}
        />
        <NumberField
          label={t('mediaWorkflow.fadeOut')}
          value={query.fadeOut ?? 0}
          onChange={(fadeOut) => setQuery({ fadeOut })}
        />
        <ChoiceField
          label={t('mediaWorkflow.channels')}
          value={query.channels ?? 'keep'}
          options={['keep', 'mono', 'left', 'right', 'swap'].map((value) => ({
            value,
            label: t(`mediaWorkflow.${value}`),
          }))}
          onChange={(channels) => setQuery({ channels })}
        />
        <NumberField
          label={t('mediaWorkflow.silenceDb')}
          value={query.silence ?? -45}
          min={-100}
          max={0}
          onChange={(silence) => setQuery({ silence })}
        />
        <NumberField
          label={t('mediaWorkflow.minSilence')}
          value={query.minimum ?? 0.5}
          min={0.02}
          onChange={(minimum) => setQuery({ minimum })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t('mediaWorkflow.speedNote')}
      </p>
      <div className="flex gap-2">
        <Button
          disabled={!source || task.busy || loading}
          onClick={() =>
            source &&
            task.run({
              ...source,
              options: {
                normalize: query.normalize !== 'false',
                peakDb: query.peak ?? -1,
                fadeIn: query.fadeIn ?? 0,
                fadeOut: query.fadeOut ?? 0,
                speed: query.speed ?? 1,
                channels: query.channels ?? 'keep',
                silenceDb: query.silence ?? -45,
                minSilence: query.minimum ?? 0.5,
              },
            })
          }
        >
          {t('studio20.run')}
        </Button>
        {(task.busy || loading) && (
          <Button
            variant="outline"
            onClick={() => {
              revision.current++;
              setLoading(false);
              void decoder.current?.close().catch(() => undefined);
              task.cancel();
            }}
          >
            {t('studio20.cancel')}
          </Button>
        )}
      </div>
      {task.result && (
        <>
          {url && <audio controls src={url} className="w-full" />}
          <Button
            onClick={() =>
              task.result &&
              downloadBytes(task.result.wav, 'edited.wav', 'audio/wav')
            }
          >
            {t('studio20.download')} WAV
          </Button>
          <p>
            {t('mediaWorkflow.sourcePeak')}:{' '}
            {task.result.peakDb?.toFixed(2) ?? '−∞'} dBFS
          </p>
          <h3>{t('mediaWorkflow.silenceRanges')}</h3>
          <div className="max-h-60 overflow-auto font-mono text-sm">
            {task.result.silence.length
              ? task.result.silence.map((range, i) => (
                  <p key={i}>
                    {range.start.toFixed(2)}–{range.end.toFixed(2)} s
                  </p>
                ))
              : t('studio20.none')}
          </div>
        </>
      )}
      {(error || task.error) && (
        <p className="text-destructive" role="alert">
          {t('mediaWorkflow.failed', {
            message: t(`mediaWorkflow.${error ?? task.error}`, {
              defaultValue: error ?? task.error ?? '',
            }),
          })}
        </p>
      )}
    </section>
  );
}
