import { boundedNumber } from '@/lib/focus-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceField, NumberField } from '@/components/calculator-ui';
import {
  DocumentImageList,
  DocumentUpload,
  useImageDocuments,
} from '@/components/image-document-inputs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import {
  canvasBlob,
  collageLayout,
  type CollageLayout,
} from '@/lib/image-document-tools';

export const Route = createFileRoute('/image-collage')({
  component: ImageCollagePage,
});

function ImageCollagePage() {
  const { t } = useTranslation();
  const documents = useImageDocuments();
  const [query, setQuery] = useQueryParams<{
    layout: string;
    width: number;
    gap: number;
    columns: number;
    background: string;
  }>({
    layout: StringParam,
    width: NumberParam,
    gap: NumberParam,
    columns: NumberParam,
    background: StringParam,
  });
  const mode: CollageLayout =
    query.layout === 'horizontal' || query.layout === 'grid'
      ? query.layout
      : 'vertical';
  const width = Math.round(boundedNumber(query.width, 800, 50, 4000)),
    gap = Math.round(boundedNumber(query.gap, 12, 0, 200)),
    columns = Math.round(boundedNumber(query.columns, 3, 1, 10));
  const background = /^#[0-9a-f]{6}$/i.test(query.background ?? '')
    ? query.background!
    : '#ffffff';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    blob: Blob;
    url: string;
    width: number;
    height: number;
  } | null>(null);
  const job = useRef<AbortController | null>(null);
  const locked = busy || documents.loading;
  useEffect(() => () => job.current?.abort(), []);
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );
  useEffect(() => {
    job.current?.abort();
    setResult(null);
    setError(null);
    setBusy(false);
  }, [documents.images, mode, width, gap, columns, background]);
  const generate = async () => {
    if (job.current && !job.current.signal.aborted && busy) return;
    const controller = new AbortController();
    job.current = controller;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const layout = collageLayout(documents.images, mode, width, gap, columns);
      const canvas = document.createElement('canvas');
      canvas.width = layout.width;
      canvas.height = layout.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('imageDocumentCommon.errors.canvas');
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < documents.images.length; index++) {
        const bitmap = await createImageBitmap(documents.images[index].blob);
        try {
          controller.signal.throwIfAborted();
          const rect = layout.placements[index];
          context.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height);
        } finally {
          bitmap.close();
        }
      }
      const blob = await canvasBlob(canvas);
      controller.signal.throwIfAborted();
      setResult({
        blob,
        url: URL.createObjectURL(blob),
        width: canvas.width,
        height: canvas.height,
      });
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          t('imageCollage.error', {
            msg: t((cause as Error).message, {
              defaultValue: (cause as Error).message,
            }),
          }),
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('imageCollage.title')}</h1>
      <DocumentUpload
        disabled={locked}
        onFiles={(files) => void documents.add(files)}
      />
      <fieldset disabled={locked} className="grid gap-3 md:grid-cols-3">
        <ChoiceField
          label={t('imageCollage.layout')}
          value={mode}
          onChange={(layout) => setQuery({ layout })}
          options={['vertical', 'horizontal', 'grid'].map((value) => ({
            value,
            label: t(`imageCollage.${value}`),
          }))}
        />
        <NumberField
          label={t('imageCollage.width')}
          value={width}
          min={50}
          step={1}
          onChange={(value) =>
            setQuery({ width: Math.round(boundedNumber(value, 800, 50, 4000)) })
          }
        />
        <NumberField
          label={t('imageCollage.gap')}
          value={gap}
          step={1}
          onChange={(value) =>
            setQuery({ gap: Math.round(boundedNumber(value, 12, 0, 200)) })
          }
        />
        {mode === 'grid' && (
          <NumberField
            label={t('imageCollage.columns')}
            value={columns}
            min={1}
            step={1}
            onChange={(value) =>
              setQuery({ columns: Math.round(boundedNumber(value, 3, 1, 10)) })
            }
          />
        )}
        <label className="space-y-1.5 text-sm">
          {t('imageCollage.background')}
          <Input
            type="color"
            value={background}
            onChange={(event) => setQuery({ background: event.target.value })}
          />
        </label>
      </fieldset>
      <DocumentImageList
        images={documents.images}
        disabled={locked}
        move={documents.move}
        remove={documents.remove}
      />
      <Button
        disabled={locked || !documents.images.length}
        onClick={() => void generate()}
      >
        {t(busy ? 'imageDocumentCommon.processing' : 'imageCollage.generate')}
      </Button>
      {(error || documents.error) && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error || documents.error}
        </p>
      )}
      {result && (
        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={() => downloadBlob(result.blob, 'collage.png')}
          >
            {t('imageCollage.download')} · {result.width} × {result.height}
          </Button>
          <img
            src={result.url}
            alt={t('imageCollage.preview')}
            className="max-h-[70vh] max-w-full rounded border object-contain"
          />
        </div>
      )}
    </div>
  );
}
