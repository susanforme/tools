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
import { Checkbox } from '@/components/ui/checkbox';
import { NumberParam, useQueryParams } from '@/hooks/useQueryParams';
import { boundedNumber } from '@/lib/focus-tools';
import { practiceTempo, tapTempo } from '@/lib/shopping-music-tools';
import { createFileRoute } from '@tanstack/react-router';
import { Hand, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/metronome')({
  component: MetronomePage,
});
const PARAMS = {
  bpm: NumberParam,
  beats: NumberParam,
  note: NumberParam,
  subdivision: NumberParam,
  accent: NumberParam,
  volume: NumberParam,
  practice: NumberParam,
  increment: NumberParam,
  every: NumberParam,
  target: NumberParam,
};
type Settings = { [Key in keyof typeof PARAMS]: number };
type Tick = { time: number; beat: number; bar: number; bpm: number };
type Runtime = {
  context: AudioContext;
  interval: number | null;
  frame: number | null;
  queue: Tick[];
};

function closeRuntime(runtime: Runtime) {
  if (runtime.interval !== null) window.clearInterval(runtime.interval);
  if (runtime.frame !== null) window.cancelAnimationFrame(runtime.frame);
  runtime.queue.length = 0;
  if (runtime.context.state !== 'closed')
    void runtime.context.close().catch(() => {});
}

