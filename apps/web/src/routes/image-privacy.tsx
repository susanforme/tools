import { FileDropzone } from '@/components/file-dropzone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createFileRoute } from '@tanstack/react-router';
import {
  AlertTriangle,
  CalendarClock,
  Camera,
  Download,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/image-privacy')({
  component: ImagePrivacyPage,
});

type Metadata = Record<string, unknown>;
type MetadataRow = { key: string; value: string };

const MAX_FILE_SIZE = 40 * 1024 * 1024;
const MAX_DECODED_BYTES = 160 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function asMetadata(value: unknown): Metadata {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Metadata)
    : {};
}

function formatMetadataValue(value: unknown): string | null {
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (
    Array.isArray(value) &&
    value.every((item) => ['string', 'number', 'boolean'].includes(typeof item))
  ) {
    return value.join(', ');
  }
  return null;
}

function metadataRows(metadata: Metadata): MetadataRow[] {
  return Object.entries(metadata)
    .flatMap(([key, value]) => {
      const formatted = formatMetadataValue(value);
      return formatted ? [{ key, value: formatted }] : [];
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

function firstMetadataValue(
  metadata: Metadata,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = formatMetadataValue(metadata[key]);
    if (value) return value;
  }
  return null;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('IMAGE_ENCODE_FAILED')),
      type,
      type === 'image/png' ? undefined : 0.95,
    );
  });
}

async function createCleanCopy(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height * 4 > MAX_DECODED_BYTES) {
      throw new Error('IMAGE_TOO_LARGE');
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('CANVAS_UNAVAILABLE');
    context.drawImage(bitmap, 0, 0);
    return canvasToBlob(canvas, file.type);
  } finally {
    bitmap.close();
  }
}

function cleanFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0
    ? `${name.slice(0, dot)}-clean${name.slice(dot)}`
    : `${name}-clean`;
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ImagePrivacyPage() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Metadata>({});
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = useMemo(() => metadataRows(metadata), [metadata]);
  const latitude = firstMetadataValue(metadata, ['latitude', 'GPSLatitude']);
  const longitude = firstMetadataValue(metadata, ['longitude', 'GPSLongitude']);
  const device = [
    firstMetadataValue(metadata, ['Make']),
    firstMetadataValue(metadata, ['Model']),
  ]
    .filter(Boolean)
    .join(' ');
  const capturedAt = firstMetadataValue(metadata, [
    'DateTimeOriginal',
    'CreateDate',
    'DateTimeDigitized',
  ]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const inspect = async (nextFile: File) => {
    setError(null);
    if (!SUPPORTED_TYPES.has(nextFile.type)) {
      setError(t('imagePrivacy.unsupported'));
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setError(t('imagePrivacy.tooLarge'));
      return;
    }

    setLoading(true);
    try {
      const { parse } = await import('exifr');
      const parsed: unknown = await parse(nextFile, {
        tiff: true,
        exif: true,
        gps: true,
        xmp: true,
        iptc: true,
        icc: true,
        jfif: true,
        ihdr: true,
        mergeOutput: true,
        sanitize: true,
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(nextFile);
      setPreviewUrl(URL.createObjectURL(nextFile));
      setMetadata(asMetadata(parsed));
    } catch (cause) {
      setError(t('imagePrivacy.inspectError', { msg: String(cause) }));
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setMetadata({});
    setError(null);
  };

  const removeMetadata = async () => {
    if (!file) return;
    setCleaning(true);
    setError(null);
    try {
      downloadBlob(await createCleanCopy(file), cleanFileName(file.name));
    } catch (cause) {
      setError(
        t(
          cause instanceof Error && cause.message === 'IMAGE_TOO_LARGE'
            ? 'imagePrivacy.decodedTooLarge'
            : 'imagePrivacy.cleanError',
        ),
      );
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="h-6 w-6 text-emerald-500" />
          {t('imagePrivacy.title')}
        </h1>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {!file ? (
        <FileDropzone
          accept="image/jpeg,image/png,image/webp"
          disabled={loading}
          onFiles={(files) => {
            const selected = files[0]?.file;
            if (selected) void inspect(selected);
          }}
          className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl bg-muted/20 p-8 text-center hover:border-emerald-400"
        >
          {loading ? (
            <LoaderCircle className="h-10 w-10 animate-spin text-emerald-500" />
          ) : (
            <UploadCloud className="h-10 w-10 text-emerald-500" />
          )}
          <span className="font-medium">{t('imagePrivacy.select')}</span>
          <span className="text-xs text-muted-foreground">
            {t('imagePrivacy.supported')}
          </span>
        </FileDropzone>
      ) : (
        <>
          <Card>
            <CardContent className="grid gap-5 py-6 md:grid-cols-[260px_1fr]">
              <img
                src={previewUrl ?? ''}
                alt={file.name}
                className="max-h-64 w-full rounded-xl bg-muted object-contain"
              />
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="break-all font-medium">{file.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatBytes(file.size)} · {file.type}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={clear}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <PrivacySignal
                    icon={<MapPin className="h-4 w-4" />}
                    label={t('imagePrivacy.gps')}
                    value={
                      latitude && longitude ? `${latitude}, ${longitude}` : null
                    }
                    danger
                  />
                  <PrivacySignal
                    icon={<Camera className="h-4 w-4" />}
                    label={t('imagePrivacy.device')}
                    value={device || null}
                  />
                  <PrivacySignal
                    icon={<CalendarClock className="h-4 w-4" />}
                    label={t('imagePrivacy.capturedAt')}
                    value={capturedAt}
                  />
                </div>
                <Button onClick={removeMetadata} disabled={cleaning}>
                  {cleaning ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {t('imagePrivacy.cleanAndDownload')}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {t('imagePrivacy.reencodeHint')}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{t('imagePrivacy.metadata')}</span>
                <Badge variant="secondary">
                  {t('imagePrivacy.items', { count: rows.length })}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t('imagePrivacy.empty')}
                </p>
              ) : (
                <div className="divide-y rounded-xl border">
                  {rows.map((row) => (
                    <div
                      key={row.key}
                      className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[220px_1fr]"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.key}
                      </span>
                      <span className="break-all">{row.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function PrivacySignal({
  icon,
  label,
  value,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        value && danger
          ? 'border-destructive/40 bg-destructive/5'
          : 'bg-muted/20'
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {value && danger ? <AlertTriangle className="h-4 w-4" /> : icon}
        {label}
      </div>
      <p className="mt-2 break-all text-sm font-medium">{value ?? '—'}</p>
    </div>
  );
}
