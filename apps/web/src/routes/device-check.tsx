import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  StringParam,
  NumberParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { microphoneLevel, requestDeviceStream } from '@/lib/device-check';
import { getSupportedAudioRecordingMimeType } from '@/lib/screen-recordings';
import { createFileRoute } from '@tanstack/react-router';
import { Camera, Mic, Headphones } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/device-check')({
  component: DeviceCheckPage,
});

export function DeviceCheckPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{ mirror: string; volume: number }>({
    mirror: StringParam,
    volume: NumberParam,
  });
  const mirrored = query.mirror !== 'off';
  const volume = Number.isFinite(query.volume)
    ? Math.max(0, Math.min(50, query.volume ?? 15))
    : 15;
  const video = useRef<HTMLVideoElement | null>(null);
  const streams = useRef<{
    camera: MediaStream | null;
    microphone: MediaStream | null;
  }>({ camera: null, microphone: null });
  const generation = useRef({ camera: 0, microphone: 0 });
  const mounted = useRef(false);
  const context = useRef<AudioContext | null>(null);
  const speaker = useRef<AudioContext | null>(null);
  const animation = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackRef = useRef<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState({
    camera: 'default',
    microphone: 'default',
  });
  const [active, setActive] = useState({ camera: false, microphone: false });
  const [pending, setPending] = useState({ camera: false, microphone: false });
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [recording, setRecording] = useState(false);
  const [playback, setPlayback] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  function stop(kind: 'camera' | 'microphone') {
    generation.current[kind]++;
    if (kind === 'microphone') {
      if (recorder.current?.state === 'recording') recorder.current.stop();
      if (timeout.current) clearTimeout(timeout.current);
      cancelAnimationFrame(animation.current);
      void context.current?.close().catch(() => undefined);
      context.current = null;
      if (mounted.current) setLevel(0);
    }
    streams.current[kind]?.getTracks().forEach((track) => track.stop());
    streams.current[kind] = null;
    if (kind === 'camera' && video.current) video.current.srcObject = null;
    if (mounted.current) {
      setActive((old) => ({ ...old, [kind]: false }));
      setPending((old) => ({ ...old, [kind]: false }));
    }
  }

  useEffect(() => {
    mounted.current = true;
    const media = navigator.mediaDevices;
    setSupported(Boolean(media?.getUserMedia));
    const refresh = () =>
      void media
        ?.enumerateDevices()
        .then((list) => {
          if (mounted.current) setDevices(list);
        })
        .catch(() => undefined);
    refresh();
    media?.addEventListener('devicechange', refresh);
    return () => {
      mounted.current = false;
      stop('camera');
      stop('microphone');
      void speaker.current?.close().catch(() => undefined);
      if (playbackRef.current) URL.revokeObjectURL(playbackRef.current);
      media?.removeEventListener('devicechange', refresh);
    };
  }, []);

  async function start(kind: 'camera' | 'microphone') {
    stop(kind);
    const token = generation.current[kind];
    const current = () => mounted.current && token === generation.current[kind];
    setError(null);
    setPending((old) => ({ ...old, [kind]: true }));
    try {
      const deviceId =
        selected[kind] === 'default' ? undefined : { exact: selected[kind] };
      const stream = await requestDeviceStream(
        kind === 'camera'
          ? { video: { deviceId }, audio: false }
          : {
              audio: {
                deviceId,
                echoCancellation: true,
                noiseSuppression: true,
              },
              video: false,
            },
        current,
      );
      if (!stream) return;
      if (!current()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streams.current[kind] = stream;
      stream.getTracks().forEach((track) =>
        track.addEventListener(
          'ended',
          () => {
            if (current()) {
              stop(kind);
              setError(t('deviceCheck.ended'));
            }
          },
          { once: true },
        ),
      );
      if (kind === 'camera' && video.current) video.current.srcObject = stream;
      if (kind === 'microphone') {
        const audio = new AudioContext();
        context.current = audio;
        await audio.resume();
        if (!current()) return;
        const analyser = audio.createAnalyser();
        analyser.fftSize = 512;
        audio.createMediaStreamSource(stream).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        const update = () => {
          if (!current()) return;
          analyser.getByteTimeDomainData(samples);
          setLevel(microphoneLevel(samples));
          animation.current = requestAnimationFrame(update);
        };
        update();
      }
      if (current()) setActive((old) => ({ ...old, [kind]: true }));
      const list = await navigator.mediaDevices.enumerateDevices();
      if (current()) setDevices(list);
    } catch (cause) {
      if (current()) {
        stop(kind);
        setError(t('deviceCheck.failed', { msg: (cause as Error).message }));
      }
    } finally {
      if (current()) setPending((old) => ({ ...old, [kind]: false }));
    }
  }

  function record() {
    setError(null);
    try {
      const stream = streams.current.microphone;
      if (!stream) return;
      const mimeType = getSupportedAudioRecordingMimeType();
      if (!mimeType) throw new Error(t('deviceCheck.recordingUnsupported'));
      const instance = new MediaRecorder(stream, { mimeType });
      recorder.current = instance;
      const chunks: Blob[] = [];
      instance.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      instance.onerror = () => {
        if (mounted.current) {
          setError(
            t('deviceCheck.failed', {
              msg: t('deviceCheck.recordingUnsupported'),
            }),
          );
          setRecording(false);
        }
        if (timeout.current) clearTimeout(timeout.current);
      };
      instance.onstop = () => {
        if (timeout.current) clearTimeout(timeout.current);
        if (!mounted.current) return;
        if (playbackRef.current) URL.revokeObjectURL(playbackRef.current);
        const url = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
        playbackRef.current = url;
        setPlayback(url);
        setRecording(false);
      };
      instance.start();
      setRecording(true);
      timeout.current = setTimeout(() => {
        if (instance.state === 'recording') instance.stop();
      }, 10000);
    } catch (cause) {
      setError(t('deviceCheck.failed', { msg: (cause as Error).message }));
    }
  }

  async function tone(side: 'left' | 'right' | 'both') {
    let audio: AudioContext | null = null;
    setError(null);
    try {
      void speaker.current?.close().catch(() => undefined);
      audio = new AudioContext();
      speaker.current = audio;
      await audio.resume();
      if (!mounted.current || speaker.current !== audio) {
        await audio.close();
        return;
      }
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const merger = audio.createChannelMerger(2);
      oscillator.frequency.value = 440;
      gain.gain.setValueAtTime(0, audio.currentTime);
      gain.gain.linearRampToValueAtTime(volume / 100, audio.currentTime + 0.05);
      gain.gain.setValueAtTime(volume / 100, audio.currentTime + 0.65);
      gain.gain.linearRampToValueAtTime(0, audio.currentTime + 0.75);
      oscillator.connect(gain);
      if (side !== 'right') gain.connect(merger, 0, 0);
      if (side !== 'left') gain.connect(merger, 0, 1);
      merger.connect(audio.destination);
      const playingContext = audio;
      oscillator.onended = () => {
        void playingContext.close().catch(() => undefined);
        if (speaker.current === playingContext) speaker.current = null;
      };
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.8);
    } catch (cause) {
      const current = audio === null || speaker.current === audio;
      if (audio && audio.state !== 'closed')
        void audio.close().catch(() => undefined);
      if (current) {
        speaker.current = null;
        if (mounted.current)
          setError(t('deviceCheck.failed', { msg: (cause as Error).message }));
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('deviceCheck.title')}</h1>
      {!supported && (
        <p role="alert" className="text-destructive">
          {t('deviceCheck.unsupported')}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {(['camera', 'microphone'] as const).map((kind) => (
          <Card key={kind}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {kind === 'camera' ? (
                  <Camera className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
                {t(`deviceCheck.${kind}`)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={selected[kind]}
                onValueChange={(value) => {
                  stop(kind);
                  setSelected((old) => ({ ...old, [kind]: value }));
                }}
              >
                <SelectTrigger aria-label={t(`deviceCheck.${kind}`)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    {t('deviceCheck.defaultDevice')}
                  </SelectItem>
                  {devices
                    .filter(
                      (item) =>
                        item.kind ===
                          (kind === 'camera' ? 'videoinput' : 'audioinput') &&
                        item.deviceId &&
                        item.deviceId !== 'default',
                    )
                    .map((item, index) => (
                      <SelectItem key={item.deviceId} value={item.deviceId}>
                        {item.label ||
                          `${t(`deviceCheck.${kind}`)} ${index + 1}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={!supported || active[kind] || pending[kind]}
                  onClick={() => void start(kind)}
                >
                  {t('deviceCheck.start')}
                </Button>
                <Button
                  variant="outline"
                  disabled={!active[kind] && !pending[kind]}
                  onClick={() => stop(kind)}
                >
                  {t('deviceCheck.stop')}
                </Button>
                <span role="status" className="text-sm text-muted-foreground">
                  {t(
                    pending[kind]
                      ? 'deviceCheck.waiting'
                      : active[kind]
                        ? 'deviceCheck.active'
                        : 'deviceCheck.idle',
                  )}
                </span>
              </div>
              {kind === 'camera' ? (
                <>
                  <video
                    ref={video}
                    autoPlay
                    muted
                    playsInline
                    aria-label={t('deviceCheck.camera')}
                    className={`aspect-video w-full rounded-md bg-muted object-contain ${mirrored ? '-scale-x-100' : ''}`}
                  />
                  <Button
                    variant="outline"
                    aria-pressed={mirrored}
                    onClick={() =>
                      setQuery({ mirror: mirrored ? 'off' : 'on' })
                    }
                  >
                    {t('deviceCheck.mirror')}
                  </Button>
                </>
              ) : (
                <>
                  <Label htmlFor="microphone-level">
                    {t('deviceCheck.level')} · {level}%
                  </Label>
                  <meter
                    id="microphone-level"
                    min={0}
                    max={100}
                    value={level}
                    className="h-6 w-full"
                  />
                  <Button
                    variant="outline"
                    disabled={!active.microphone}
                    onClick={() =>
                      recording ? recorder.current?.stop() : record()
                    }
                  >
                    {t(
                      recording
                        ? 'deviceCheck.stopRecording'
                        : 'deviceCheck.record',
                    )}
                  </Button>
                  {recording && (
                    <p role="status">{t('deviceCheck.recording')}</p>
                  )}
                  {playback && (
                    <audio
                      aria-label={t('deviceCheck.playback')}
                      controls
                      src={playback}
                      className="w-full"
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5" />
            {t('deviceCheck.speakers')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label htmlFor="speaker-volume">
            {t('deviceCheck.volume')} · {volume}%
          </Label>
          <Input
            id="speaker-volume"
            type="range"
            min={0}
            max={50}
            value={volume}
            onChange={(event) =>
              setQuery({ volume: Number(event.target.value) })
            }
          />
          <div className="flex flex-wrap gap-2">
            {(['left', 'right', 'both'] as const).map((side) => (
              <Button
                key={side}
                variant="outline"
                onClick={() => void tone(side)}
              >
                {t(`deviceCheck.${side}`)}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {t('deviceCheck.soundHint')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