function MetronomePage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<Settings>(PARAMS);
  const bpm = Math.round(boundedNumber(query.bpm, 100, 30, 300));
  const beats = Math.round(boundedNumber(query.beats, 4, 1, 12));
  const note = query.note === 2 || query.note === 8 ? query.note : 4;
  const subdivision = Math.round(boundedNumber(query.subdivision, 1, 1, 4));
  const accent = query.accent !== 0;
  const volume = Math.round(boundedNumber(query.volume, 50, 0, 100));
  const practice = query.practice === 1;
  const increment = Math.round(boundedNumber(query.increment, 5, 1, 50));
  const every = Math.round(boundedNumber(query.every, 4, 1, 64));
  const target = Math.round(boundedNumber(query.target, 160, 30, 300));
  const runtimeRef = useRef<Runtime | null>(null);
  const mountedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [tick, setTick] = useState<Tick | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tapsRef = useRef<number[]>([]);
  const [tapCount, setTapCount] = useState(0);
  const [measured, setMeasured] = useState<number | null>(null);

  const stop = useCallback(() => {
    const runtime = runtimeRef.current;
    runtimeRef.current = null;
    if (runtime) closeRuntime(runtime);
    setPlaying(false);
    setStarting(false);
    setTick(null);
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const runtime = runtimeRef.current;
      runtimeRef.current = null;
      if (runtime) closeRuntime(runtime);
    };
  }, []);

  const tap = useCallback(() => {
    if (playing || starting) return;
    const now = performance.now();
    const previous = tapsRef.current;
    const taps =
      previous.length && now - previous[previous.length - 1] < 2500
        ? [...previous.slice(-7), now]
        : [now];
    tapsRef.current = taps;
    const result = tapTempo(taps);
    setTapCount(taps.length);
    setMeasured(result);
    if (result !== null && result >= 30 && result <= 300)
      setQuery({ bpm: result });
  }, [playing, starting, setQuery]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== 'Space' ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      const element = event.target;
      if (
        element instanceof HTMLElement &&
        (element.isContentEditable ||
          element.closest(
            'input, textarea, button, select, [role="combobox"], [role="switch"], [role="slider"]',
          ))
      )
        return;
      event.preventDefault();
      tap();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tap]);

  const start = async () => {
    if (runtimeRef.current || (practice && target < bpm)) return;
    setStarting(true);
    setError(null);
    let runtime: Runtime | null = null;
    try {
      if (typeof AudioContext === 'undefined')
        throw new Error(t('metronome.unsupported'));
      const context = new AudioContext();
      runtime = { context, interval: null, frame: null, queue: [] };
      runtimeRef.current = runtime;
      await context.resume();
      if (!mountedRef.current || runtimeRef.current !== runtime) return;
      const active = runtime;
      let nextTime = context.currentTime + 0.05;
      let pulse = 0;
      const pulsesPerBar = beats * subdivision;
      const tempoAt = (index: number) =>
        practice
          ? practiceTempo(
              bpm,
              target,
              increment,
              every,
              Math.floor(index / pulsesPerBar),
            )
          : bpm;
      const schedule = () => {
        if (runtimeRef.current !== active || context.state !== 'running')
          return;
        // 浏览器冻结后跳过过期拍点，避免恢复时集中播放。
        if (nextTime < context.currentTime - 0.2) {
          nextTime = context.currentTime + 0.05;
          pulse = Math.ceil(pulse / pulsesPerBar) * pulsesPerBar;
          active.queue.length = 0;
        }
        while (nextTime < context.currentTime + 0.12) {
          const bar = Math.floor(pulse / pulsesPerBar);
          const beat = Math.floor(pulse / subdivision) % beats;
          const isBeat = pulse % subdivision === 0;
          const strong = accent && beat === 0 && isBeat;
          const currentBpm = tempoAt(pulse);
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.frequency.value = strong ? 1400 : isBeat ? 900 : 600;
          gain.gain.setValueAtTime(
            (volume / 100) * (strong ? 0.35 : isBeat ? 0.22 : 0.12),
            nextTime,
          );
          gain.gain.exponentialRampToValueAtTime(0.0001, nextTime + 0.035);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
          };
          oscillator.start(nextTime);
          oscillator.stop(nextTime + 0.04);
          if (isBeat)
            active.queue.push({ time: nextTime, beat, bar, bpm: currentBpm });
          nextTime += 60 / currentBpm / subdivision;
          pulse++;
        }
      };
      const draw = () => {
        if (runtimeRef.current !== active) return;
        let latest: Tick | null = null;
        while (
          active.queue.length &&
          active.queue[0].time <= context.currentTime
        )
          latest = active.queue.shift()!;
        if (latest) setTick(latest);
        active.frame = window.requestAnimationFrame(draw);
      };
      schedule();
      active.interval = window.setInterval(schedule, 25);
      active.frame = window.requestAnimationFrame(draw);
      setPlaying(true);
    } catch (cause) {
      if (runtime) closeRuntime(runtime);
      if (runtimeRef.current === runtime) runtimeRef.current = null;
      if (mountedRef.current)
        setError(t('metronome.error', { message: (cause as Error).message }));
    } finally {
      if (mountedRef.current) setStarting(false);
    }
  };
  const disabled = playing || starting;
  const numberFields: Array<{
    key: keyof Settings;
    value: number;
    min: number;
    max: number;
    label: string;
  }> = [
    { key: 'bpm', value: bpm, min: 30, max: 300, label: 'bpm' },
    { key: 'beats', value: beats, min: 1, max: 12, label: 'beats' },
    {
      key: 'subdivision',
      value: subdivision,
      min: 1,
      max: 4,
      label: 'subdivision',
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('metronome.title')}</h1>
      <div className="space-y-5 rounded-xl border p-6 text-center">
        <p
          className="text-6xl font-semibold tabular-nums"
          aria-label={t('metronome.current')}
        >
          {tick?.bpm ?? bpm}
          <span className="ml-2 text-lg text-muted-foreground">BPM</span>
        </p>
        <div
          className="flex flex-wrap justify-center gap-2"
          aria-label={`${beats}/${note}`}
        >
          {Array.from({ length: beats }, (_, index) => (
            <span
              key={index}
              aria-label={t('metronome.beat', { beat: index + 1 })}
              aria-current={tick?.beat === index ? 'step' : undefined}
              className={`flex h-10 w-10 items-center justify-center rounded-full border tabular-nums ${tick?.beat === index ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} ${accent && index === 0 ? 'border-primary border-2' : ''}`}
            >
              {index + 1}
            </span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {tick
            ? t('metronome.bar', { bar: tick.bar + 1 })
            : t('metronome.idle')}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            disabled={starting || (!playing && practice && target < bpm)}
            onClick={() => (playing ? stop() : void start())}
          >
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {t(
              starting
                ? 'metronome.starting'
                : playing
                  ? 'metronome.stop'
                  : 'metronome.start',
            )}
          </Button>
          <Button disabled={disabled} variant="outline" onClick={tap}>
            <Hand className="h-4 w-4" />
            {t('metronome.tap')}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('metronome.tapHint')}
        </p>
        {tapCount > 0 && (
          <p role="status" className="text-sm">
            {measured === null
              ? t('metronome.tapCount', { count: tapCount })
              : measured < 30 || measured > 300
                ? t('metronome.outOfRange')
                : t('metronome.tapResult', { bpm: measured })}
          </p>
        )}
      </div>
      <fieldset disabled={disabled} className="space-y-4">
        <legend className="mb-3 font-semibold">
          {t('metronome.configuration')}
        </legend>
        <div className="grid gap-4 md:grid-cols-4">
          {numberFields.map(({ key, value, min, max, label }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`metronome-${key}`}>
                {t(`metronome.${label}`)}
              </Label>
              <Input
                id={`metronome-${key}`}
                type="number"
                min={min}
                max={max}
                step={1}
                value={value}
                onChange={(event) =>
                  setQuery({ [key]: Number(event.target.value) })
                }
              />
            </div>
          ))}
          <div className="space-y-2">
            <Label htmlFor="metronome-note">{t('metronome.note')}</Label>
            <Select
              disabled={disabled}
              value={String(note)}
              onValueChange={(value) => setQuery({ note: Number(value) })}
            >
              <SelectTrigger id="metronome-note" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  [
                    [2, 'half'],
                    [4, 'quarter'],
                    [8, 'eighth'],
                  ] as const
                ).map(([value, label]) => (
                  <SelectItem key={value} value={String(value)}>
                    {t(`metronome.${label}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="metronome-accent"
              disabled={disabled}
              checked={accent}
              onCheckedChange={(checked) =>
                setQuery({ accent: checked === true ? 1 : 0 })
              }
            />
            <Label htmlFor="metronome-accent">{t('metronome.accent')}</Label>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="metronome-volume">{t('metronome.volume')}</Label>
            <Input
              id="metronome-volume"
              type="range"
              min={0}
              max={100}
              value={volume}
              className="w-40"
              onChange={(event) =>
                setQuery({ volume: Number(event.target.value) })
              }
            />
            <span className="text-sm tabular-nums">{volume}%</span>
          </div>
        </div>
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="metronome-practice"
              disabled={disabled}
              checked={practice}
              onCheckedChange={(checked) =>
                setQuery({ practice: checked === true ? 1 : 0 })
              }
            />
            <Label htmlFor="metronome-practice">
              {t('metronome.practice')}
            </Label>
          </div>
          {practice && (
            <div className="grid gap-4 md:grid-cols-3">
              {(
                [
                  { key: 'increment', value: increment, min: 1, max: 50 },
                  { key: 'every', value: every, min: 1, max: 64 },
                  { key: 'target', value: target, min: 30, max: 300 },
                ] as const
              ).map(({ key, value, min, max }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`metronome-${key}`}>
                    {t(`metronome.${key}`)}
                  </Label>
                  <Input
                    id={`metronome-${key}`}
                    type="number"
                    min={min}
                    max={max}
                    step={1}
                    value={value}
                    onChange={(event) =>
                      setQuery({ [key]: Number(event.target.value) })
                    }
                  />
                </div>
              ))}
            </div>
          )}
          {practice && target < bpm && (
            <p role="alert" className="text-sm text-destructive">
              {t('metronome.practiceInvalid')}
            </p>
          )}
        </div>
      </fieldset>
      {disabled && (
        <p className="text-sm text-muted-foreground">
          {t('metronome.configureHint')}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
