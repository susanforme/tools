import {
  NumberParam,
  StringParam,
  useQueryParam,
} from '@/hooks/useQueryParams';
import {
  detectImageFormat,
  type AnimationConversionRequest,
  type AnimationConversionResult,
  type ConversionDirection,
} from '@/lib/webp-gif';
import { createFileRoute } from '@tanstack/react-router';
import {
  ArrowLeftRight,
  Download,
  LoaderCircle,
  UploadCloud,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Slider } from '../components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

export const Route = createFileRoute('/webp-gif')({
  component: WebpGifPage,
});

type SelectedImage = {
  file: File;
  url: string;
  width: number;
  height: number;
};
type ConversionResult = {
  blob: Blob;
  url: string;
  filename: string;
  frameCount: number;
  duration: number;
};

type WorkerResponse =
  | ({ ok: true } & AnimationConversionResult)
  | {
      ok: false;
      error: 'too-large' | 'conversion-failed';
      detail: string;
    };

const MAX_FILE_SIZE = 64 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MAX_SIDE = 16_384;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('invalid image'));
    image.src = url;
  });
}

function convertInWorker(
  request: AnimationConversionRequest,
): Promise<AnimationConversionResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/webp-gif.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data);
      else {
        console.error('WebP/GIF conversion failed:', event.data.detail);
        reject(new Error(event.data.error));
      }
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('conversion-failed'));
    };
    worker.postMessage(request, [request.source]);
  });
}

function formatDuration(milliseconds: number): string {
  return milliseconds < 1_000
    ? `${milliseconds} ms`
    : `${(milliseconds / 1_000).toFixed(2)} s`;
}

function outputName(filename: string, extension: 'gif' | 'webp'): string {
  const base = filename.replace(/\.[^.]+$/, '') || 'image';
  return `${base}.${extension}`;
}

function WebpGifPage() {
  const { t } = useTranslation();
  const [queryDirection, setDirection] = useQueryParam<ConversionDirection>(
    'direction',
    StringParam,
    'webp-to-gif',
  );
  const [rawQuality, setQuality] = useQueryParam<number>(
    'quality',
    NumberParam,
    85,
  );
  const quality = Math.min(100, Math.max(1, rawQuality));
  const direction: ConversionDirection =
    queryDirection === 'gif-to-webp' ? 'gif-to-webp' : 'webp-to-gif';
  const [source, setSource] = useState<SelectedImage | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const expectedFormat = direction === 'webp-to-gif' ? 'webp' : 'gif';
  const targetFormat = direction === 'webp-to-gif' ? 'gif' : 'webp';

  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source.url);
    },
    [source],
  );
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );

  const selectFile = async (file: File) => {
    setError(null);
    setResult(null);
    if (file.size > MAX_FILE_SIZE) {
      setError(t('webpGif.errorTooLarge'));
      return;
    }

    try {
      const format = await detectImageFormat(file);
      if (format !== expectedFormat) {
        setError(
          t('webpGif.errorFormat', {
            format: expectedFormat.toUpperCase(),
          }),
        );
        return;
      }

      const url = URL.createObjectURL(file);
      try {
        const image = await loadImage(url);
        if (
          image.naturalWidth > MAX_SIDE ||
          image.naturalHeight > MAX_SIDE ||
          image.naturalWidth * image.naturalHeight > MAX_PIXELS
        ) {
          URL.revokeObjectURL(url);
          setError(t('webpGif.errorDimensions'));
          return;
        }
        setSource({
          file,
          url,
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      } catch (cause) {
        URL.revokeObjectURL(url);
        throw cause;
      }
    } catch {
      setError(t('webpGif.errorInvalid'));
    }
  };

  const convert = async () => {
    if (!source) return;
    setProcessing(true);
    setError(null);
    try {
      const converted = await convertInWorker({
        direction,
        source: await source.file.arrayBuffer(),
        quality,
      });
      const blob = new Blob([converted.source], {
        type: direction === 'webp-to-gif' ? 'image/gif' : 'image/webp',
      });
      setResult({
        blob,
        url: URL.createObjectURL(blob),
        filename: outputName(source.file.name, targetFormat),
        frameCount: converted.frameCount,
        duration: converted.duration,
      });
    } catch (cause) {
      setError(
        t(
          cause instanceof Error && cause.message === 'too-large'
            ? 'webpGif.errorAnimationTooLarge'
            : 'webpGif.errorConvert',
        ),
      );
    } finally {
      setProcessing(false);
    }
  };

  const changeDirection = (value: string) => {
    setDirection(value as ConversionDirection);
    setSource(null);
    setResult(null);
    setError(null);
  };

  const download = () => {
    if (!result) return;
    const anchor = document.createElement('a');
    anchor.href = result.url;
    anchor.download = result.filename;
    anchor.click();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('webpGif.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('webpGif.desc')}
        </p>
      </div>

      <Tabs value={direction} onValueChange={changeDirection}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="webp-to-gif" disabled={processing}>
            WebP → GIF
          </TabsTrigger>
          <TabsTrigger value="gif-to-webp" disabled={processing}>
            GIF → WebP
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-xl border bg-card p-4 space-y-4">
        {!source ? (
          <label
            className={`flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors ${
              dragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) void selectFile(file);
            }}
          >
            <UploadCloud className="w-9 h-9 text-muted-foreground" />
            <span className="text-sm font-medium">
              {t('webpGif.upload', {
                format: expectedFormat.toUpperCase(),
              })}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('webpGif.uploadHint')}
            </span>
            <input
              type="file"
              accept={`image/${expectedFormat},.${expectedFormat}`}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void selectFile(file);
                event.target.value = '';
              }}
            />
          </label>
        ) : (
          <div className="space-y-3">
            <div className="relative rounded-lg border bg-muted/30 overflow-hidden">
              <img
                src={source.url}
                alt={t('webpGif.sourceAlt')}
                className="w-full max-h-80 object-contain"
              />
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 w-8 h-8"
                onClick={() => {
                  setSource(null);
                  setResult(null);
                }}
                aria-label={t('webpGif.clear')}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground break-all">
              {source.file.name} · {source.width}×{source.height} ·{' '}
              {formatBytes(source.file.size)}
            </p>
          </div>
        )}

        {direction === 'gif-to-webp' && (
          <div className="space-y-2 max-w-md">
            <div className="flex items-center justify-between">
              <Label>{t('webpGif.quality')}</Label>
              <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                {quality}%
              </span>
            </div>
            <Slider
              min={1}
              max={100}
              value={[quality]}
              onValueChange={([value]) => setQuality(value)}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => void convert()}
            disabled={!source || processing}
          >
            {processing ? (
              <LoaderCircle className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowLeftRight className="w-4 h-4" />
            )}
            {processing ? t('webpGif.processing') : t('webpGif.convert')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('webpGif.animationNote')}
          </span>
        </div>

        {error && (
          <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{t('webpGif.result')}</h2>
              <p className="text-xs text-muted-foreground">
                {result.filename} · {formatBytes(result.blob.size)} ·{' '}
                {t('webpGif.frames', { count: result.frameCount })} ·{' '}
                {formatDuration(result.duration)}
              </p>
            </div>
            <Button onClick={download}>
              <Download className="w-4 h-4" />
              {t('webpGif.download')}
            </Button>
          </div>
          <img
            src={result.url}
            alt={t('webpGif.resultAlt')}
            className="w-full max-h-96 rounded-lg border bg-muted/30 object-contain"
          />
        </div>
      )}
    </div>
  );
}
