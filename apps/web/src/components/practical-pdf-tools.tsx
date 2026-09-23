import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { renderPdfPage, type PdfPagePreview } from '@/lib/pdf-tools';
import { createBooklet, bookletSheets } from '@/lib/practical-pdf';
import { downloadBytes } from '@/lib/download';
import { createPixelDiff } from '@/lib/image-diff';
import { PracticalFrame, useLatestJob } from './practical-ui';
import { ChoiceField, NumberField } from './calculator-ui';
import { OrganizerInput } from './organizer-store';
import { FileDropzone } from './file-dropzone';
import { Button } from './ui/button';

type ComparedPage = {
  first: PdfPagePreview;
  second: PdfPagePreview;
  count: number;
  counts: number[];
  missing: boolean[];
  diff: string;
  overlay: string;
  percent: number;
  text: Array<{ value: string; added?: boolean; removed?: boolean }>;
};
async function comparePages(
  first: File,
  second: File,
  page: number,
  opacity: number,
  passwordA: string,
  passwordB: string,
): Promise<ComparedPage> {
  if (first.size > 20 * 1024 ** 2 || second.size > 20 * 1024 ** 2)
    throw new Error('fileLimit');
  const firstPages = await Promise.all([
    renderPdfPage(first, 1, passwordA),
    renderPdfPage(second, 1, passwordB),
  ]);
  const counts = firstPages.map((value) => value.pageCount);
  if (page > Math.max(...counts)) throw new Error('invalid');
  const missing = counts.map((count) => page > count);
  const pages = await Promise.all(
    firstPages.map((value, i) =>
      page === 1
        ? value
        : missing[i]
          ? null
          : renderPdfPage(i ? second : first, page, i ? passwordB : passwordA),
    ),
  );
  const present = pages.filter(
    (value): value is NonNullable<typeof value> => value !== null,
  );
  const width = Math.ceil(
      Math.max(...present.map((value) => value.page.width)),
    ),
    height = Math.ceil(Math.max(...present.map((value) => value.page.height)));
  if (width * height > 16_000_000) throw new Error('fileLimit');
  const blank = document.createElement('canvas');
  blank.width = width;
  blank.height = height;
  const blankContext = blank.getContext('2d')!;
  blankContext.fillStyle = '#fff';
  blankContext.fillRect(0, 0, width, height);
  const [a, b] = pages.map(
    (value) =>
      value ?? {
        pageCount: 0,
        page: { dataUrl: blank.toDataURL(), width, height, items: [] },
      },
  );
  const canvases = await Promise.all(
    [a, b].map(async (value) => {
      const image = new Image();
      image.src = value.page.dataUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0);
      return canvas;
    }),
  );
  const diff = createPixelDiff(
    canvases[0].getContext('2d')!.getImageData(0, 0, width, height),
    canvases[1].getContext('2d')!.getImageData(0, 0, width, height),
    true,
  );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.putImageData(diff.image, 0, 0);
  const diffUrl = canvas.toDataURL();
  context.drawImage(canvases[0], 0, 0);
  context.globalAlpha = opacity / 100;
  context.drawImage(canvases[1], 0, 0);
  const { diffWords } = await import('diff');
  return {
    first: a.page,
    second: b.page,
    count: Math.max(...counts),
    counts,
    missing,
    diff: diffUrl,
    overlay: canvas.toDataURL(),
    percent: (diff.changed / diff.total) * 100,
    text: diffWords(
      a.page.items.map((item) => item.text).join(' '),
      b.page.items.map((item) => item.text).join(' '),
    ),
  };
}
export function PracticalPdfTools({
  kind,
}: {
  kind: 'pdf-compare' | 'pdf-booklet';
}) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<Array<File | null>>([null, null]);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1),
    [passwordA, setPasswordA] = useState(''),
    [passwordB, setPasswordB] = useState('');
  const [query, setQuery] = useQueryParams<{
    mode: string;
    opacity: number;
    paper: string;
    margin: number;
    binding: string;
    sides: string;
  }>({
    mode: StringParam,
    opacity: NumberParam,
    paper: StringParam,
    margin: NumberParam,
    binding: StringParam,
    sides: StringParam,
  });
  const mode = query.mode ?? 'side',
    opacity = Math.min(100, Math.max(0, query.opacity ?? 50)),
    paper = query.paper ?? 'a4',
    margin = query.margin ?? 5,
    binding = query.binding ?? 'left',
    sides = query.sides ?? 'all';
  const compared = useLatestJob<ComparedPage>(
    JSON.stringify([revision, page, opacity, passwordA, passwordB]),
  );
  const booklet = useLatestJob<{
    bytes: Uint8Array;
    pages: Array<[number | null, number | null]>;
  }>(JSON.stringify([revision, paper, margin, binding, sides]));
  const previews = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const busy = compared.busy || booklet.busy;
  const [requested, setRequested] = useState(0);
  useEffect(() => {
    if (kind !== 'pdf-compare' || !requested || !files[0] || !files[1]) return;
    const timer = setTimeout(
      () =>
        void compared.run(() => {
          if (!Number.isInteger(page) || page < 1) throw new Error('invalid');
          return comparePages(
            files[0]!,
            files[1]!,
            page,
            opacity,
            passwordA,
            passwordB,
          );
        }),
      150,
    );
    return () => clearTimeout(timer);
  }, [kind, requested, revision, page, opacity, passwordA, passwordB]);
  return (
    <PracticalFrame id={kind} error={compared.error ?? booklet.error}>
      <div className="grid gap-3 md:grid-cols-2">
        {(kind === 'pdf-compare' ? [0, 1] : [0]).map((index) => (
          <FileDropzone
            key={index}
            accept=".pdf,application/pdf"
            onFiles={(entries) => {
              setFiles((current) =>
                current.map((file, i) =>
                  i === index ? (entries[0]?.file ?? null) : file,
                ),
              );
              setRevision((n) => n + 1);
              setPage(1);
            }}
            className="block rounded-lg p-6 text-center"
          >
            {t(index ? 'studio20.second' : 'studio20.first')}:{' '}
            {files[index]?.name ?? 'PDF'} (20 MB)
          </FileDropzone>
        ))}
      </div>
      {kind === 'pdf-compare' ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <ChoiceField
              label={t('studio20.mode')}
              value={mode}
              onChange={(mode) => setQuery({ mode })}
              options={['side', 'textDiff', 'overlay', 'difference'].map(
                (value) => ({ value, label: t(`studio20.${value}`) }),
              )}
            />
            <NumberField
              label={t('studio20.page')}
              value={page}
              min={1}
              step={1}
              onChange={setPage}
            />
            <NumberField
              label={t('studio20.opacity')}
              value={opacity}
              onChange={(opacity) => setQuery({ opacity })}
            />
          </div>
          <details>
            <summary>{t('studio20.password')}</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <OrganizerInput
                type="password"
                label={t('studio20.first')}
                value={passwordA}
                onChange={(e) => setPasswordA(e.target.value)}
              />
              <OrganizerInput
                type="password"
                label={t('studio20.second')}
                value={passwordB}
                onChange={(e) => setPasswordB(e.target.value)}
              />
            </div>
          </details>
          <Button
            disabled={busy || files.some((file) => !file)}
            onClick={() => setRequested((n) => n + 1)}
          >
            {t(busy ? 'studio20.busy' : 'studio20.run')}
          </Button>
          {compared.result && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  {t('studio20.previous')}
                </Button>
                <span>
                  {page} / {compared.result.count} ·{' '}
                  {compared.result.counts.join(' / ')}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= compared.result.count}
                  onClick={() => setPage(page + 1)}
                >
                  {t('studio20.next')}
                </Button>
                <span>
                  {t('studio20.changedPixels')}:{' '}
                  {compared.result.percent.toFixed(2)}%
                </span>
              </div>
              {mode === 'textDiff' ? (
                <div className="whitespace-pre-wrap break-words rounded-lg border p-4">
                  {compared.result.text.map((part, index) => (
                    <span
                      key={index}
                      className={
                        part.added
                          ? 'bg-green-500/20 text-green-700 dark:text-green-300'
                          : part.removed
                            ? 'bg-red-500/20 text-red-700 line-through dark:text-red-300'
                            : ''
                      }
                    >
                      {part.value}
                    </span>
                  ))}
                </div>
              ) : mode === 'side' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {[compared.result.first, compared.result.second].map(
                    (preview, index) => (
                      <div
                        key={index}
                        ref={previews[index]}
                        className="max-h-[70vh] overflow-auto rounded border"
                        onScroll={(e) => {
                          const other = previews[1 - index].current;
                          if (
                            other &&
                            Math.abs(
                              other.scrollTop - e.currentTarget.scrollTop,
                            ) > 1
                          )
                            other.scrollTop = e.currentTarget.scrollTop;
                        }}
                      >
                        {compared.result!.missing[index] && (
                          <p className="p-3 text-sm">
                            {t('studio20.missingPage')}
                          </p>
                        )}
                        <img
                          src={preview.dataUrl}
                          alt={t(index ? 'studio20.second' : 'studio20.first')}
                          className="w-full"
                        />
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <img
                  src={
                    mode === 'difference'
                      ? compared.result.diff
                      : compared.result.overlay
                  }
                  alt={t('studio20.preview')}
                  className="mx-auto max-h-[80vh] max-w-full border"
                />
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <ChoiceField
              label={t('studio20.paper')}
              value={paper}
              onChange={(paper) => setQuery({ paper })}
              options={['a4', 'letter'].map((value) => ({
                value,
                label: value.toUpperCase(),
              }))}
            />
            <ChoiceField
              label={t('studio20.binding')}
              value={binding}
              onChange={(binding) => setQuery({ binding })}
              options={['left', 'right'].map((value) => ({
                value,
                label: t(`studio20.${value}`),
              }))}
            />
            <ChoiceField
              label={t('studio20.duplex')}
              value={sides}
              onChange={(sides) => setQuery({ sides })}
              options={['all', 'front', 'back'].map((value) => ({
                value,
                label: t(`studio20.${value}`),
              }))}
            />
            <NumberField
              label={t('studio20.margin')}
              value={margin}
              onChange={(margin) => setQuery({ margin })}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('studio20.bookletNote')}
          </p>
          <Button
            disabled={busy || !files[0]}
            onClick={() =>
              void booklet.run(async () => {
                const bytes = await createBooklet(
                  files[0]!,
                  paper,
                  margin,
                  binding,
                  sides,
                );
                const { PDFDocument } = await import('pdf-lib');
                const source = await PDFDocument.load(
                  await files[0]!.arrayBuffer(),
                );
                return {
                  bytes,
                  pages: bookletSheets(
                    source.getPageCount(),
                    binding === 'right',
                  ),
                };
              })
            }
          >
            {t(busy ? 'studio20.busy' : 'studio20.run')}
          </Button>
          {booklet.result && (
            <>
              <Button
                onClick={() =>
                  downloadBytes(
                    booklet.result!.bytes,
                    `booklet-${sides}.pdf`,
                    'application/pdf',
                  )
                }
              >
                {t('studio20.pdf')}
              </Button>
              <div className="grid gap-3 md:grid-cols-4">
                {booklet.result.pages.map((pair, index) => (
                  <div key={index} className="rounded border p-3 text-center">
                    <span className="text-xs text-muted-foreground">
                      {Math.floor(index / 2) + 1} ·{' '}
                      {t(index % 2 ? 'studio20.back' : 'studio20.front')}
                    </span>
                    <div className="mt-2 flex justify-around font-mono text-xl">
                      {pair.map((page, i) => (
                        <span key={i}>{page === null ? '—' : page + 1}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </PracticalFrame>
  );
}
