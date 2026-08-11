import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  StringParam,
  useQueryParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { db, type ScreenRecording } from '@/lib/db';
import {
  formatRecordingDuration,
  formatRecordingSize,
  getRecordingExtension,
  getRecommendedScreenRecordingBitrate,
  getScreenCaptureVideoConstraints,
  getSupportedRecordingMimeType,
  isScreenRecordingSupported,
  ScreenRecordingWorkerClient,
} from '@/lib/screen-recordings';
import { createFileRoute } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CircleStop,
  Download,
  LoaderCircle,
  Mic,
  MonitorUp,
  Play,
  Trash2,
  Video,
  Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/screen-recorder')({
  component: ScreenRecorderPage,
});

type AudioOption = 'on' | 'off';

type QualityQuery = {
  resolution: string;
  frameRate: string;
  videoBitrate: string;
};

type CaptureInfo = {
  width: number | null;
  height: number | null;
  frameRate: number | null;
  displaySurface: string | null;
  videoBitsPerSecond: number;
};

type Suggestion = { value: string; label: string };

const RESOLUTION_OPTIONS: Suggestion[] = [
  { value: '1280x720', label: '720p' },
  { value: '1920x1080', label: '1080p' },
  { value: '2560x1440', label: '1440p' },
  { value: '3840x2160', label: '4K' },
];
const FRAME_RATE_OPTIONS: Suggestion[] = [15, 24, 25, 30, 48, 50, 60].map(
  (value) => ({ value: String(value), label: 'FPS' }),
);
const BITRATE_OPTIONS: Suggestion[] = [
  { value: '5', label: '720p · 30 FPS' },
  { value: '7.5', label: '720p · 60 FPS' },
  { value: '8', label: '1080p · 30 FPS' },
  { value: '12', label: '1080p · 60 FPS' },
  { value: '16', label: '1440p · 30 FPS' },
  { value: '24', label: '1440p · 60 FPS' },
  { value: '40', label: '4K · 30 FPS' },
  { value: '60', label: '4K · 60 FPS' },
];

const QUALITY_QUERY_PARAMS = {
  resolution: StringParam,
  frameRate: StringParam,
  videoBitrate: StringParam,
};

