import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  transcriptExport,
  type TranscriptSegment,
} from '@/lib/media-workspace-core';
import { downloadBlob } from '@/lib/download';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceField, NumberField } from './calculator-ui';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
type Progress = { file: string; loaded: number; total: number };
export default function Transcript() {
  const { t } = useTranslation(),
    label = (key: string) => t(`mediaWorkspace.${key}`);
  const [q, setQ] = useQueryParams<{ language: string; offset: number }>({
    language: StringParam,
    offset: NumberParam,
  });
  const language = [
    'auto',
    'chinese',
    'english',
    'japanese',
    'korean',
    'french',
    'german',
    'spanish',
  ].includes(q.language ?? '')
    ? q.language!
    : 'auto';
  const [file, setFile] = useState<File | null>(null),
    [url, setUrl] = useState(''),
    [segments, setSegments] = useState<TranscriptSegment[]>([]),
    [error, setError] = useState<string | null>(null),
    [stage, setStage] = useState(''),
    [progress, setProgress] = useState<Progress>({
      file: '',
      loaded: 0,
      total: 0,
    }),
    [recording, setRecording] = useState(false),
    [elapsed, setElapsed] = useState(0);
  const active = useRef<{
      worker: Worker;
      timer: ReturnType<typeof setTimeout>;
    } | null>(null),
    recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    recordTimer = useRef<ReturnType<typeof setInterval> | null>(null),
    ticket = useRef(0),
    mounted = useRef(true);
  const busy = !!stage;
  function cancel() {
    ticket.current++;
    if (active.current) {
      active.current.worker.terminate();
      clearTimeout(active.current.timer);
      active.current = null;
    }
    setStage('');
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      ticket.current++;
      active.current?.worker.terminate();
      if (active.current) clearTimeout(active.current.timer);
      if (recordTimer.current) clearInterval(recordTimer.current);
      if (recorder.current && recorder.current.state !== 'inactive')
        recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(() => {
    if (!file) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  useEffect(() => {
    cancel();
    setSegments([]);
    setError(null);
  }, [file, language]);
  async function startRecording() {
    cancel();
    setError(null);
    const id = ++ticket.current;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (id !== ticket.current || !mounted.current) {
        s.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = s;
      const r = new MediaRecorder(s);
      recorder.current = r;
      const chunks: Blob[] = [];
      let size = 0;
      const started = Date.now();
      setElapsed(0);
      r.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.push(e.data);
          size += e.data.size;
          if (size > 20_000_000 && r.state !== 'inactive') r.stop();
        }
      };
      r.onstop = () => {
        s.getTracks().forEach((track) => track.stop());
        stream.current = null;
        recorder.current = null;
        if (recordTimer.current) clearInterval(recordTimer.current);
        recordTimer.current = null;
        if (mounted.current) {
          setRecording(false);
          setFile(new File(chunks, 'recording.webm', { type: r.mimeType }));
        }
      };
      r.onerror = () => {
        if (mounted.current) setError('record');
        if (r.state !== 'inactive') r.stop();
      };
      r.start(1000);
      setRecording(true);
      recordTimer.current = setInterval(() => {
        const seconds = (Date.now() - started) / 1000;
        setElapsed(seconds);
        if (seconds >= 180 && r.state !== 'inactive') r.stop();
      }, 250);
    } catch (e) {
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      if (mounted.current) setError((e as Error).message);
    }
  }
  async function recognize() {
    if (!file) return;
    cancel();
    setError(null);
    setSegments([]);
    setProgress({ file: '', loaded: 0, total: 0 });
    setStage('decode');
    const id = ++ticket.current;
    try {
      if (file.size > 20_000_000) throw new Error('audioLimit');
      const ctx = new OfflineAudioContext(1, 1, 16000);
      const audio = await ctx.decodeAudioData(await file.arrayBuffer());
      if (id !== ticket.current) return;
      if (audio.duration > 180 || audio.numberOfChannels > 8 || !audio.length)
        throw new Error('audioLimit');
      const samples = new Float32Array(audio.length);
      for (let ch = 0; ch < audio.numberOfChannels; ch++) {
        const channel = audio.getChannelData(ch);
        for (let i = 0; i < samples.length; i++)
          samples[i] += channel[i]! / audio.numberOfChannels;
      }
      const worker = new Worker(
        new URL('../lib/audio-transcription.worker.ts', import.meta.url),
        { type: 'module' },
      );
      const finish = () => {
        worker.terminate();
        if (active.current?.worker === worker) {
          clearTimeout(active.current.timer);
          active.current = null;
        }
        if (id === ticket.current) setStage('');
      };
      const timer = setTimeout(
        () => {
          finish();
          if (id === ticket.current) setError('TIMEOUT');
        },
        15 * 60 * 1000,
      );
      active.current = { worker, timer };
      worker.onmessage = (
        e: MessageEvent<{
          stage?: string;
          progress?: Record<string, unknown>;
          result?: TranscriptSegment[];
          error?: string;
        }>,
      ) => {
        if (id !== ticket.current) return;
        const data = e.data;
        if (data.stage) setStage(data.stage);
        if (data.progress) {
          const p = data.progress;
          setProgress({
            file: typeof p.file === 'string' ? p.file : '',
            loaded: typeof p.loaded === 'number' ? p.loaded : 0,
            total: typeof p.total === 'number' ? p.total : 0,
          });
        }
        if (data.result) {
          setSegments(data.result);
          finish();
        }
        if (data.error) {
          setError(data.error);
          finish();
        }
      };
      worker.onerror = (e) => {
        if (id === ticket.current) setError(e.message);
        finish();
      };
      worker.postMessage({ samples, language }, [samples.buffer]);
    } catch (e) {
      if (id === ticket.current) {
        setError((e as Error).message);
        setStage('');
      }
    }
  }
  let exportError: string | null = null;
  try {
    if (segments.length) transcriptExport(segments, 'srt', q.offset ?? 0);
  } catch (e) {
    exportError = (e as Error).message;
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{label('transcriptHint')}</p>
      <Label htmlFor="transcript-file">{label('audioFile')}</Label>
      <Input
        id="transcript-file"
        type="file"
        accept="audio/*"
        disabled={busy || recording}
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            recording ? recorder.current?.stop() : void startRecording()
          }
        >
          {label(recording ? 'stopRecording' : 'record')}
        </Button>
        {recording && <span>{elapsed.toFixed(1)} s</span>}
      </div>
      {url && <audio src={url} controls className="w-full" />}
      <div className="grid gap-3 md:grid-cols-2">
        <ChoiceField
          label={label('language')}
          value={language}
          options={[
            'auto',
            'chinese',
            'english',
            'japanese',
            'korean',
            'french',
            'german',
            'spanish',
          ].map((value) => ({ value, label: label(`languages.${value}`) }))}
          onChange={(language) => setQ({ language })}
        />
        <NumberField
          label={label('timeOffset')}
          value={q.offset ?? 0}
          min={-3600}
          max={3600}
          step={0.1}
          onChange={(offset) => setQ({ offset })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!file || busy || recording}
          onClick={() => void recognize()}
        >
          {label('transcribe')}
        </Button>
        {busy && (
          <Button variant="outline" onClick={cancel}>
            {label('cancel')}
          </Button>
        )}
        {(['txt', 'srt', 'vtt'] as const).map((format) => (
          <Button
            key={format}
            variant="outline"
            disabled={!segments.length || !!exportError || busy}
            onClick={() => {
              try {
                downloadBlob(
                  new Blob(
                    [transcriptExport(segments, format, q.offset ?? 0)],
                    {
                      type:
                        format === 'vtt'
                          ? 'text/vtt'
                          : 'text/plain;charset=utf-8',
                    },
                  ),
                  `transcript.${format}`,
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {format.toUpperCase()}
          </Button>
        ))}
      </div>
      {busy && (
        <div role="status" className="space-y-2">
          <p>{label(`stages.${stage}`)}</p>
          {stage === 'download' && (
            <>
              <p className="break-all text-sm">
                {progress.file}{' '}
                {progress.total
                  ? `${(progress.loaded / 1e6).toFixed(1)} / ${(progress.total / 1e6).toFixed(1)} MB`
                  : ''}
              </p>
              <progress
                className="w-full"
                max={progress.total || 1}
                value={progress.loaded}
              />
            </>
          )}
        </div>
      )}
      {(error || exportError) && (
        <p role="alert" className="text-destructive">
          {t('mediaWorkspace.failed', {
            msg: t(`mediaWorkspace.errors.${error || exportError}`, {
              defaultValue: error || exportError || '',
            }),
          })}
        </p>
      )}
      <div className="space-y-3">
        {segments.map((segment, i) => (
          <div key={i} className="space-y-2 rounded border p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <NumberField
                label={`${i + 1} ${label('start')}`}
                value={segment.start}
                min={0}
                step={0.01}
                onChange={(start) =>
                  setSegments(
                    segments.map((s, j) => (j === i ? { ...s, start } : s)),
                  )
                }
              />
              <NumberField
                label={label('end')}
                value={segment.end}
                min={0}
                step={0.01}
                onChange={(end) =>
                  setSegments(
                    segments.map((s, j) => (j === i ? { ...s, end } : s)),
                  )
                }
              />
            </div>
            <Textarea
              aria-label={`${label('transcriptText')} ${i + 1}`}
              value={segment.text}
              maxLength={10000}
              onChange={(e) =>
                setSegments(
                  segments.map((s, j) =>
                    j === i ? { ...s, text: e.target.value } : s,
                  ),
                )
              }
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSegments(segments.filter((_, j) => j !== i))}
            >
              {label('remove')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
