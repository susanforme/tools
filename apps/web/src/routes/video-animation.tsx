import { FileDropzone } from '@/components/file-dropzone';
import { MediaResult } from '@/components/media-result';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  NumberParam,
  StringParam,
  useQueryParam,
} from '@/hooks/useQueryParams';
import { MAX_MEDIA_FILE_SIZE, runMediaWorker } from '@/lib/media-tools';
import { createFileRoute } from '@tanstack/react-router';
import { Images, LoaderCircle, UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/video-animation')({
  component: VideoAnimationPage,
});

type AnimationFormat = 'gif' | 'webp';
type Result = { url: string; fileName: string; mimeType: string; size: number };

function VideoAnimationPage() {
  const { t } = useTranslation();
  const [format, setFormat] = useQueryParam<AnimationFormat>(
    'format',
    StringParam,
    'gif',
  );
  const [start, setStart] = useQueryParam<number>('start', NumberParam, 0);
  const [end, setEnd] = useQueryParam<number>('end', NumberParam, 5);
  const [frameRate, setFrameRate] = useQueryParam<number>(
    'fps',
    NumberParam,
    10,
  );
  const [maxWidth, setMaxWidth] = useQueryParam<number>(
    'width',
    NumberParam,
    480,
  );
  const [quality, setQuality] = useQueryParam<number>(
    'quality',
    NumberParam,
    80,
  );
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const resultRef = useRef<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    },
    [],
  );

  const selectFile = async (next: File) => {
    setError(null);
    if (next.size > MAX_MEDIA_FILE_SIZE) {
      setError(t('mediaTools.tooLarge'));
      return;
    }
    setLoading(true);
    try {
      const response = await runMediaWorker({ type: 'inspect', file: next });
      if (
        response.type !== 'inspected' ||
        !response.info.tracks.some((track) => track.type === 'video')
      ) {
        throw new Error('VIDEO_REQUIRED');
      }
      setFile(next);
      setDuration(response.info.duration);
      if (end <= start || end > response.info.duration) {
        setEnd(Math.min(5, response.info.duration));
      }
    } catch {
      setError(t('mediaTools.unsupportedVideo'));
    } finally {
      setLoading(false);
    }
  };

  const convert = async () => {
    if (!file || end <= start) return;
    setLoading(true);
    setProgress(0);
    setError(null);
    try {
      const response = await runMediaWorker(
        {
          type: 'video-animation',
          file,
          format,
          start,
          end,
          frameRate: Math.max(1, Math.min(30, frameRate)),
          maxWidth: Math.max(64, Math.min(1280, maxWidth)),
          quality: Math.max(1, Math.min(100, quality)),
        },
        setProgress,
      );
      if (response.type !== 'blob') throw new Error('INVALID_RESPONSE');
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
      const next = {
        fileName: response.fileName,
        mimeType: response.blob.type,
        size: response.blob.size,
        url: URL.createObjectURL(response.blob),
      };
      resultRef.current = next;
      setResult(next);
    } catch {
      setError(t('videoAnimation.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Images className="size-6 text-lime-500" />
        {t('videoAnimation.title')}
      </h1>
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
            const next = files[0]?.file;
            if (next) void selectFile(next);
          }}
          className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl bg-muted/20 p-8 text-center"
        >
          {loading ? (
            <LoaderCircle className="size-10 animate-spin text-lime-500" />
          ) : (
            <UploadCloud className="size-10 text-lime-500" />
          )}
          <span className="font-medium">{t('videoAnimation.select')}</span>
        </FileDropzone>
      ) : (
        <Card>
          <CardContent className="space-y-5">
            <p className="break-all font-medium">{file.name}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t('mediaTools.start')}>
                <Input
                  type="number"
                  min={0}
                  max={end}
                  step="0.1"
                  value={start}
                  onChange={(event) => setStart(Number(event.target.value))}
                />
              </Field>
              <Field label={t('mediaTools.end')}>
                <Input
                  type="number"
                  min={start}
                  max={duration}
                  step="0.1"
                  value={end}
                  onChange={(event) => setEnd(Number(event.target.value))}
                />
              </Field>
              <Field label={t('mediaTools.format')}>
                <Select
                  value={format}
                  onValueChange={(value) => setFormat(value as AnimationFormat)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gif">GIF</SelectItem>
                    <SelectItem value="webp">WebP</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="FPS">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={frameRate}
                  onChange={(event) => setFrameRate(Number(event.target.value))}
                />
              </Field>
              <Field label={t('videoAnimation.width')}>
                <Input
                  type="number"
                  min={64}
                  max={1280}
                  value={maxWidth}
                  onChange={(event) => setMaxWidth(Number(event.target.value))}
                />
              </Field>
              <Field label={t('videoAnimation.quality')}>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={quality}
                  onChange={(event) => setQuality(Number(event.target.value))}
                />
              </Field>
            </div>
            <Button disabled={loading || end <= start} onClick={convert}>
              {loading && <LoaderCircle className="animate-spin" />}
              {t('mediaTools.process')}
            </Button>
            {loading && (
              <progress
                className="h-2 w-full accent-lime-500"
                max={1}
                value={progress}
              />
            )}
          </CardContent>
        </Card>
      )}
      {result && <MediaResult {...result} />}
    </div>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
