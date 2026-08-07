import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db, type ScreenRecording } from '@/lib/db';
import {
  formatRecordingDuration,
  formatRecordingSize,
  getAudioRecordingExtension,
  getSupportedAudioRecordingMimeType,
  isAudioRecordingSupported,
  ScreenRecordingWorkerClient,
} from '@/lib/screen-recordings';
import { createFileRoute } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CircleStop,
  Download,
  LoaderCircle,
  Mic,
  Play,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/audio-recorder')({
  component: AudioRecorderPage,
});

function AudioRecorderPage() {
  const { t, i18n } = useTranslation();
  const recordings = useLiveQuery(
    () =>
      db.screenRecordings
        .orderBy('createdAt')
        .reverse()
        .filter((record) => record.kind === 'audio')
        .toArray(),
    [],
  );
  const workerRef = useRef<ScreenRecordingWorkerClient | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const writesRef = useRef<Promise<void>>(Promise.resolve());
  const writeErrorRef = useRef<unknown>(null);
  const startedAtRef = useRef(0);
  const mountedRef = useRef(true);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);
  const [ready, setReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    const available = isAudioRecordingSupported();
    setSupported(available);
    if (!available) {
      setReady(true);
      return;
    }
    const worker = new ScreenRecordingWorkerClient();
    workerRef.current = worker;
    void db.screenRecordings
      .toArray()
      .then((records) => worker.cleanup(records))
      .then((ids) => db.screenRecordings.bulkDelete(ids))
      .catch((cause: unknown) =>
        setError(t('audioRecorder.failed', { msg: String(cause) })),
      )
      .finally(() => setReady(true));
    return () => {
      mountedRef.current = false;
      if (recorderRef.current?.state !== 'inactive')
        recorderRef.current?.stop();
      else {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        worker.terminate();
      }
    };
  }, []);
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(
      () => setElapsed(Date.now() - startedAtRef.current),
      250,
    );
    return () => window.clearInterval(timer);
  }, [recording]);
  useEffect(
    () => () => {
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    },
    [playbackUrl],
  );

  async function start() {
    const worker = workerRef.current;
    if (!worker || !ready || recording) return;
    setError(null);
    setElapsed(0);
    let opened = false;
    try {
      const mimeType = getSupportedAudioRecordingMimeType();
      if (!mimeType) throw new Error(t('audioRecorder.unsupported'));
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      streamRef.current = stream;
      const id = crypto.randomUUID();
      const fileName = `${id}.${getAudioRecordingExtension(mimeType)}`;
      await worker.open(fileName);
      opened = true;
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      writesRef.current = Promise.resolve();
      writeErrorRef.current = null;
      startedAtRef.current = Date.now();
      recorder.addEventListener('dataavailable', (event) => {
        if (!event.data.size) return;
        writesRef.current = writesRef.current
          .then(() => worker.write(event.data))
          .catch((cause: unknown) => {
            writeErrorRef.current = cause;
            if (recorder.state !== 'inactive') recorder.stop();
          });
      });
      recorder.addEventListener(
        'stop',
        () => void finalize({ id, fileName, mimeType, worker }),
        { once: true },
      );
      recorder.start(1000);
      setRecording(true);
    } catch (cause) {
      if (opened) await worker.abort().catch(() => undefined);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError(t('audioRecorder.failed', { msg: (cause as Error).message }));
    }
  }
  async function finalize({
    id,
    fileName,
    mimeType,
    worker,
  }: {
    id: string;
    fileName: string;
    mimeType: string;
    worker: ScreenRecordingWorkerClient;
  }) {
    try {
      await writesRef.current;
      if (writeErrorRef.current) throw writeErrorRef.current;
      const { size } = await worker.close();
      const record: ScreenRecording = {
        id,
        kind: 'audio',
        fileName,
        mimeType,
        createdAt: startedAtRef.current,
        durationMs: Date.now() - startedAtRef.current,
        size,
      };
      await db.screenRecordings.put(record);
    } catch (cause) {
      await worker.abort().catch(() => undefined);
      if (mountedRef.current)
        setError(t('audioRecorder.failed', { msg: String(cause) }));
    } finally {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      if (!mountedRef.current) worker.terminate();
      else {
        setElapsed(Date.now() - startedAtRef.current);
        setRecording(false);
      }
    }
  }
  async function play(record: ScreenRecording) {
    setError(null);
    try {
      const file = await workerRef.current?.read(record.fileName);
      if (!file) throw new Error('Recording worker is not ready');
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
      setPlaybackUrl(URL.createObjectURL(file));
    } catch (cause) {
      setError(t('audioRecorder.failed', { msg: String(cause) }));
    }
  }
  async function download(record: ScreenRecording) {
    setError(null);
    try {
      const file = await workerRef.current?.read(record.fileName);
      if (!file) throw new Error('Recording worker is not ready');
      const url = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = record.fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url));
    } catch (cause) {
      setError(t('audioRecorder.failed', { msg: String(cause) }));
    }
  }
  async function remove(record: ScreenRecording) {
    setError(null);
    try {
      const worker = workerRef.current;
      if (!worker) throw new Error('Recording worker is not ready');
      await worker.delete(record.fileName);
      await db.screenRecordings.delete(record.id);
    } catch (cause) {
      setError(t('audioRecorder.failed', { msg: String(cause) }));
    }
  }

  if (supported === false)
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 text-destructive">
        {t('audioRecorder.unsupported')}
      </div>
    );
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('audioRecorder.title')}</h1>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              {t('audioRecorder.microphone')}
            </span>
            <span className="font-mono tabular-nums">
              {formatRecordingDuration(elapsed)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-end">
          {recording ? (
            <Button
              variant="destructive"
              onClick={() => recorderRef.current?.stop()}
            >
              <CircleStop className="h-4 w-4" />
              {t('audioRecorder.stop')}
            </Button>
          ) : (
            <Button disabled={!ready} onClick={() => void start()}>
              {!ready ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
              {t('audioRecorder.start')}
            </Button>
          )}
        </CardContent>
      </Card>
      {playbackUrl && <audio controls src={playbackUrl} className="w-full" />}
      {recordings === undefined ? (
        <LoaderCircle className="h-5 w-5 animate-spin" />
      ) : recordings.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('audioRecorder.empty')}
        </div>
      ) : (
        <div className="space-y-2">
          {recordings.map((record) => (
            <div
              key={record.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                  }).format(record.createdAt)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatRecordingDuration(record.durationMs)} ·{' '}
                  {formatRecordingSize(record.size)}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void play(record)}
              >
                <Play className="h-4 w-4" />
                {t('audioRecorder.play')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void download(record)}
              >
                <Download className="h-4 w-4" />
                {t('audioRecorder.download')}
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t('audioRecorder.delete')}
                onClick={() => void remove(record)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
