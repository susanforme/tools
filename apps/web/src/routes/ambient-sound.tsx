import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberParam, useQueryParams } from '@/hooks/useQueryParams';
import {
  boundedNumber,
  createNoiseSamples,
  DEFAULT_LEVELS,
  formatClock,
  parseMix,
  SOUND_TRACKS,
  type SoundLevels,
  type SoundTrack,
} from '@/lib/focus-tools';
import { createFileRoute } from '@tanstack/react-router';
import {
  CloudRain,
  Coffee,
  LoaderCircle,
  Pause,
  Play,
  Save,
  Trash2,
  Volume2,
  Wind,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/ambient-sound')({
  component: AmbientSoundPage,
});
const PARAMS = {
  rain: NumberParam,
  wind: NumberParam,
  cafe: NumberParam,
  white: NumberParam,
  pink: NumberParam,
  brown: NumberParam,
  sleep: NumberParam,
};
const STORAGE_KEY = 'tools.ambient-mixes.v1';
type SavedMix = { name: string; levels: SoundLevels };
type AudioRuntime = {
  context: AudioContext;
  master: GainNode;
  compressor: DynamicsCompressorNode;
  tracks: Map<SoundTrack, { gain: GainNode; source: AudioBufferSourceNode }>;
  pending: Set<SoundTrack>;
  abort: AbortController;
};

function AmbientSoundPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<SoundLevels & { sleep: number }>(
    PARAMS,
  );
  const levels = Object.fromEntries(
    SOUND_TRACKS.map((track) => [
      track,
      boundedNumber(query[track], DEFAULT_LEVELS[track], 0, 100),
    ]),
  ) as SoundLevels;
  const sleep = boundedNumber(query.sleep, 0, 0, 720);
  const levelsRef = useRef(levels);
  levelsRef.current = levels;
  const runtimeRef = useRef<AudioRuntime | null>(null);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState<SoundTrack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedMix[]>([]);
  const [mixName, setMixName] = useState('');
  const [savedReady, setSavedReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [sleepEnd, setSleepEnd] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? '[]',
      );
      if (Array.isArray(stored))
        setSaved(
          stored.slice(0, 20).flatMap((item: unknown) => {
            if (typeof item !== 'object' || item === null) return [];
            const record = item as Record<string, unknown>;
            const mix = parseMix(record.levels);
            return typeof record.name === 'string' && record.name.trim() && mix
              ? [{ name: record.name.slice(0, 60), levels: mix }]
              : [];
          }),
        );
    } catch {
      /* 旧数据损坏时仍可使用播放器。 */
    }
    setSavedReady(true);
    return () => {
      mountedRef.current = false;
      const runtime = runtimeRef.current;
      runtimeRef.current = null;
      if (!runtime) return;
      runtime.abort.abort();
      for (const { source, gain } of runtime.tracks.values()) {
        source.stop();
        source.disconnect();
        gain.disconnect();
      }
      runtime.master.disconnect();
      runtime.compressor.disconnect();
      if (runtime.context.state !== 'closed') void runtime.context.close();
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!playing || !runtime) return;
    for (const track of SOUND_TRACKS) {
      const existing = runtime.tracks.get(track);
      if (existing) {
        existing.gain.gain.setTargetAtTime(
          levels[track] / 100,
          runtime.context.currentTime,
          0.05,
        );
        continue;
      }
      if (levels[track] <= 0 || runtime.pending.has(track)) continue;
      runtime.pending.add(track);
      setLoading([...runtime.pending]);
      void (async () => {
        try {
          let buffer: AudioBuffer;
          if (track === 'white' || track === 'pink' || track === 'brown') {
            buffer = runtime.context.createBuffer(
              1,
              runtime.context.sampleRate * 10,
              runtime.context.sampleRate,
            );
            buffer.copyToChannel(createNoiseSamples(track, buffer.length), 0);
          } else {
            const response = await fetch(`/audio/ambient/${track}.mp3`, {
              signal: runtime.abort.signal,
            });
            if (!response.ok)
              throw new Error(
                t('ambientSound.loadFailed', {
                  name: t(`ambientSound.${track}`),
                }),
              );
            buffer = await runtime.context.decodeAudioData(
              await response.arrayBuffer(),
            );
          }
          if (runtime.abort.signal.aborted || runtimeRef.current !== runtime)
            return;
          const source = runtime.context.createBufferSource();
          const gain = runtime.context.createGain();
          source.buffer = buffer;
          source.loop = true;
          gain.gain.value = 0;
          gain.gain.setTargetAtTime(
            levelsRef.current[track] / 100,
            runtime.context.currentTime,
            0.1,
          );
          source.connect(gain);
          gain.connect(runtime.master);
          source.start();
          runtime.tracks.set(track, { source, gain });
        } catch (cause) {
          if (!runtime.abort.signal.aborted && mountedRef.current)
            setError(
              t('focusTools.operationFailed', {
                message: (cause as Error).message,
              }),
            );
        } finally {
          runtime.pending.delete(track);
          if (mountedRef.current && runtimeRef.current === runtime)
            setLoading([...runtime.pending]);
        }
      })();
    }
  }, [
    playing,
    levels.rain,
    levels.wind,
    levels.cafe,
    levels.white,
    levels.pink,
    levels.brown,
    t,
  ]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!playing || !runtime) {
      setSleepEnd(null);
      return;
    }
    const current = Date.now();
    const deadline = sleep > 0 ? current + sleep * 60_000 : null;
    setSleepEnd(deadline);
    setNow(current);
    runtime.master.gain.cancelScheduledValues(runtime.context.currentTime);
    runtime.master.gain.setValueAtTime(0.3, runtime.context.currentTime);
    if (deadline === null) return;
    const seconds = sleep * 60;
    runtime.master.gain.setValueAtTime(
      0.3,
      runtime.context.currentTime + Math.max(0, seconds - 3),
    );
    runtime.master.gain.linearRampToValueAtTime(
      0,
      runtime.context.currentTime + seconds,
    );
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (time >= deadline) {
        setPlaying(false);
        setNotice(t('ambientSound.sleepFinished'));
        void runtime.context.suspend().catch(() => {});
      }
    };
    const interval = window.setInterval(tick, 500);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [playing, sleep, t]);

  const togglePlaying = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStarting(true);
    setError(null);
    setNotice('');
    try {
      let runtime = runtimeRef.current;
      if (!runtime) {
        const context = new AudioContext();
        const master = context.createGain();
        master.gain.value = 0.3;
        const compressor = context.createDynamicsCompressor();
        master.connect(compressor);
        compressor.connect(context.destination);
        runtime = {
          context,
          master,
          compressor,
          tracks: new Map(),
          pending: new Set(),
          abort: new AbortController(),
        };
        runtimeRef.current = runtime;
      }
      if (playing) await runtime.context.suspend();
      else await runtime.context.resume();
      if (mountedRef.current && runtimeRef.current === runtime)
        setPlaying(!playing);
    } catch (cause) {
      if (mountedRef.current)
        setError(
          t('focusTools.operationFailed', {
            message: (cause as Error).message,
          }),
        );
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setStarting(false);
    }
  };
  const saveMixes = (mixes: SavedMix[]) => {
    setError(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mixes));
      setSaved(mixes);
    } catch (cause) {
      setError(
        t('focusTools.operationFailed', { message: (cause as Error).message }),
      );
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('ambientSound.title')}</h1>
      <div className="flex flex-wrap items-end gap-4">
        <Button disabled={starting} onClick={() => void togglePlaying()}>
          {starting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {t(playing ? 'focusTools.pause' : 'focusTools.start')}
        </Button>
        <div className="space-y-2">
          <Label htmlFor="ambient-sleep">{t('ambientSound.sleep')}</Label>
          <Input
            id="ambient-sleep"
            type="number"
            min={0}
            max={720}
            step={1}
            value={sleep}
            onChange={(event) =>
              setQuery({ sleep: Number(event.target.value) })
            }
            className="w-32"
          />
        </div>
        {sleepEnd !== null && (
          <p
            role="timer"
            aria-label={t('ambientSound.sleepRemaining')}
            className="font-mono tabular-nums"
          >
            {formatClock(Math.max(0, sleepEnd - now), true)}
          </p>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {SOUND_TRACKS.map((track) => {
          const Icon =
            track === 'rain'
              ? CloudRain
              : track === 'wind'
                ? Wind
                : track === 'cafe'
                  ? Coffee
                  : Volume2;
          return (
            <Card key={track}>
              <CardContent className="space-y-6 pt-6">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <Label id={`ambient-${track}-label`} className="flex-1">
                    {t(`ambientSound.${track}`)}
                  </Label>
                  {loading.includes(track) && (
                    <LoaderCircle
                      aria-label={t('ambientSound.loading')}
                      className="h-4 w-4 animate-spin"
                    />
                  )}
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {levels[track]}%
                  </span>
                </div>
                <Input
                  type="range"
                  className="h-5 cursor-pointer border-0 px-0 accent-primary shadow-none"
                  aria-labelledby={`ambient-${track}-label`}
                  min={0}
                  max={100}
                  step={1}
                  value={levels[track]}
                  onChange={(event) =>
                    setQuery({ [track]: Number(event.target.value) })
                  }
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="space-y-4 rounded-xl border p-4">
        <h2 className="font-semibold">{t('ambientSound.savedMixes')}</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!mixName.trim() || saved.length >= 20) return;
            saveMixes([
              ...saved.filter((item) => item.name !== mixName.trim()),
              { name: mixName.trim(), levels },
            ]);
            setMixName('');
          }}
        >
          <Input
            aria-label={t('ambientSound.mixName')}
            placeholder={t('ambientSound.mixName')}
            maxLength={60}
            value={mixName}
            onChange={(event) => setMixName(event.target.value)}
            className="max-w-xs"
          />
          <Button
            variant="outline"
            disabled={!savedReady || !mixName.trim() || saved.length >= 20}
          >
            <Save className="h-4 w-4" />
            {t('ambientSound.save')}
          </Button>
        </form>
        <div className="flex flex-wrap gap-3">
          {saved.map((mix) => (
            <div key={mix.name} className="flex items-center gap-1">
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery(mix.levels);
                  setNotice(t('ambientSound.applied', { name: mix.name }));
                }}
              >
                {mix.name}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('ambientSound.deleteMix', { name: mix.name })}
                onClick={() =>
                  saveMixes(saved.filter((item) => item.name !== mix.name))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {notice ||
          (playing && SOUND_TRACKS.every((track) => levels[track] === 0)
            ? t('ambientSound.allMuted')
            : '')}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">
          {t('ambientSound.credits')}
        </summary>
        <div className="mt-2 space-y-2">
          <p>
            {t('ambientSound.rain')} —{' '}
            <a
              className="underline"
              href="https://freesound.org/people/alex36917/sounds/524605/"
              target="_blank"
              rel="noreferrer"
            >
              alex36917
            </a>
            ,{' '}
            <a
              className="underline"
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY 4.0
            </a>
            ; {t('ambientSound.edited')} Porrumentzio (Blanket).
          </p>
          <p>
            {t('ambientSound.wind')} —{' '}
            <a
              className="underline"
              href="https://freesound.org/people/felix.blume/sounds/217506/"
              target="_blank"
              rel="noreferrer"
            >
              felix.blume
            </a>
            , CC0; {t('ambientSound.edited')} Porrumentzio (Blanket).
          </p>
          <p>
            {t('ambientSound.cafe')} —{' '}
            <a
              className="underline"
              href="https://soundbible.com/1664-Restaurant-Ambiance.html"
              target="_blank"
              rel="noreferrer"
            >
              stephan
            </a>
            , Public Domain.
          </p>
          <a
            className="inline-block underline"
            href="/audio/ambient/LICENSES.md"
            target="_blank"
            rel="noreferrer"
          >
            {t('ambientSound.licenseDetails')}
          </a>
        </div>
      </details>
    </div>
  );
}
