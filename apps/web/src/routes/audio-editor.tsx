import { FileDropzone } from '@/components/file-dropzone';
import { MediaResult } from '@/components/media-result';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  NumberParam,
  StringParam,
  useQueryParam,
} from '@/hooks/useQueryParams';
import {
  MAX_MEDIA_FILE_SIZE,
  formatMediaBytes,
  readStoredMedia,
  runMediaWorker,
} from '@/lib/media-tools';
import { createFileRoute } from '@tanstack/react-router';
import { AudioLines, Layers, LoaderCircle, UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/audio-editor')({
  component: AudioEditorPage,
});

type AudioTab = 'trim' | 'merge';
type Result = { url: string; fileName: string; mimeType: string; size: number };

function AudioEditorPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<AudioTab>('tab', StringParam, 'trim');
  const [start, setStart] = useQueryParam<number>('start', NumberParam, 0);
  const [end, setEnd] = useQueryParam<number>('end', NumberParam, 0);
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const sourceRef = useRef<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const resultRef = useRef<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void runMediaWorker({ type: 'cleanup' }).catch(() => undefined);
    return () => {
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current);
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    };
  }, []);

  const clearResult = () => {
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    resultRef.current = null;
    setResult(null);
  };

  const selectAudio = async (next: File) => {
    setError(null);
    if (next.size > MAX_MEDIA_FILE_SIZE) {
      setError(t('mediaTools.tooLarge'));
      return;
    }
    setLoading(true);
    try {
      const response = await runMediaWorker({
        type: 'waveform',
        file: next,
        buckets: 180,
      });
      if (response.type !== 'waveform') throw new Error('AUDIO_REQUIRED');
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current);
      const url = URL.createObjectURL(next);
      sourceRef.current = url;
      setSourceUrl(url);
      setFile(next);
      setDuration(response.duration);
      setPeaks(response.peaks);
      setStart(0);
      setEnd(response.duration);
      clearResult();
    } catch {
      setError(t('mediaTools.unsupportedAudio'));
    } finally {
      setLoading(false);
    }
  };

  const publishStored = async (
    response: Awaited<ReturnType<typeof runMediaWorker>>,
  ) => {
    if (response.type !== 'stored') throw new Error('INVALID_RESPONSE');
    clearResult();
    const output = await readStoredMedia(response.result.fileName);
    const next = {
      ...response.result,
      url: URL.createObjectURL(output),
    };
    resultRef.current = next;
    setResult(next);
  };

  const process = async () => {
    setError(null);
    setLoading(true);
    setProgress(0);
    try {
      const response =
        tab === 'trim'
          ? await runMediaWorker(
              {
                type: 'trim-audio',
                file:
                  file ??
                  (() => {
                    throw new Error('FILE_REQUIRED');
                  })(),
                start,
                end,
              },
              setProgress,
            )
          : await runMediaWorker({ type: 'merge-audio', files }, setProgress);
      await publishStored(response);
    } catch {
      setError(t('mediaTools.processError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <AudioLines className="size-6 text-violet-500" />
        {t('audioEditor.title')}
      </h1>
      <Tabs value={tab} onValueChange={(value) => setTab(value as AudioTab)}>
        <TabsList>
          <TabsTrigger value="trim">{t('audioEditor.trim')}</TabsTrigger>
          <TabsTrigger value="merge">{t('audioEditor.merge')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {tab === 'trim' && !file && (
        <FileDropzone
          accept="audio/*"
          disabled={loading}
          onFiles={(selected) => {
            const next = selected[0]?.file;
            if (next) void selectAudio(next);
          }}
          className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl bg-muted/20 p-8 text-center"
        >
          {loading ? (
            <LoaderCircle className="size-10 animate-spin text-violet-500" />
          ) : (
            <UploadCloud className="size-10 text-violet-500" />
          )}
          <span className="font-medium">{t('audioEditor.select')}</span>
        </FileDropzone>
      )}

      {tab === 'trim' && file && (
        <Card>
          <CardContent className="space-y-5">
            <p className="break-all font-medium">{file.name}</p>
            <audio src={sourceUrl ?? ''} controls className="w-full" />
            <svg
              viewBox={`0 0 ${peaks.length} 100`}
              preserveAspectRatio="none"
              aria-label={t('audioEditor.waveform')}
              className="h-32 w-full rounded-lg border bg-muted/20 p-2 text-violet-500"
            >
              {peaks.map((peak, index) => {
                const height = Math.max(2, peak * 100);
                return (
                  <rect
                    key={index}
                    x={index}
                    y={(100 - height) / 2}
                    width={0.75}
                    height={height}
                    rx={0.35}
                    fill="currentColor"
                  />
                );
              })}
            </svg>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('mediaTools.start')}</Label>
                <Input
                  type="number"
                  min={0}
                  max={end}
                  step="0.01"
                  value={start}
                  onChange={(event) => setStart(Number(event.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('mediaTools.end')}</Label>
                <Input
                  type="number"
                  min={start}
                  max={duration}
                  step="0.01"
                  value={end}
                  onChange={(event) => setEnd(Number(event.target.value))}
                />
              </div>
            </div>
            <Button disabled={loading || end <= start} onClick={process}>
              {loading && <LoaderCircle className="animate-spin" />}
              {t('audioEditor.trim')}
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 'merge' && (
        <Card>
          <CardContent className="space-y-4">
            <FileDropzone
              accept="audio/*"
              multiple
              disabled={loading}
              onFiles={(selected) => {
                const next = selected.map((item) => item.file);
                if (next.some((item) => item.size > MAX_MEDIA_FILE_SIZE)) {
                  setError(t('mediaTools.tooLarge'));
                  return;
                }
                setFiles(next);
                setError(null);
              }}
              className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl p-6 text-center"
            >
              <Layers className="size-9 text-violet-500" />
              <span className="font-medium">
                {t('audioEditor.selectMultiple')}
              </span>
            </FileDropzone>
            {files.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="flex justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="truncate">
                  {index + 1}. {item.name}
                </span>
                <span className="text-muted-foreground">
                  {formatMediaBytes(item.size)}
                </span>
              </div>
            ))}
            <Button disabled={loading || files.length < 2} onClick={process}>
              {loading && <LoaderCircle className="animate-spin" />}
              {t('audioEditor.merge')}
            </Button>
          </CardContent>
        </Card>
      )}
      {loading && progress > 0 && (
        <progress
          className="h-2 w-full accent-violet-500"
          max={1}
          value={progress}
        />
      )}
      {result && <MediaResult {...result} />}
    </div>
  );
}
