import { Metric, NumberField } from '@/components/calculator-ui';
import { Button } from '@/components/ui/button';
import { NumberParam, useQueryParams } from '@/hooks/useQueryParams';
import { boundedNumber } from '@/lib/focus-tools';
import { describePitch, detectPitch, type Pitch } from '@/lib/pitch-detector';
import { createFileRoute } from '@tanstack/react-router';
import { Mic, Square, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/tuner')({ component: TunerPage });
const PARAMS = { reference: NumberParam, threshold: NumberParam };
type Capture = {
  context: AudioContext;
  stream: MediaStream;
  timer: number | null;
};
function closeCapture(capture: Capture) {
  if (capture.timer !== null) window.clearInterval(capture.timer);
  capture.stream.getTracks().forEach((track) => {
    track.onended = null;
    track.stop();
  });
  if (capture.context.state !== 'closed')
    void capture.context.close().catch(() => {});
}

function TunerPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    reference: number;
    threshold: number;
  }>(PARAMS);
  const reference = boundedNumber(query.reference, 440, 400, 480);
  const threshold = boundedNumber(query.threshold, -40, -60, -15);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tonePlaying, setTonePlaying] = useState(false);
  const captureRef = useRef<Capture | null>(null);
  const openingContextRef = useRef<AudioContext | null>(null);
  const toneRef = useRef<AudioContext | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  const thresholdRef = useRef(threshold);
  thresholdRef.current = threshold;
  const pitch: Pitch | null =
    frequency === null ? null : describePitch(frequency, reference);

  const stop = useCallback(() => {
    generation.current++;
    const capture = captureRef.current;
    captureRef.current = null;
    if (capture) closeCapture(capture);
    const opening = openingContextRef.current;
    openingContextRef.current = null;
    if (opening && opening.state !== 'closed')
      void opening.close().catch(() => {});
    setRunning(false);
    setStarting(false);
    setFrequency(null);
  }, []);
  const stopTone = useCallback(() => {
    const tone = toneRef.current;
    toneRef.current = null;
    if (tone && tone.state !== 'closed') void tone.close().catch(() => {});
    setTonePlaying(false);
  }, []);
  useEffect(() => {
    mounted.current = true;
    const hide = () => {
      if (document.hidden) {
        stop();
        stopTone();
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      mounted.current = false;
      generation.current++;
      if (captureRef.current) closeCapture(captureRef.current);
      captureRef.current = null;
      if (
        openingContextRef.current &&
        openingContextRef.current.state !== 'closed'
      )
        void openingContextRef.current.close().catch(() => {});
      openingContextRef.current = null;
      if (toneRef.current && toneRef.current.state !== 'closed')
        void toneRef.current.close().catch(() => {});
      toneRef.current = null;
      document.removeEventListener('visibilitychange', hide);
    };
  }, [stop, stopTone]);
  useEffect(() => {
    stopTone();
  }, [reference, stopTone]);

  const start = async () => {
    if (starting || running) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      setError(t('tuner.unavailable'));
      return;
    }
    const token = ++generation.current;
    setStarting(true);
    setError(null);
    let context: AudioContext | null = null;
    let stream: MediaStream | null = null;
    try {
      context = new AudioContext();
      openingContextRef.current = context;
      await context.resume();
      if (!mounted.current || generation.current !== token) {
        if (context.state !== 'closed') await context.close();
        return;
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      if (!mounted.current || generation.current !== token) {
        stream.getTracks().forEach((track) => track.stop());
        if (context.state !== 'closed') await context.close();
        return;
      }
      const analyser = context.createAnalyser();
      analyser.fftSize = 8192;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const capture: Capture = { context, stream, timer: null };
      captureRef.current = capture;
      openingContextRef.current = null;
      const sampleRate = context.sampleRate;
      capture.timer = window.setInterval(() => {
        if (captureRef.current !== capture) return;
        analyser.getFloatTimeDomainData(samples);
        setFrequency(
          detectPitch(samples, sampleRate, 10 ** (thresholdRef.current / 20)),
        );
      }, 100);
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          if (captureRef.current === capture) {
            stop();
            setError(t('tuner.ended'));
          }
        };
      });
      setRunning(true);
      setStarting(false);
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop());
      if (context && context.state !== 'closed')
        void context.close().catch(() => {});
      if (!mounted.current || generation.current !== token) return;
      captureRef.current = null;
      openingContextRef.current = null;
      setStarting(false);
      setRunning(false);
      const failure = cause as Error;
      setError(
        failure.name === 'NotAllowedError'
          ? t('tuner.denied')
          : failure.name === 'NotFoundError'
            ? t('tuner.missing')
            : t('tuner.error', { message: failure.message }),
      );
    }
  };

  const playTone = async () => {
    if (tonePlaying) {
      stopTone();
      return;
    }
    setError(null);
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      toneRef.current = context;
      setTonePlaying(true);
      await context.resume();
      if (!mounted.current || toneRef.current !== context) {
        if (context.state !== 'closed') await context.close();
        return;
      }
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = reference;
      const now = context.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
      gain.gain.setValueAtTime(0.12, now + 1.8);
      gain.gain.linearRampToValueAtTime(0, now + 2);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => {
        if (toneRef.current === context) stopTone();
      };
      oscillator.start(now);
      oscillator.stop(now + 2.05);
    } catch (cause) {
      if (context && context.state !== 'closed')
        void context.close().catch(() => {});
      if (mounted.current && toneRef.current === context) {
        toneRef.current = null;
        setTonePlaying(false);
        setError(t('tuner.toneError', { message: (cause as Error).message }));
      }
    }
  };
  const tuned = pitch !== null && Math.abs(pitch.cents) <= 5;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('tuner.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('tuner.description')}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <NumberField
          label={t('tuner.reference')}
          value={reference}
          min={400}
          step={0.1}
          onChange={(value) =>
            setQuery({ reference: boundedNumber(value, 440, 400, 480) })
          }
        />
        <NumberField
          label={t('tuner.threshold')}
          value={threshold}
          min={-60}
          step={1}
          onChange={(value) =>
            setQuery({ threshold: boundedNumber(value, -40, -60, -15) })
          }
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={running || starting ? stop : start}>
          {running || starting ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          {t(running || starting ? 'tuner.stop' : 'tuner.start')}
        </Button>
        <Button variant="outline" onClick={playTone}>
          <Volume2 className="h-4 w-4" />
          {t(tonePlaying ? 'tuner.silence' : 'tuner.play')}
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="space-y-4 rounded-xl border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {t(
            starting
              ? 'tuner.starting'
              : !running
                ? 'tuner.idle'
                : pitch
                  ? tuned
                    ? 'tuner.tuned'
                    : pitch.cents < 0
                      ? 'tuner.flat'
                      : 'tuner.sharp'
                  : 'tuner.listening',
          )}
        </p>
        <div
          className={`text-7xl font-semibold tabular-nums ${tuned ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}
        >
          {pitch ? (
            <>
              {pitch.note}
              <span className="text-3xl">{pitch.octave}</span>
            </>
          ) : (
            '—'
          )}
        </div>
        <svg
          viewBox="0 0 600 100"
          className="mx-auto w-full max-w-xl text-muted-foreground"
          role="img"
          aria-label={t('tuner.meter')}
        >
          <rect
            x="276"
            y="22"
            width="48"
            height="38"
            rx="6"
            className="fill-emerald-500/20"
          />
          <line x1="60" y1="60" x2="540" y2="60" stroke="currentColor" />
          {[-50, -25, 0, 25, 50].map((cents) => (
            <g key={cents}>
              <line
                x1={300 + cents * 4.8}
                x2={300 + cents * 4.8}
                y1="50"
                y2="66"
                stroke="currentColor"
              />
              <text
                x={300 + cents * 4.8}
                y="88"
                textAnchor="middle"
                fill="currentColor"
                fontSize="14"
              >
                {cents > 0 ? '+' : ''}
                {cents}
              </text>
            </g>
          ))}
          {pitch && (
            <line
              x1={300 + pitch.cents * 4.8}
              x2={300 + pitch.cents * 4.8}
              y1="10"
              y2="64"
              strokeWidth="4"
              className={tuned ? 'stroke-emerald-500' : 'stroke-amber-500'}
            />
          )}
        </svg>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Metric
          label={t('tuner.frequency')}
          value={pitch ? `${pitch.frequency.toFixed(1)} Hz` : '—'}
        />
        <Metric
          label={t('tuner.deviation')}
          value={
            pitch
              ? `${pitch.cents > 0 ? '+' : ''}${pitch.cents.toFixed(1)}`
              : '—'
          }
        />
      </div>
      <p className="text-sm text-muted-foreground">{t('tuner.microphone')}</p>
    </div>
  );
}
