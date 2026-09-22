import { ChoiceField } from '@/components/calculator-ui';
import { FileDropzone } from '@/components/file-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NumberParam,
  StringParam,
  useQueryParams,
  withDefault,
} from '@/hooks/useQueryParams';
import { downloadBytes } from '@/lib/download';
import {
  createPosterPdf,
  getPosterLayout,
  type PosterLayout,
} from '@/lib/poster-print';
import { createFileRoute } from '@tanstack/react-router';
import { Download, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/poster-print')({
  component: PosterPrintPage,
});
type PosterImage = {
  url: string;
  jpeg: Uint8Array;
  width: number;
  height: number;
  name: string;
};

function PosterPrintPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    width: number;
    overlap: number;
    orientation: string;
  }>({
    width: withDefault<number>(NumberParam, 420),
    overlap: withDefault<number>(NumberParam, 10),
    orientation: withDefault<string>(StringParam, 'portrait'),
  });
  const { width = 420, overlap = 10, orientation = 'portrait' } = query;
  const [image, setImage] = useState<PosterImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );
  let layout: PosterLayout | null = null;
  let layoutError: string | null = null;
  if (image) {
    try {
      layout = getPosterLayout(
        width,
        image.width / image.height,
        orientation,
        overlap,
      );
    } catch (cause) {
      layoutError = t(`posterPrint.${(cause as Error).message}`);
    }
  }
  const load = async (file: File) => {
    const id = ++request.current;
    setLoading(true);
    setError(null);
    setImage(null);
    let bitmap: ImageBitmap | null = null;
    try {
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 20 * 1024 * 1024
      )
        throw new Error(t('posterPrint.invalidImage'));
      bitmap = await createImageBitmap(file);
      if (
        !bitmap.width ||
        !bitmap.height ||
        bitmap.width * bitmap.height > 40_000_000 ||
        bitmap.width > 16000 ||
        bitmap.height > 16000
      )
        throw new Error(t('posterPrint.imageTooLarge'));
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error(t('posterPrint.canvasError'));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error(t('posterPrint.canvasError'))),
          'image/jpeg',
          0.97,
        ),
      );
      const jpeg = new Uint8Array(await blob.arrayBuffer());
      if (id === request.current)
        setImage({
          url: URL.createObjectURL(blob),
          jpeg,
          width: canvas.width,
          height: canvas.height,
          name: file.name.replace(/\.[^.]+$/, ''),
        });
      canvas.width = 0;
      canvas.height = 0;
    } catch (cause) {
      if (id === request.current)
        setError(t('posterPrint.error', { msg: (cause as Error).message }));
    } finally {
      bitmap?.close();
      if (id === request.current) setLoading(false);
    }
  };
  const exportPdf = async () => {
    if (!image || !layout) return;
    setExporting(true);
    setError(null);
    try {
      downloadBytes(
        await createPosterPdf(image.jpeg, layout),
        `${image.name}-poster.pdf`,
        'application/pdf',
      );
    } catch (cause) {
      setError(t('posterPrint.error', { msg: (cause as Error).message }));
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('posterPrint.title')}</h1>
      <FileDropzone
        accept="image/png,image/jpeg,image/webp"
        disabled={loading || exporting}
        onFiles={(files) => {
          if (files[0]) void load(files[0].file);
        }}
        className="flex items-center justify-center gap-2 rounded-xl p-8 text-sm"
      >
        <Upload className="h-5 w-5" />
        {t(loading ? 'posterPrint.loading' : 'posterPrint.upload')}
      </FileDropzone>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="poster-width">{t('posterPrint.width')}</Label>
          <Input
            id="poster-width"
            type="number"
            min={10}
            max={5000}
            value={width}
            onChange={(event) =>
              setQuery({ width: Number(event.target.value) })
            }
          />
        </div>
        <ChoiceField
          label={t('posterPrint.orientation')}
          value={orientation}
          onChange={(orientation) => setQuery({ orientation })}
          options={['portrait', 'landscape'].map((value) => ({
            value,
            label: t(`posterPrint.${value}`),
          }))}
        />
        <div className="space-y-1.5">
          <Label htmlFor="poster-overlap">{t('posterPrint.overlap')}</Label>
          <Input
            id="poster-overlap"
            type="number"
            min={0}
            max={30}
            value={overlap}
            onChange={(event) =>
              setQuery({ overlap: Number(event.target.value) })
            }
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('posterPrint.printHint')}
      </p>
      {(error || layoutError) && (
        <p role="alert" className="text-sm text-destructive">
          {error || layoutError}
        </p>
      )}
      {image && layout && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm">
              {t('posterPrint.summary', {
                width: layout.width.toFixed(1),
                height: layout.height.toFixed(1),
                rows: layout.rows,
                columns: layout.columns,
                count: layout.rows * layout.columns,
              })}
            </p>
            <Button
              disabled={exporting || loading}
              onClick={() => void exportPdf()}
            >
              <Download className="h-4 w-4" />
              {t(exporting ? 'posterPrint.exporting' : 'posterPrint.export')}
            </Button>
          </div>
          <svg
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="mx-auto max-h-[65vh] w-full rounded-lg border bg-white"
            role="img"
            aria-label={t('posterPrint.preview')}
          >
            <image
              href={image.url}
              width={layout.width}
              height={layout.height}
            />
            {Array.from({ length: layout.rows * layout.columns }, (_, i) => {
              const x =
                (i % layout.columns) * (layout.tileWidth - layout.overlap);
              const y =
                Math.floor(i / layout.columns) *
                (layout.tileHeight - layout.overlap);
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={y}
                    width={Math.min(layout.tileWidth, layout.width - x)}
                    height={Math.min(layout.tileHeight, layout.height - y)}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                  <rect
                    x={x + 2}
                    y={y + 2}
                    width={16}
                    height={12}
                    fill="#ffffff"
                    fillOpacity={0.9}
                  />
                  <text
                    x={x + 10}
                    y={y + 11}
                    textAnchor="middle"
                    fill="#111827"
                    fontSize={9}
                  >
                    {i + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </>
      )}
    </div>
  );
}
