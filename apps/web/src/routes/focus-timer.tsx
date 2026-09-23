import { IntervalTimer } from '@/components/interval-timer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { boundedNumber, formatClock, remainingTime } from '@/lib/focus-tools';
import { createFileRoute } from '@tanstack/react-router';
import {
  Bell,
  Maximize,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/focus-timer')({
  component: FocusTimerPage,
});
const PARAMS = {
  tab: StringParam,
  minutes: NumberParam,
  work: NumberParam,
  rest: NumberParam,
  sound: StringParam,
};
type Countdown = { id: string; name: string; milliseconds: number };
type TimerCardProps = {
  name: string;
  duration: number;
  onStart: () => void;
  onComplete: (name: string) => void;
  onRemove?: () => void;
};

function TimerCard({
  name,
  duration,
  onStart,
  onComplete,
  onRemove,
}: TimerCardProps) {
  const { t } = useTranslation();
  const [deadline, setDeadline] = useState<number | null>(null);
  const [paused, setPaused] = useState(duration);
  const [now, setNow] = useState(0);
  const [done, setDone] = useState(false);
  const remaining = remainingTime(deadline, paused, now);
  const notified = useRef(false);
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 100);
    const visible = () => tick();
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [deadline]);
  useEffect(() => {
    if (deadline !== null && now >= deadline && !notified.current) {
      notified.current = true;
      setDeadline(null);
      setPaused(0);
      setDone(true);
      onComplete(name);
    }
  }, [deadline, now, name, onComplete]);

  return (
    <Card className={done ? 'border-primary' : ''}>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate font-medium">{name}</h2>
          {onRemove && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={t('focusTimer.remove', { name })}
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div
          role="timer"
          aria-label={name}
          className="text-center font-mono text-4xl tabular-nums md:text-5xl"
        >
          {formatClock(remaining, true)}
        </div>
        {done && (
          <p className="text-center text-sm text-primary">
            {t('focusTimer.finished')}
          </p>
        )}
        <div className="flex justify-center gap-2">
          <Button
            onClick={() => {
              const current = Date.now();
              if (deadline !== null) {
                setPaused(remainingTime(deadline, paused, current));
                setDeadline(null);
              } else {
                onStart();
                notified.current = false;
                setDone(false);
                setNow(current);
                setDeadline(current + (paused > 0 ? paused : duration));
              }
            }}
          >
            {deadline === null ? (
              <Play className="h-4 w-4" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
            {t(deadline === null ? 'focusTools.start' : 'focusTools.pause')}
          </Button>
          <Button
            variant="outline"
            aria-label={t('focusTimer.resetNamed', { name })}
            onClick={() => {
              setDeadline(null);
              setPaused(duration);
              setDone(false);
              notified.current = false;
            }}
          >
            <RotateCcw className="h-4 w-4" />
            {t('focusTools.reset')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stopwatch() {
  const { t } = useTranslation();
  const [started, setStarted] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const total = elapsed + (started === null ? 0 : Math.max(0, now - started));
  useEffect(() => {
    if (started === null) return;
    const interval = window.setInterval(() => setNow(Date.now()), 50);
    return () => window.clearInterval(interval);
  }, [started]);
  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div
          role="timer"
          aria-label={t('focusTimer.stopwatch')}
          className="text-center font-mono text-4xl tabular-nums md:text-6xl"
        >
          {formatClock(total)}
          <span className="text-2xl text-muted-foreground">
            .{String(Math.floor(total / 10) % 100).padStart(2, '0')}
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              const current = Date.now();
              if (started === null) {
                setNow(current);
                setStarted(current);
              } else {
                setElapsed(elapsed + current - started);
                setStarted(null);
              }
            }}
          >
            {t(started === null ? 'focusTools.start' : 'focusTools.pause')}
          </Button>
          <Button
            variant="outline"
            disabled={started === null || laps.length >= 100}
            onClick={() =>
              setLaps((previous) => [
                elapsed + Date.now() - (started ?? Date.now()),
                ...previous,
              ])
            }
          >
            {t('focusTimer.lap')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setStarted(null);
              setElapsed(0);
              setLaps([]);
            }}
          >
            {t('focusTools.reset')}
          </Button>
        </div>
        {laps.length > 0 && (
          <ol className="mx-auto max-h-72 max-w-sm overflow-auto divide-y">
            {laps.map((lap, index) => (
              <li
                key={laps.length - index}
                className="flex justify-between py-2 font-mono"
              >
                <span>
                  {t('focusTimer.lapNumber', { number: laps.length - index })}
                </span>
                <span>
                  {formatClock(lap)}.
                  {String(Math.floor(lap / 10) % 100).padStart(2, '0')}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function FocusTimerPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    tab: string;
    minutes: number;
    work: number;
    rest: number;
    sound: string;
  }>(PARAMS);
  const tab = ['countdown', 'pomodoro', 'stopwatch', 'interval'].includes(
    query.tab ?? '',
  )
    ? query.tab!
    : 'countdown';
  const minutes = boundedNumber(query.minutes, 5, 1 / 60, 1440);
  const work = boundedNumber(query.work, 25, 1, 180);
  const rest = boundedNumber(query.rest, 5, 1, 60);
  const sound = query.sound !== '0';
  const [name, setName] = useState('');
  const [timers, setTimers] = useState<Countdown[]>([]);
  const [phase, setPhase] = useState<'work' | 'rest'>('work');
  const [completed, setCompleted] = useState(0);
  const [notification, setNotification] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const changed = () =>
      setFullscreen(document.fullscreenElement === displayRef.current);
    document.addEventListener('fullscreenchange', changed);
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      const audio = audioRef.current;
      audioRef.current = null;
      if (audio && audio.state !== 'closed') void audio.close();
    };
  }, []);

  const prepareSound = useCallback(
    (force = false) => {
      if (!sound && !force) return;
      try {
        audioRef.current ??= new AudioContext();
        void audioRef.current
          .resume()
          .catch((cause: Error) =>
            setError(
              t('focusTools.operationFailed', { message: cause.message }),
            ),
          );
      } catch (cause) {
        setError(
          t('focusTools.operationFailed', {
            message: (cause as Error).message,
          }),
        );
      }
    },
    [sound, t],
  );

  const complete = useCallback(
    (timerName: string) => {
      setNotice(t('focusTimer.complete', { name: timerName }));
      const audio = audioRef.current;
      if (sound && audio && audio.state === 'running') {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0, audio.currentTime);
        gain.gain.linearRampToValueAtTime(0.12, audio.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.9);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start();
        oscillator.stop(audio.currentTime + 1);
      }
      if (
        notification &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(t('focusTimer.title'), {
            body: t('focusTimer.complete', { name: timerName }),
          });
        } catch (cause) {
          setError(
            t('focusTools.operationFailed', {
              message: (cause as Error).message,
            }),
          );
        }
      }
    },
    [sound, notification, t],
  );
  const completePomodoro = useCallback(
    (timerName: string) => {
      complete(timerName);
      if (phase === 'work') setCompleted((value) => value + 1);
    },
    [complete, phase],
  );

  const enableNotifications = async () => {
    setError(null);
    if (notification) {
      setNotification(false);
      return;
    }
    if (!('Notification' in window)) {
      setError(t('focusTimer.notificationUnavailable'));
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotification(permission === 'granted');
      if (permission !== 'granted')
        setError(t('focusTimer.notificationDenied'));
    } catch (cause) {
      setError(
        t('focusTools.operationFailed', { message: (cause as Error).message }),
      );
    }
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (displayRef.current?.requestFullscreen)
        await displayRef.current.requestFullscreen();
      else setError(t('focusTools.fullscreenUnavailable'));
    } catch (cause) {
      setError(
        t('focusTools.operationFailed', { message: (cause as Error).message }),
      );
    }
  };

  return (
    <div
      ref={displayRef}
      className="mx-auto min-h-0 max-w-6xl space-y-5 bg-background px-4 py-6 [&:fullscreen]:max-w-none [&:fullscreen]:overflow-auto [&:fullscreen]:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('focusTimer.title')}</h1>
        <Button variant="outline" onClick={() => void toggleFullscreen()}>
          <Maximize className="h-4 w-4" />
          {t(
            fullscreen ? 'focusTools.exitFullscreen' : 'focusTools.fullscreen',
          )}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="timer-sound"
            checked={sound}
            onCheckedChange={(checked) => {
              setQuery({ sound: checked === true ? '1' : '0' });
              if (checked === true) prepareSound(true);
            }}
          />
          <Label htmlFor="timer-sound">{t('focusTimer.sound')}</Label>
        </div>
        <Button
          variant={notification ? 'secondary' : 'outline'}
          onClick={() => void enableNotifications()}
        >
          <Bell className="h-4 w-4" />
          {t(
            notification
              ? 'focusTimer.disableNotifications'
              : 'focusTimer.enableNotifications',
          )}
        </Button>
      </div>
      <Tabs value={tab} onValueChange={(value) => setQuery({ tab: value })}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="countdown">
            {t('focusTimer.countdown')}
          </TabsTrigger>
          <TabsTrigger value="pomodoro">{t('focusTimer.pomodoro')}</TabsTrigger>
          <TabsTrigger value="stopwatch">
            {t('focusTimer.stopwatch')}
          </TabsTrigger>
          <TabsTrigger value="interval">{t('calculatorUtilities.interval')}</TabsTrigger>
        </TabsList>
        <TabsContent
          value="countdown"
          forceMount
          className="space-y-4 data-[state=inactive]:hidden"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (timers.length >= 12) return;
              setTimers((previous) => [
                ...previous,
                {
                  id: crypto.randomUUID(),
                  name:
                    name.trim() ||
                    t('focusTimer.defaultName', {
                      number: previous.length + 1,
                    }),
                  milliseconds: Math.round(minutes * 60_000),
                },
              ]);
              setName('');
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="space-y-2">
              <Label htmlFor="timer-name">{t('focusTimer.name')}</Label>
              <Input
                id="timer-name"
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('focusTimer.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timer-minutes">{t('focusTools.minutes')}</Label>
              <Input
                id="timer-minutes"
                type="number"
                min={1 / 60}
                max={1440}
                step="any"
                value={minutes}
                onChange={(event) =>
                  setQuery({ minutes: Number(event.target.value) })
                }
                className="w-28"
              />
            </div>
            <Button disabled={timers.length >= 12}>
              <Plus className="h-4 w-4" />
              {t('focusTimer.add')}
            </Button>
          </form>
          {timers.length === 0 && (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              {t('focusTimer.empty')}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {timers.map((timer) => (
              <TimerCard
                key={timer.id}
                name={timer.name}
                duration={timer.milliseconds}
                onStart={prepareSound}
                onComplete={complete}
                onRemove={() =>
                  setTimers((previous) =>
                    previous.filter((item) => item.id !== timer.id),
                  )
                }
              />
            ))}
          </div>
        </TabsContent>
        <TabsContent
          value="pomodoro"
          forceMount
          className="space-y-4 data-[state=inactive]:hidden"
        >
          <div className="flex flex-wrap items-end gap-3">
            {(['work', 'rest'] as const).map((key) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`pomo-${key}`}>
                  {t(`focusTimer.${key}Minutes`)}
                </Label>
                <Input
                  id={`pomo-${key}`}
                  type="number"
                  min={1}
                  max={key === 'work' ? 180 : 60}
                  value={key === 'work' ? work : rest}
                  onChange={(event) =>
                    setQuery({ [key]: Number(event.target.value) })
                  }
                  className="w-28"
                />
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => setPhase(phase === 'work' ? 'rest' : 'work')}
            >
              {t(
                phase === 'work'
                  ? 'focusTimer.switchRest'
                  : 'focusTimer.switchWork',
              )}
            </Button>
          </div>
          <div className="mx-auto max-w-xl">
            <TimerCard
              key={`${phase}-${work}-${rest}`}
              name={t(`focusTimer.${phase}`)}
              duration={(phase === 'work' ? work : rest) * 60_000}
              onStart={prepareSound}
              onComplete={completePomodoro}
            />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {t('focusTimer.sessions', { count: completed })}
          </p>
        </TabsContent>
        <TabsContent
          value="stopwatch"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <Stopwatch />
        </TabsContent>
        <TabsContent
          value="interval"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <IntervalTimer onStart={prepareSound} onComplete={complete} />
        </TabsContent>
      </Tabs>
      <p role="status" className="text-sm text-primary">
        {notice}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {t('focusTimer.keepOpen')}
      </p>
    </div>
  );
}