function EditableSuggestionInput({
  id,
  value,
  options,
  placeholder,
  disabled,
  inputMode,
  onChange,
}: {
  id: string;
  value: string;
  options: Suggestion[];
  placeholder: string;
  disabled: boolean;
  inputMode?: 'decimal';
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-suggestions`}
        aria-autocomplete="list"
        autoComplete="off"
        inputMode={inputMode}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        onChange={(event) => onChange(event.target.value)}
      />
      {open && !disabled && (
        <div
          id={`${id}-suggestions`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {options.map((option) => (
            <Button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              variant="ghost"
              size="sm"
              className="w-full justify-between px-2 font-normal"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.value}</span>
              <span className="text-xs text-muted-foreground">
                {option.label}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

type ActiveCapture = {
  displayStream: MediaStream;
  microphoneStream: MediaStream | null;
  recordingStream: MediaStream;
  audioContext: AudioContext | null;
};

async function createRecordingStream(
  displayStream: MediaStream,
  microphoneStream: MediaStream | null,
): Promise<Pick<ActiveCapture, 'recordingStream' | 'audioContext'>> {
  const audioStreams = [displayStream, microphoneStream].filter(
    (stream): stream is MediaStream =>
      stream !== null && stream.getAudioTracks().length > 0,
  );

  if (audioStreams.length < 2) {
    return {
      recordingStream: new MediaStream([
        ...displayStream.getVideoTracks(),
        ...audioStreams.flatMap((stream) => stream.getAudioTracks()),
      ]),
      audioContext: null,
    };
  }

  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  audioStreams.forEach((stream) =>
    audioContext.createMediaStreamSource(stream).connect(destination),
  );
  await audioContext.resume();
  return {
    recordingStream: new MediaStream([
      ...displayStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]),
    audioContext,
  };
}

async function closeCapture(capture: ActiveCapture): Promise<void> {
  new Set([
    ...capture.displayStream.getTracks(),
    ...(capture.microphoneStream?.getTracks() ?? []),
    ...capture.recordingStream.getTracks(),
  ]).forEach((track) => track.stop());
  await capture.audioContext?.close().catch(() => undefined);
}

function ScreenRecorderPage() {
  const { t, i18n } = useTranslation();
  const recordings = useLiveQuery(
    () =>
      db.screenRecordings
        .orderBy('createdAt')
        .reverse()
        .filter((record) => record.kind !== 'audio')
        .toArray(),
    [],
  );
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const captureRef = useRef<ActiveCapture | null>(null);
  const storageWorkerRef = useRef<ScreenRecordingWorkerClient | null>(null);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const writeErrorRef = useRef<unknown>(null);
  const startedAtRef = useRef(0);
  const mountedRef = useRef(true);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [captureInfo, setCaptureInfo] = useState<CaptureInfo | null>(null);
  const [systemAudio, setSystemAudio] = useQueryParam<AudioOption>(
    'systemAudio',
    StringParam,
    'on',
  );
  const [microphone, setMicrophone] = useQueryParam<AudioOption>(
    'microphone',
    StringParam,
    'off',
  );
  const [quality, setQuality] =
    useQueryParams<QualityQuery>(QUALITY_QUERY_PARAMS);
  const resolution =
    quality.resolution?.toLowerCase() === 'auto'
      ? ''
      : (quality.resolution ?? '');
  const frameRate =
    quality.frameRate?.toLowerCase() === 'auto'
      ? ''
      : (quality.frameRate ?? '');
  const videoBitrate =
    quality.videoBitrate?.toLowerCase() === 'auto'
      ? ''
      : (quality.videoBitrate ?? '');

  useEffect(() => {
    mountedRef.current = true;
    const available = isScreenRecordingSupported();
    setSupported(available);
    if (!available) {
      setReady(true);
      return;
    }

    const storageWorker = new ScreenRecordingWorkerClient();
    storageWorkerRef.current = storageWorker;
    void db.screenRecordings
      .toArray()
      .then((records) => storageWorker.cleanup(records))
      .then((missingRecordIds) =>
        db.screenRecordings.bulkDelete(missingRecordIds),
      )
      .catch((cause: unknown) =>
        setError(t('screenRecorder.cleanupError', { msg: String(cause) })),
      )
      .finally(() => setReady(true));

    return () => {
      mountedRef.current = false;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      } else if (captureRef.current) {
        void closeCapture(captureRef.current);
        storageWorker.terminate();
      } else {
        storageWorker.terminate();
      }
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(
      () => setElapsedMs(Date.now() - startedAtRef.current),
      250,
    );
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (!selectedId) {
      setPlaybackUrl(null);
      return;
    }
    const record = recordings?.find((item) => item.id === selectedId);
    if (!record) {
      setSelectedId(null);
      return;
    }

    let disposed = false;
    let url: string | null = null;
    const storageWorker = storageWorkerRef.current;
    if (!storageWorker) return;
    void storageWorker
      .read(record.fileName)
      .then((file) => {
        if (disposed) return;
        url = URL.createObjectURL(file);
        setPlaybackUrl(url);
      })
      .catch((cause: unknown) => {
        if (!disposed) {
          setError(t('screenRecorder.playError', { msg: String(cause) }));
        }
      });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [recordings, selectedId, t]);

  async function startRecording() {
    if (!supported || !ready || recording) return;
    setError(null);
    setNotice(null);
    setElapsedMs(0);
    setCaptureInfo(null);

    let displayStream: MediaStream | null = null;
    let microphoneStream: MediaStream | null = null;
    let capture: ActiveCapture | null = null;
    const storageWorker = storageWorkerRef.current;
    let storageOpened = false;
    try {
      if (!storageWorker) throw new Error('Recording worker is not ready');
      const mimeType = getSupportedRecordingMimeType();
      if (!mimeType) throw new Error(t('screenRecorder.unsupported'));

      const videoConstraints = getScreenCaptureVideoConstraints(
        resolution,
        frameRate,
      );
      const normalizedVideoBitrate = videoBitrate.trim().toLowerCase();
      const requestedVideoBitrate =
        !normalizedVideoBitrate || normalizedVideoBitrate === 'auto'
          ? null
          : Math.round(Number(normalizedVideoBitrate) * 1_000_000);
      if (
        requestedVideoBitrate !== null &&
        (!Number.isFinite(requestedVideoBitrate) ||
          requestedVideoBitrate <= 0 ||
          requestedVideoBitrate > 4_294_967_295)
      )
        throw new Error('INVALID_VIDEO_BITRATE');

      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: videoConstraints,
        audio: systemAudio === 'on',
      });
      if (systemAudio === 'on' && displayStream.getAudioTracks().length === 0) {
        setNotice(t('screenRecorder.systemAudioUnavailable'));
      }
      if (microphone === 'on') {
        microphoneStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      }
      const { recordingStream, audioContext } = await createRecordingStream(
        displayStream,
        microphoneStream,
      );
      const activeCapture: ActiveCapture = {
        displayStream,
        microphoneStream,
        recordingStream,
        audioContext,
      };
      capture = activeCapture;
      const id = crypto.randomUUID();
      const fileName = `${id}.${getRecordingExtension(mimeType)}`;
      await storageWorker.open(fileName);
      storageOpened = true;
      const settings = displayStream.getVideoTracks()[0]?.getSettings() as
        | (MediaTrackSettings & { displaySurface?: string })
        | undefined;
      const videoBitsPerSecond =
        requestedVideoBitrate ??
        getRecommendedScreenRecordingBitrate(
          settings?.width ?? 1920,
          settings?.height ?? 1080,
          settings?.frameRate ?? 30,
        );
      const recorder = new MediaRecorder(recordingStream, {
        mimeType,
        videoBitsPerSecond,
      });
      const recordingQuality: CaptureInfo = {
        width: settings?.width ?? null,
        height: settings?.height ?? null,
        frameRate: settings?.frameRate ?? null,
        displaySurface: settings?.displaySurface ?? null,
        videoBitsPerSecond: recorder.videoBitsPerSecond,
      };
      setCaptureInfo(recordingQuality);

      recorderRef.current = recorder;
      captureRef.current = activeCapture;
      writeChainRef.current = Promise.resolve();
      writeErrorRef.current = null;
      startedAtRef.current = Date.now();

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size === 0) return;
        writeChainRef.current = writeChainRef.current
          .then(() => storageWorker.write(event.data))
          .catch((cause: unknown) => {
            writeErrorRef.current = cause;
            if (recorder.state !== 'inactive') recorder.stop();
          });
      });

      recorder.addEventListener(
        'stop',
        () => {
          void finalizeRecording({
            id,
            fileName,
            mimeType,
            capture: activeCapture,
            storageWorker,
            quality: recordingQuality,
          });
        },
        { once: true },
      );
      displayStream.getVideoTracks()[0]?.addEventListener(
        'ended',
        () => {
          if (recorder.state !== 'inactive') recorder.stop();
        },
        { once: true },
      );

      if (previewRef.current) previewRef.current.srcObject = displayStream;
      recorder.start(1000);
      setRecording(true);
    } catch (cause) {
      if (storageOpened) await storageWorker?.abort().catch(() => undefined);
      if (capture) {
        await closeCapture(capture);
      } else {
        displayStream?.getTracks().forEach((track) => track.stop());
        microphoneStream?.getTracks().forEach((track) => track.stop());
      }
      const message =
        cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? t('screenRecorder.permissionDenied')
          : cause instanceof Error &&
              cause.message === 'INVALID_CAPTURE_RESOLUTION'
            ? t('screenRecorder.invalidResolution')
            : cause instanceof Error &&
                cause.message === 'INVALID_CAPTURE_FRAME_RATE'
              ? t('screenRecorder.invalidFrameRate')
              : cause instanceof Error &&
                  cause.message === 'INVALID_VIDEO_BITRATE'
                ? t('screenRecorder.invalidVideoBitrate')
                : t('screenRecorder.startError', { msg: String(cause) });
      setError(message);
    }
  }

  async function finalizeRecording({
    id,
    fileName,
    mimeType,
    capture,
    storageWorker,
    quality,
  }: {
    id: string;
    fileName: string;
    mimeType: string;
    capture: ActiveCapture;
    storageWorker: ScreenRecordingWorkerClient;
    quality: CaptureInfo;
  }) {
    try {
      await writeChainRef.current;
      if (writeErrorRef.current) throw writeErrorRef.current;
      const { size } = await storageWorker.close();
      const recordingRecord: ScreenRecording = {
        id,
        kind: 'screen',
        fileName,
        mimeType,
        createdAt: startedAtRef.current,
        durationMs: Date.now() - startedAtRef.current,
        size,
        width: quality.width ?? undefined,
        height: quality.height ?? undefined,
        frameRate: quality.frameRate ?? undefined,
        videoBitsPerSecond: quality.videoBitsPerSecond,
      };
      await db.screenRecordings.put(recordingRecord);
    } catch (cause) {
      await storageWorker.abort().catch(() => undefined);
      if (mountedRef.current) {
        setError(t('screenRecorder.saveError', { msg: String(cause) }));
      }
    } finally {
      await closeCapture(capture);
      recorderRef.current = null;
      captureRef.current = null;
      if (!mountedRef.current) storageWorker.terminate();
      if (mountedRef.current) {
        if (previewRef.current) previewRef.current.srcObject = null;
        setElapsedMs(Date.now() - startedAtRef.current);
        setRecording(false);
      }
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  async function removeRecording(recording: ScreenRecording) {
    setError(null);
    try {
      const storageWorker = storageWorkerRef.current;
      if (!storageWorker) throw new Error('Recording worker is not ready');
      await storageWorker.delete(recording.fileName);
      await db.screenRecordings.delete(recording.id);
      if (selectedId === recording.id) setSelectedId(null);
    } catch (cause) {
      setError(t('screenRecorder.deleteError', { msg: String(cause) }));
    }
  }

  async function downloadRecording(recording: ScreenRecording) {
    setError(null);
    try {
      const storageWorker = storageWorkerRef.current;
      if (!storageWorker) throw new Error('Recording worker is not ready');
      const file = await storageWorker.read(recording.fileName);
      const url = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = recording.fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url));
    } catch (cause) {
      setError(t('screenRecorder.downloadError', { msg: String(cause) }));
    }
  }

  if (supported === false) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {t('screenRecorder.unsupported')}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold">{t('screenRecorder.title')}</h1>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          {notice}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <MonitorUp className="h-5 w-5 text-blue-500" />
            {t('screenRecorder.captureTitle')}
          </CardTitle>
          <span className="font-mono text-lg tabular-nums">
            {formatRecordingDuration(elapsedMs)}
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3">
              <Checkbox
                checked={systemAudio === 'on'}
                disabled={recording}
                onCheckedChange={(checked) =>
                  setSystemAudio(checked === true ? 'on' : 'off')
                }
                className="mt-0.5"
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Volume2 className="h-4 w-4 text-blue-500" />
                  {t('screenRecorder.systemAudio')}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t('screenRecorder.systemAudioDescription')}
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3">
              <Checkbox
                checked={microphone === 'on'}
                disabled={recording}
                onCheckedChange={(checked) =>
                  setMicrophone(checked === true ? 'on' : 'off')
                }
                className="mt-0.5"
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Mic className="h-4 w-4 text-emerald-500" />
                  {t('screenRecorder.microphone')}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t('screenRecorder.microphoneDescription')}
                </span>
              </span>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <label
                htmlFor="screen-recorder-resolution"
                className="text-sm font-medium"
              >
                {t('screenRecorder.resolution')}
              </label>
              <EditableSuggestionInput
                id="screen-recorder-resolution"
                value={resolution}
                options={RESOLUTION_OPTIONS}
                disabled={recording}
                placeholder={t('screenRecorder.auto')}
                onChange={(value) =>
                  setQuality({ resolution: value || undefined })
                }
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="screen-recorder-frame-rate"
                className="text-sm font-medium"
              >
                {t('screenRecorder.frameRate')}
              </label>
              <EditableSuggestionInput
                id="screen-recorder-frame-rate"
                inputMode="decimal"
                value={frameRate}
                options={FRAME_RATE_OPTIONS}
                disabled={recording}
                placeholder={t('screenRecorder.auto')}
                onChange={(value) =>
                  setQuality({ frameRate: value || undefined })
                }
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="screen-recorder-video-bitrate"
                className="text-sm font-medium"
              >
                {t('screenRecorder.videoBitrate')}
              </label>
              <EditableSuggestionInput
                id="screen-recorder-video-bitrate"
                inputMode="decimal"
                value={videoBitrate}
                options={BITRATE_OPTIONS}
                disabled={recording}
                placeholder={t('screenRecorder.auto')}
                onChange={(value) =>
                  setQuality({ videoBitrate: value || undefined })
                }
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('screenRecorder.qualityDescription')}
          </p>
          {captureInfo && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="font-medium">
                {t('screenRecorder.actualOutput')}：
              </span>{' '}
              {captureInfo.width && captureInfo.height
                ? `${captureInfo.width} × ${captureInfo.height}`
                : '—'}
              {captureInfo.frameRate
                ? ` · ${captureInfo.frameRate.toFixed(1)} FPS`
                : ''}
              {captureInfo.videoBitsPerSecond
                ? ` · ${(captureInfo.videoBitsPerSecond / 1_000_000).toFixed(1)} Mbps`
                : ''}
              {captureInfo.displaySurface
                ? ` · ${captureInfo.displaySurface}`
                : ''}
            </div>
          )}
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border bg-black">
            <video
              ref={previewRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-contain"
            />
            {!recording && (
              <div className="absolute flex flex-col items-center gap-2 text-slate-400">
                <Video className="h-12 w-12" />
                <span className="text-sm">
                  {t('screenRecorder.previewEmpty')}
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            {recording ? (
              <Button variant="destructive" onClick={stopRecording}>
                <CircleStop className="h-4 w-4" />
                {t('screenRecorder.stop')}
              </Button>
            ) : (
              <Button disabled={!ready} onClick={() => void startRecording()}>
                {!ready ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Video className="h-4 w-4" />
                )}
                {t('screenRecorder.start')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">
            {t('screenRecorder.records')}
          </h2>
        </div>

        {selectedId && playbackUrl && (
          <video
            key={playbackUrl}
            controls
            playsInline
            src={playbackUrl}
            className="aspect-video w-full rounded-xl border bg-black"
          />
        )}

        {recordings === undefined ? (
          <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : recordings.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t('screenRecorder.noRecords')}
          </div>
        ) : (
          <div className="space-y-2">
            {recordings.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border p-4"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                  <Video className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                      dateStyle: 'medium',
                      timeStyle: 'medium',
                    }).format(item.createdAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRecordingDuration(item.durationMs)} ·{' '}
                    {formatRecordingSize(item.size)}
                    {item.width && item.height
                      ? ` · ${item.width} × ${item.height}`
                      : ''}
                    {item.frameRate
                      ? ` · ${item.frameRate.toFixed(1)} FPS`
                      : ''}
                    {item.videoBitsPerSecond
                      ? ` · ${(item.videoBitsPerSecond / 1_000_000).toFixed(1)} Mbps`
                      : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedId(item.id)}
                >
                  <Play className="h-4 w-4" />
                  {t('screenRecorder.play')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void downloadRecording(item)}
                >
                  <Download className="h-4 w-4" />
                  {t('screenRecorder.download')}
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t('screenRecorder.delete')}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => void removeRecording(item)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
