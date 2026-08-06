import { FileDropzone } from '@/components/file-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  VIDEO_TRIMMER_DIRECTORY,
  type VideoOutputFormat,
  type VideoTrimmerRequest,
  type VideoTrimmerResponse,
} from '@/lib/video-trimmer';
import { createFileRoute } from '@tanstack/react-router';
import {
  Download,
  Film,
  LoaderCircle,
  Scissors,
  UploadCloud,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/video-trimmer')({
  component: VideoTrimmerPage,
});

type MediaInfo = {
  duration: number;
  mimeType: string;
};

type TrimResult = {
  fileName: string;
  size: number;
  mimeType: string;
  url: string;
};

const MAX_FILE_SIZE = 1024 * 1024 * 1024;

function formatTime(value: number): string {
  const total = Math.max(0, Math.floor(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function getOutputDirectory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(VIDEO_TRIMMER_DIRECTORY, { create: true });
}

async function removeOutput(fileName: string): Promise<void> {
  const directory = await getOutputDirectory();
  await directory.removeEntry(fileName).catch(() => undefined);
}

async function cleanupOutputs(): Promise<void> {
  const directory = await getOutputDirectory();
  for await (const [name] of directory.entries()) {
    await directory
      .removeEntry(name, { recursive: true })
      .catch(() => undefined);
  }
}

function runWorker(
  request: VideoTrimmerRequest,
  onProgress?: (progress: number) => void,
): Promise<Exclude<VideoTrimmerResponse, { type: 'progress' | 'error' }>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/video-trimmer.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.onmessage = (event: MessageEvent<VideoTrimmerResponse>) => {
      const response = event.data;
      if (response.type === 'progress') {
        onProgress?.(response.progress);
        return;
      }
      worker.terminate();
      if (response.type === 'error') reject(new Error(response.error));
      else resolve(response);
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('WORKER_FAILED'));
    };
    worker.postMessage(request);
  });
}

function VideoTrimmerPage() {
  const { t } = useTranslation();
  const [formatQuery, setFormat] = useQueryParam<VideoOutputFormat>(
    'format',
    StringParam,
    'mp4',
  );
  const format = formatQuery === 'webm' ? 'webm' : 'mp4';
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<TrimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<TrimResult | null>(null);

  useEffect(() => {
    void cleanupOutputs().catch(() => undefined);
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    };
  }, []);

  const clearResult = async () => {
    if (!resultRef.current) return;
    URL.revokeObjectURL(resultRef.current.url);
    await removeOutput(resultRef.current.fileName);
    resultRef.current = null;
    setResult(null);
  };

  const selectFile = async (nextFile: File) => {
    setError(null);
    if (nextFile.size > MAX_FILE_SIZE) {
      setError(t('videoTrimmer.tooLarge'));
      return;
    }
    setLoading(true);
    try {
      await clearResult();
      const response = await runWorker({ type: 'inspect', file: nextFile });
      if (response.type !== 'inspected') throw new Error('INSPECT_FAILED');
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      setFile(nextFile);
      setSourceUrl(URL.createObjectURL(nextFile));
      setInfo(response);
      setStart(0);
      setEnd(response.duration);
    } catch {
      setError(t('videoTrimmer.unsupported'));
    } finally {
      setLoading(false);
    }
  };

  const trimVideo = async () => {
    if (!file || !info || end <= start) return;
    setLoading(true);
    setProgress(0);
    setError(null);
    try {
      await clearResult();
      const response = await runWorker(
        { type: 'trim', file, start, end, format },
        setProgress,
      );
      if (response.type !== 'trimmed') throw new Error('TRIM_FAILED');
      const directory = await getOutputDirectory();
      const outputFile = await (
        await directory.getFileHandle(response.fileName)
      ).getFile();
      const nextResult = {
        ...response,
        url: URL.createObjectURL(outputFile),
      };
      resultRef.current = nextResult;
      setResult(nextResult);
      setProgress(1);
    } catch (cause) {
      console.error('Video trimming failed:', cause);
      setError(t('videoTrimmer.trimError'));
    } finally {
      setLoading(false);
    }
  };

  const clear = async () => {
    await clearResult();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setFile(null);
    setSourceUrl(null);
    setInfo(null);
    setError(null);
    setProgress(0);
  };

  const updateRange = (values: number[]) => {
    setStart(values[0] ?? 0);
    setEnd(values[1] ?? info?.duration ?? 0);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Scissors className="h-6 w-6 text-red-500" />
          {t('videoTrimmer.title')}
        </h1>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {!file ? (
        <FileDropzone
          accept="video/*"
          disabled={loading}
          onFiles={(files) => {
            const selected = files[0]?.file;
            if (selected) void selectFile(selected);
          }}
          className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl bg-muted/20 p-8 text-center hover:border-red-400"
        >
          {loading ? (
            <LoaderCircle className="h-10 w-10 animate-spin text-red-500" />
          ) : (
            <UploadCloud className="h-10 w-10 text-red-500" />
          )}
          <span className="font-medium">{t('videoTrimmer.select')}</span>
        </FileDropzone>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="break-all text-lg">{file.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatBytes(file.size)} · {info?.mimeType}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => void clear()}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <video
                src={sourceUrl ?? ''}
                controls
                preload="metadata"
                className="max-h-[520px] w-full rounded-xl bg-black"
              />

              {info && (
                <div className="space-y-4">
                  <Slider
                    min={0}
                    max={info.duration}
                    step={0.01}
                    value={[start, end]}
                    onValueChange={updateRange}
                    disabled={loading}
                  />
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_180px_auto] lg:items-end">
                    <div className="space-y-2">
                      <Label>{t('videoTrimmer.start')}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={end}
                        step="0.01"
                        value={start}
                        onChange={(event) =>
                          setStart(
                            Math.max(
                              0,
                              Math.min(end, Number(event.target.value)),
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('videoTrimmer.end')}</Label>
                      <Input
                        type="number"
                        min={start}
                        max={info.duration}
                        step="0.01"
                        value={end}
                        onChange={(event) =>
                          setEnd(
                            Math.max(
                              start,
                              Math.min(
                                info.duration,
                                Number(event.target.value),
                              ),
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('videoTrimmer.format')}</Label>
                      <Select
                        value={format}
                        onValueChange={(value) =>
                          setFormat(value as VideoOutputFormat)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mp4">MP4</SelectItem>
                          <SelectItem value="webm">WebM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={trimVideo}
                      disabled={loading || end <= start}
                    >
                      {loading ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Scissors className="h-4 w-4" />
                      )}
                      {t('videoTrimmer.trim')}
                    </Button>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatTime(start)}</span>
                    <span>
                      {t('videoTrimmer.clipDuration')}：
                      {formatTime(Math.max(0, end - start))}
                    </span>
                    <span>{formatTime(end)}</span>
                  </div>
                  {loading && (
                    <progress
                      className="h-2 w-full accent-red-500"
                      max={1}
                      value={progress}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="h-5 w-5 text-emerald-500" />
                  {t('videoTrimmer.result')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <video
                  src={result.url}
                  controls
                  className="max-h-[520px] w-full rounded-xl bg-black"
                />
                <Button asChild>
                  <a href={result.url} download={`clip.${format}`}>
                    <Download className="h-4 w-4" />
                    {t('videoTrimmer.download')} · {formatBytes(result.size)}
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
