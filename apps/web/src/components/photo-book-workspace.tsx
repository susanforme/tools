import { NumberParam, useQueryParams } from '@/hooks/useQueryParams';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { drawBookPage, type BookPage } from '@/lib/photo-book-layout';
import type { BookRequest } from '@/lib/photo-book.worker';
import { downloadBytes } from '@/lib/download';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceField, NumberField } from './calculator-ui';
import { DocumentUpload, useImageDocuments } from './image-document-inputs';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
const worker = () =>
  new Worker(new URL('../lib/photo-book.worker.ts', import.meta.url), {
    type: 'module',
  });
export default function PhotoBook() {
  const { t } = useTranslation(),
    label = (key: string) => t(`mediaWorkspace.${key}`);
  const documents = useImageDocuments();
  const [pages, setPages] = useState<BookPage[]>([
      { id: 'cover', template: 'cover', photos: [], text: '' },
    ]),
    [selected, setSelected] = useState(0),
    [error, setError] = useState<string | null>(null);
  const [q, setQ] = useQueryParams<{
    width: number;
    height: number;
    bleed: number;
    margin: number;
  }>({
    width: NumberParam,
    height: NumberParam,
    bleed: NumberParam,
    margin: NumberParam,
  });
  const options = {
    width: q.width ?? 210,
    height: q.height ?? 297,
    bleed: q.bleed ?? 3,
    margin: q.margin ?? 12,
  };
  const page = pages[selected]!;
  const job = useBoundedWorker<BookRequest, Uint8Array>(worker, 120000);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    job.clear();
  }, [
    pages,
    documents.images,
    q.width,
    q.height,
    q.bleed,
    q.margin,
    job.clear,
  ]);
  useEffect(() => {
    let cancelled = false;
    const preview = document.createElement('canvas');
    setError(null);
    void drawBookPage(
      preview,
      page,
      Object.fromEntries(documents.images.map((i) => [i.id, i.blob])),
      options,
    )
      .then(() => {
        if (cancelled || !canvas.current) return;
        canvas.current.width = preview.width;
        canvas.current.height = preview.height;
        canvas.current.getContext('2d')?.drawImage(preview, 0, 0);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        preview.width = preview.height = 0;
      });
    return () => {
      cancelled = true;
    };
  }, [page, documents.images, q.width, q.height, q.bleed, q.margin]);
  const change = (patch: Partial<BookPage>) =>
    setPages(pages.map((p, i) => (i === selected ? { ...p, ...patch } : p)));
  const move = (delta: number) => {
    const target = selected + delta;
    if (target < 0 || target >= pages.length) return;
    const next = [...pages];
    const [p] = next.splice(selected, 1);
    next.splice(target, 0, p!);
    setPages(next);
    setSelected(target);
  };
  return (
    <div className="space-y-4">
      <DocumentUpload
        disabled={job.busy || documents.loading}
        onFiles={(files) => void documents.add(files)}
      />
      <p className="text-sm text-muted-foreground">{label('bookHint')}</p>
      <fieldset disabled={job.busy} className="min-w-0 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          {(['width', 'height', 'bleed', 'margin'] as const).map((key) => (
            <NumberField
              key={key}
              label={label(
                key === 'width'
                  ? 'pageWidth'
                  : key === 'height'
                    ? 'pageHeight'
                    : key,
              )}
              value={options[key]}
              min={key === 'bleed' ? 0 : key === 'margin' ? 5 : 100}
              max={key === 'bleed' ? 10 : key === 'margin' ? 40 : 350}
              onChange={(value) => setQ({ [key]: value })}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {pages.map((p, i) => (
            <Button
              key={p.id}
              variant={selected === i ? 'default' : 'outline'}
              onClick={() => setSelected(i)}
            >
              {i + 1}
            </Button>
          ))}
          <Button
            variant="outline"
            disabled={pages.length >= 30}
            onClick={() => {
              setPages([
                ...pages,
                {
                  id: crypto.randomUUID(),
                  template: 'caption',
                  photos: [],
                  text: '',
                },
              ]);
              setSelected(pages.length);
            }}
          >
            {label('addPage')}
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <ChoiceField
            label={label('template')}
            value={page.template}
            options={['cover', 'single', 'pair', 'caption', 'bleed'].map(
              (value) => ({ value, label: label(`templates.${value}`) }),
            )}
            onChange={(template) => change({ template })}
          />
          {Array.from({ length: page.template === 'pair' ? 2 : 1 }, (_, i) => (
            <ChoiceField
              key={i}
              label={`${label('photo')} ${i + 1}`}
              value={page.photos[i] ?? 'none'}
              options={[
                { value: 'none', label: label('none') },
                ...documents.images.map((im) => ({
                  value: im.id,
                  label: im.name,
                })),
              ]}
              onChange={(value) => {
                const photos = [...page.photos];
                photos[i] = value === 'none' ? '' : value;
                change({ photos });
              }}
            />
          ))}
        </div>
        <Label htmlFor="book-caption">{label('caption')}</Label>
        <Textarea
          id="book-caption"
          maxLength={1000}
          value={page.text}
          onChange={(e) => change({ text: e.target.value })}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!selected}
            onClick={() => move(-1)}
          >
            {label('previous')}
          </Button>
          <Button
            variant="outline"
            disabled={selected === pages.length - 1}
            onClick={() => move(1)}
          >
            {label('next')}
          </Button>
          <Button
            variant="outline"
            disabled={pages.length <= 1}
            onClick={() => {
              setPages(pages.filter((_, i) => i !== selected));
              setSelected(0);
            }}
          >
            {label('removePage')}
          </Button>
        </div>
      </fieldset>
      <canvas
        ref={canvas}
        className="mx-auto max-h-[650px] max-w-full border"
        aria-label={label('bookPreview')}
      />
      <div className="flex gap-2">
        <Button
          disabled={job.busy || documents.loading || !!error}
          onClick={() =>
            job.run({
              pages,
              images: Object.fromEntries(
                documents.images.map((i) => [i.id, i.blob]),
              ),
              options,
            })
          }
        >
          {label('generatePdf')}
        </Button>
        {job.busy && (
          <Button variant="outline" onClick={job.cancel}>
            {label('cancel')}
          </Button>
        )}
        {job.result && (
          <Button
            onClick={() =>
              downloadBytes(job.result!, 'photo-book.pdf', 'application/pdf')
            }
          >
            {label('download')}
          </Button>
        )}
      </div>
      {job.busy && <p role="status">{label('processing')}</p>}
      {(error || job.error || documents.error) && (
        <p role="alert" className="text-destructive">
          {t('mediaWorkspace.failed', {
            msg:
              documents.error ||
              t(`mediaWorkspace.errors.${error || job.error}`, {
                defaultValue: error || job.error || '',
              }),
          })}
        </p>
      )}
    </div>
  );
}
