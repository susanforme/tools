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
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { downloadBlob, downloadBytes } from '@/lib/download';
import {
  canvasBlob,
  FULL_CORNERS,
  scanImage,
  validCorners,
  type Corners,
  type Point,
} from '@/lib/image-document-tools';

export const Route = createFileRoute('/document-scanner')({
  component: DocumentScannerPage,
});
const CORNER_NAMES = [
  'topLeft',
  'topRight',
  'bottomRight',
  'bottomLeft',
] as const;

function DocumentScannerPage() {
  const { t } = useTranslation();
  const documents = useImageDocuments();
  const [query, setQuery] = useQueryParams<{
    mode: string;
    color: string;
    threshold: number;
  }>({ mode: StringParam, color: StringParam, threshold: NumberParam });
  const mode = query.mode === 'card' ? 'card' : 'document';
  const color = query.color === 'bw' ? 'bw' : 'color';
  const threshold = Math.round(boundedNumber(query.threshold, 160, 0, 255));
  const [selected, setSelected] = useState<string | null>(null);
  const image =
    documents.images.find((item) => item.id === selected) ??
    documents.images[0] ??
    null;
  const [crops, setCrops] = useState<Record<string, Corners>>({});
  const corners = image ? (crops[image.id] ?? FULL_CORNERS) : FULL_CORNERS;
  const [activeCorner, setActiveCorner] = useState(0);
  const dragging = useRef<number | null>(null);
  const editor = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(
    null,
  );
  const job = useRef<AbortController | null>(null);
  const locked = busy || documents.loading;
  useEffect(() => () => job.current?.abort(), []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  useEffect(() => {
    job.current?.abort();
    setBusy(false);
    setProgress('');
    setPreview(null);
    setError(null);
  }, [image?.id, crops, color, threshold, mode, documents.images]);
  const updateCorner = (index: number, point: Point) => {
    if (!image || locked) return;
    const next = corners.map((entry, position) =>
      position === index
        ? {
            x: Math.max(0, Math.min(1, point.x)),
            y: Math.max(0, Math.min(1, point.y)),
          }
        : entry,
    ) as Corners;
    setCrops((previous) => ({ ...previous, [image.id]: next }));
  };
  const process = async (pdf: boolean) => {
    if (!image || locked) return;
    const controller = new AbortController();
    job.current = controller;
    setBusy(true);
    setError(null);
    setProgress('');
    try {
      if (pdf) {
        const { PDFDocument, PageSizes } = await import('pdf-lib');
        controller.signal.throwIfAborted();
        const document = await PDFDocument.create();
        for (let index = 0; index < documents.images.length; index++) {
          const source = documents.images[index];
          setProgress(
            t('documentScanner.progress', {
              current: index + 1,
              total: documents.images.length,
            }),
          );
          const canvas = await scanImage(
            source,
            crops[source.id] ?? FULL_CORNERS,
            color === 'bw',
            threshold,
            controller.signal,
          );
          const blob = await canvasBlob(canvas, 'image/jpeg');
          controller.signal.throwIfAborted();
          const embedded = await document.embedJpg(await blob.arrayBuffer());
          const page =
            mode === 'card' && index % 2 === 1
              ? document.getPages().at(-1)!
              : document.addPage(PageSizes.A4);
          const boxWidth = mode === 'card' ? 244 : page.getWidth() - 48;
          const boxHeight = mode === 'card' ? 200 : page.getHeight() - 48;
          const scale = Math.min(
            boxWidth / canvas.width,
            boxHeight / canvas.height,
          );
          const width = canvas.width * scale,
            height = canvas.height * scale;
          const centerY =
            mode === 'card'
              ? page.getHeight() * (index % 2 === 0 ? 0.7 : 0.35)
              : page.getHeight() / 2;
          page.drawImage(embedded, {
            x: (page.getWidth() - width) / 2,
            y: centerY - height / 2,
            width,
            height,
          });
          canvas.width = canvas.height = 0;
        }
        const bytes = await document.save();
        controller.signal.throwIfAborted();
        downloadBytes(bytes, 'scanned-document.pdf', 'application/pdf');
      } else {
        const canvas = await scanImage(
          image,
          corners,
          color === 'bw',
          threshold,
          controller.signal,
        );
        const blob = await canvasBlob(canvas, 'image/jpeg');
        controller.signal.throwIfAborted();
        setPreview({ blob, url: URL.createObjectURL(blob) });
      }
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          t('documentScanner.error', {
            msg: t((cause as Error).message, {
              defaultValue: (cause as Error).message,
            }),
          }),
        );
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        setProgress('');
      }
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('documentScanner.title')}</h1>
      <DocumentUpload
        camera
        disabled={locked}
        onFiles={(files) => void documents.add(files)}
      />
      <fieldset disabled={locked} className="grid gap-3 md:grid-cols-3">
        <ChoiceField
          label={t('documentScanner.mode')}
          value={mode}
          onChange={(value) => setQuery({ mode: value })}
          options={['document', 'card'].map((value) => ({
            value,
            label: t(`documentScanner.${value}`),
          }))}
        />
        <ChoiceField
          label={t('documentScanner.colorMode')}
          value={color}
          onChange={(value) => setQuery({ color: value })}
          options={['color', 'bw'].map((value) => ({
            value,
            label: t(`documentScanner.${value}`),
          }))}
        />
        {color === 'bw' && (
          <NumberField
            label={t('documentScanner.threshold')}
            value={threshold}
            step={1}
            onChange={(value) =>
              setQuery({
                threshold: Math.round(boundedNumber(value, 160, 0, 255)),
              })
            }
          />
        )}
      </fieldset>
      {mode === 'card' && (
        <p className="text-sm text-muted-foreground">
          {t('documentScanner.cardHint')}
        </p>
      )}
      <DocumentImageList
        images={documents.images}
        disabled={locked}
        move={documents.move}
        remove={documents.remove}
        selected={image?.id}
        onSelect={setSelected}
      />
      {image && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm">{t('documentScanner.cornerHint')}</p>
            <svg
              ref={editor}
              viewBox={`0 0 ${image.width} ${image.height}`}
              className="max-h-[60vh] w-full touch-none rounded-lg border bg-muted"
              aria-label={t('documentScanner.crop')}
              onPointerMove={(event) => {
                if (dragging.current === null || locked) return;
                const matrix = editor.current?.getScreenCTM();
                if (!matrix) return;
                const point = new DOMPoint(
                  event.clientX,
                  event.clientY,
                ).matrixTransform(matrix.inverse());
                updateCorner(dragging.current, {
                  x: point.x / image.width,
                  y: point.y / image.height,
                });
              }}
              onPointerUp={() => {
                dragging.current = null;
              }}
              onPointerCancel={() => {
                dragging.current = null;
              }}
            >
              <image
                href={image.url}
                width={image.width}
                height={image.height}
              />
              <polygon
                points={corners
                  .map(({ x, y }) => `${x * image.width},${y * image.height}`)
                  .join(' ')}
                className="fill-primary/10 stroke-primary"
                strokeWidth={Math.max(image.width, image.height) / 250}
              />
              {corners.map((point, index) => (
                <circle
                  key={index}
                  cx={point.x * image.width}
                  cy={point.y * image.height}
                  r={Math.max(image.width, image.height) / 45}
                  tabIndex={locked ? -1 : 0}
                  role="button"
                  aria-label={t(`documentScanner.${CORNER_NAMES[index]}`)}
                  className="cursor-move fill-primary stroke-background focus:fill-foreground"
                  strokeWidth={3}
                  onFocus={() => setActiveCorner(index)}
                  onPointerDown={(event) => {
                    if (locked) return;
                    event.preventDefault();
                    dragging.current = index;
                    setActiveCorner(index);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onKeyDown={(event) => {
                    const step = event.shiftKey ? 0.02 : 0.002;
                    const delta: Record<string, Point> = {
                      ArrowLeft: { x: -step, y: 0 },
                      ArrowRight: { x: step, y: 0 },
                      ArrowUp: { x: 0, y: -step },
                      ArrowDown: { x: 0, y: step },
                    };
                    const direction = delta[event.key];
                    if (direction) {
                      event.preventDefault();
                      updateCorner(index, {
                        x: point.x + direction.x,
                        y: point.y + direction.y,
                      });
                    }
                  }}
                />
              ))}
            </svg>
            <fieldset disabled={locked} className="grid gap-3 md:grid-cols-3">
              <ChoiceField
                label={t('documentScanner.corner')}
                value={String(activeCorner)}
                onChange={(value) => setActiveCorner(Number(value))}
                options={CORNER_NAMES.map((name, index) => ({
                  value: String(index),
                  label: t(`documentScanner.${name}`),
                }))}
              />
              <NumberField
                label={t('documentScanner.x')}
                value={Math.round(corners[activeCorner].x * 1000) / 10}
                step={0.1}
                onChange={(value) =>
                  updateCorner(activeCorner, {
                    ...corners[activeCorner],
                    x: value / 100,
                  })
                }
              />
              <NumberField
                label={t('documentScanner.y')}
                value={Math.round(corners[activeCorner].y * 1000) / 10}
                step={0.1}
                onChange={(value) =>
                  updateCorner(activeCorner, {
                    ...corners[activeCorner],
                    y: value / 100,
                  })
                }
              />
            </fieldset>
            <Button
              variant="outline"
              disabled={locked}
              onClick={() =>
                setCrops((previous) => ({
                  ...previous,
                  [image.id]: FULL_CORNERS,
                }))
              }
            >
              {t('documentScanner.reset')}
            </Button>
            {!validCorners(corners) && (
              <p role="alert" className="text-sm text-destructive">
                {t('documentScanner.invalidCorners')}
              </p>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={locked || !validCorners(corners)}
                onClick={() => void process(false)}
              >
                {t('documentScanner.preview')}
              </Button>
              <Button
                variant="outline"
                disabled={
                  locked ||
                  !documents.images.every((source) =>
                    validCorners(crops[source.id] ?? FULL_CORNERS),
                  )
                }
                onClick={() => void process(true)}
              >
                {t('documentScanner.pdf')}
              </Button>
              {busy && (
                <Button
                  variant="outline"
                  onClick={() => {
                    job.current?.abort();
                    setBusy(false);
                    setProgress('');
                  }}
                >
                  {t('imageDocumentCommon.cancel')}
                </Button>
              )}
            </div>
            {preview && (
              <>
                <img
                  src={preview.url}
                  alt={t('documentScanner.preview')}
                  className="max-h-[65vh] max-w-full rounded border object-contain"
                />
                <Button
                  variant="outline"
                  onClick={() => downloadBlob(preview.blob, 'scan.jpg')}
                >
                  {t('documentScanner.download')}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      {(busy || documents.loading) && (
        <p role="status" className="text-sm text-muted-foreground">
          {progress || t('imageDocumentCommon.processing')}
        </p>
      )}
      {(error || documents.error) && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error || documents.error}
        </p>
      )}
    </div>
  );
}
