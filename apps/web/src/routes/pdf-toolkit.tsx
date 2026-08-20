import { ChoiceField } from '@/components/calculator-ui';
import { FileDropzone, type DroppedFile } from '@/components/file-dropzone';
import { PdfSignaturePanel } from '@/components/recommended-tool-panels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob, downloadBytes } from '@/lib/download';
import {
  cleanPdfMetadata,
  editPdfText,
  extractPdfImages,
  getPdfPageCount,
  mergePdfs,
  organizePdf,
  renderPdfPage,
  splitPdf,
  watermarkPdf,
  PdfInvalidPasswordError,
  PdfPasswordRequiredError,
  type ExtractedPdfImage,
  type PdfPagePreview,
  type PdfTextItem,
} from '@/lib/pdf-tools';
import { createFileRoute } from '@tanstack/react-router';
import {
  Combine,
  Download,
  Eraser,
  FileText,
  Image,
  ListOrdered,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  RotateCw,
  ShieldCheck,
  Split,
  Stamp,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/pdf-toolkit')({
  component: PdfToolkitPage,
});

type Mode =
  | 'edit'
  | 'merge'
  | 'split'
  | 'organize'
  | 'images'
  | 'watermark'
  | 'metadata'
  | 'signature';

const TOOLBAR: Array<{ mode: Mode; icon: typeof Pencil }> = [
  { mode: 'edit', icon: Pencil },
  { mode: 'merge', icon: Combine },
  { mode: 'split', icon: Split },
  { mode: 'organize', icon: RotateCw },
  { mode: 'images', icon: Image },
  { mode: 'watermark', icon: Stamp },
  { mode: 'metadata', icon: Eraser },
  { mode: 'signature', icon: ShieldCheck },
];

function PdfToolkitPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'edit');
  const [files, setFiles] = useState<File[]>([]);
  const [order, setOrder] = useState('1');
  const [rotation, setRotation] = useState(0);
  const [watermark, setWatermark] = useState('Breeze Tools');
  const [images, setImages] = useState<ExtractedPdfImage[]>([]);
  const [preview, setPreview] = useState<PdfPagePreview | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [edits, setEdits] = useState<Record<string, PdfTextItem>>({});
  const [password, setPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [forceRead, setForceRead] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPage = async (
    file: File,
    nextPage = 1,
    nextPassword = password,
  ) => {
    setPreviewLoading(true);
    setError(null);
    try {
      const result = await renderPdfPage(
        file,
        nextPage,
        nextPassword || undefined,
      );
      setPageCount(result.pageCount);
      setPageNumber(nextPage);
      setPreview(result.page);
      setRequiresPassword(false);
    } catch (cause) {
      if (cause instanceof PdfPasswordRequiredError && forceRead) {
        try {
          setPageCount(await getPdfPageCount(file, { ignoreEncryption: true }));
          setPreview(null);
          setRequiresPassword(false);
          setError(t('pdfToolkit.forceReadPreview'));
        } catch (fallbackCause) {
          setError(
            t('pdfToolkit.error', { msg: (fallbackCause as Error).message }),
          );
        }
      } else if (cause instanceof PdfPasswordRequiredError) {
        setRequiresPassword(true);
      } else if (cause instanceof PdfInvalidPasswordError) {
        setRequiresPassword(true);
        setError(t('pdfToolkit.invalidPassword'));
      } else if (forceRead) {
        try {
          setPageCount(await getPdfPageCount(file, { ignoreEncryption: true }));
          setPreview(null);
          setError(t('pdfToolkit.forceReadPreview'));
        } catch (fallbackCause) {
          setError(
            t('pdfToolkit.error', { msg: (fallbackCause as Error).message }),
          );
        }
      } else {
        setError(t('pdfToolkit.error', { msg: (cause as Error).message }));
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const receiveFiles = async (dropped: DroppedFile[]) => {
    const next = dropped.map(({ file }) => file);
    const selected = mode === 'merge' ? next : next.slice(0, 1);
    setFiles(selected);
    setImages([]);
    setEdits({});
    setPageCount(0);
    setPageNumber(1);
    setPassword('');
    setRequiresPassword(false);
    if (selected[0]) {
      try {
        const count = await getPdfPageCount(selected[0]);
        setPageCount(count);
        setOrder(
          Array.from({ length: count }, (_, index) => index + 1).join(','),
        );
      } catch {
        setOrder('1');
      }
      await openPage(selected[0]);
    }
  };

  const run = async () => {
    if (!files.length) return;
    setLoading(true);
    setError(null);
    setImages([]);
    const options = { ignoreEncryption: forceRead };
    try {
      if (mode === 'edit') {
        downloadBytes(
          await editPdfText(files[0]!, edits, options),
          'edited.pdf',
          'application/pdf',
        );
      } else if (mode === 'merge') {
        downloadBytes(
          await mergePdfs(files, options),
          'merged.pdf',
          'application/pdf',
        );
      } else if (mode === 'split') {
        const pages = await splitPdf(files[0]!, options);
        const { zipSync } = await import('fflate');
        const entries = Object.fromEntries(
          pages.map((bytes, index) => [`page-${index + 1}.pdf`, bytes]),
        );
        downloadBytes(zipSync(entries), 'split-pages.zip', 'application/zip');
      } else if (mode === 'organize') {
        downloadBytes(
          await organizePdf(files[0]!, order, rotation, options),
          'organized.pdf',
          'application/pdf',
        );
      } else if (mode === 'watermark') {
        downloadBytes(
          await watermarkPdf(files[0]!, watermark, options),
          'watermarked.pdf',
          'application/pdf',
        );
      } else if (mode === 'metadata') {
        downloadBytes(
          await cleanPdfMetadata(files[0]!, options),
          'clean.pdf',
          'application/pdf',
        );
      } else if (mode === 'images') {
        setImages(await extractPdfImages(files[0]!, password || undefined));
      }
    } catch (cause) {
      setError(t('pdfToolkit.error', { msg: (cause as Error).message }));
    } finally {
      setLoading(false);
    }
  };

  const activeFile = files[0];
  const toolbar = (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
      {TOOLBAR.map(({ mode: toolMode, icon: Icon }) => (
        <Button
          key={toolMode}
          size="sm"
          variant={mode === toolMode ? 'default' : 'ghost'}
          onClick={() => {
            setMode(toolMode);
            setImages([]);
            setError(null);
          }}
          aria-label={t(`pdfToolkit.${toolMode}`)}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">
            {t(`pdfToolkit.${toolMode}`)}
          </span>
        </Button>
      ))}
      {!!activeFile && mode !== 'signature' && (
        <Button
          className="ml-auto"
          size="sm"
          disabled={loading}
          onClick={() => void run()}
        >
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {t(mode === 'images' ? 'pdfToolkit.extract' : 'pdfToolkit.process')}
        </Button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('pdfToolkit.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('pdfToolkit.subtitle')}
        </p>
      </div>
      {toolbar}
      {!activeFile ? (
        <FileDropzone
          accept="application/pdf,.pdf"
          multiple={mode === 'merge'}
          onFiles={(dropped) => void receiveFiles(dropped)}
          className="flex min-h-56 items-center justify-center rounded-xl p-6 text-center"
        >
          <div>
            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p>{t('pdfToolkit.drop')}</p>
          </div>
        </FileDropzone>
      ) : mode === 'signature' ? (
        <PdfSignaturePanel />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-sm">
            <span className="font-medium">{activeFile.name}</span>
            {!!pageCount && (
              <span className="text-muted-foreground">
                {pageCount} {t('pdfToolkit.pages')}
              </span>
            )}
            <FileDropzone
              accept="application/pdf,.pdf"
              multiple={mode === 'merge'}
              onFiles={(dropped) => void receiveFiles(dropped)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {t('pdfToolkit.replace')}
            </FileDropzone>
            <label className="ml-auto flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={forceRead}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  setForceRead(enabled);
                  if (enabled && activeFile)
                    void openPage(activeFile, pageNumber);
                }}
              />
              <LockKeyhole className="h-3.5 w-3.5" />
              {t('pdfToolkit.forceRead')}
            </label>
          </div>
          {requiresPassword && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="min-w-60 flex-1 space-y-1.5">
                <Label>{t('pdfToolkit.password')}</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter')
                      void openPage(activeFile, 1, password);
                  }}
                />
              </div>
              <Button
                onClick={() => void openPage(activeFile, 1, password)}
                disabled={previewLoading}
              >
                {t('pdfToolkit.unlock')}
              </Button>
            </div>
          )}
          {mode === 'organize' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('pdfToolkit.order')}</Label>
                <Input
                  value={order}
                  onChange={(event) => setOrder(event.target.value)}
                />
              </div>
              <ChoiceField
                label={t('pdfToolkit.rotation')}
                value={String(rotation)}
                onChange={(value) => setRotation(Number(value))}
                options={[0, 90, 180, 270].map((value) => ({
                  value: String(value),
                  label: `${value}°`,
                }))}
              />
            </div>
          )}
          {mode === 'watermark' && (
            <div className="space-y-1.5">
              <Label>{t('pdfToolkit.watermarkText')}</Label>
              <Input
                value={watermark}
                onChange={(event) => setWatermark(event.target.value)}
              />
            </div>
          )}
          {mode === 'edit' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Pencil className="h-3.5 w-3.5" />
              {t('pdfToolkit.editHint')}
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
            <div className="flex gap-2 overflow-x-auto lg:block lg:space-y-2">
              {Array.from({ length: pageCount }, (_, index) => index + 1).map(
                (number) => (
                  <Button
                    key={number}
                    size="sm"
                    variant={pageNumber === number ? 'default' : 'outline'}
                    className="w-full shrink-0 justify-start"
                    onClick={() => void openPage(activeFile, number)}
                  >
                    <ListOrdered className="h-4 w-4" />
                    {t('pdfToolkit.page', { number })}
                  </Button>
                ),
              )}
            </div>
            <div className="min-h-[480px] overflow-auto rounded-xl border bg-muted/20 p-4">
              {previewLoading ? (
                <LoaderCircle className="mx-auto mt-24 h-8 w-8 animate-spin text-muted-foreground" />
              ) : preview ? (
                <div className="mx-auto w-fit shadow-xl">
                  <div
                    className="relative"
                    style={{ width: preview.width, height: preview.height }}
                  >
                    <img
                      src={preview.dataUrl}
                      alt={t('pdfToolkit.page', { number: pageNumber })}
                      className="block max-w-full"
                    />
                    {mode === 'edit' &&
                      preview.items.map((item) => {
                        const value = edits[item.id] ?? item;
                        return (
                          <input
                            key={item.id}
                            value={value.text}
                            aria-label={t('pdfToolkit.editText')}
                            onChange={(event) =>
                              setEdits((current) => ({
                                ...current,
                                [item.id]: {
                                  ...value,
                                  text: event.target.value,
                                },
                              }))
                            }
                            className="absolute border border-transparent bg-transparent px-0 text-transparent caret-foreground outline-none hover:border-primary/40 focus:border-primary focus:bg-background/90 focus:text-foreground"
                            style={{
                              left: item.x,
                              top: item.y,
                              width: item.width,
                              height: item.height,
                              fontSize: item.fontSize,
                            }}
                          />
                        );
                      })}
                  </div>
                </div>
              ) : (
                <p className="py-24 text-center text-sm text-muted-foreground">
                  {t('pdfToolkit.forceReadPreview')}
                </p>
              )}
            </div>
          </div>
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {!!images.length && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((image) => (
                <Button
                  key={image.name}
                  variant="outline"
                  onClick={() => downloadBlob(image.blob, image.name)}
                >
                  <Download className="h-4 w-4" />
                  {image.name}
                </Button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
