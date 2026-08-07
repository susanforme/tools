import { FileDropzone, type DroppedFile } from '@/components/file-dropzone';
import { ChoiceField } from '@/components/calculator-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob, downloadBytes } from '@/lib/download';
import {
  cleanPdfMetadata,
  extractPdfImages,
  getPdfPageCount,
  mergePdfs,
  organizePdf,
  splitPdf,
  watermarkPdf,
  type ExtractedPdfImage,
} from '@/lib/pdf-tools';
import { createFileRoute } from '@tanstack/react-router';
import { Download, FileText, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/pdf-toolkit')({
  component: PdfToolkitPage,
});

type Mode =
  | 'merge'
  | 'split'
  | 'organize'
  | 'images'
  | 'watermark'
  | 'metadata';

function PdfToolkitPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'merge');
  const [files, setFiles] = useState<File[]>([]);
  const [order, setOrder] = useState('1');
  const [rotation, setRotation] = useState(0);
  const [watermark, setWatermark] = useState('Breeze Tools');
  const [images, setImages] = useState<ExtractedPdfImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const receiveFiles = async (dropped: DroppedFile[]) => {
    const next = dropped.map(({ file }) => file);
    setFiles(mode === 'merge' ? next : next.slice(0, 1));
    setImages([]);
    if (next[0]) {
      try {
        const count = await getPdfPageCount(next[0]);
        setOrder(
          Array.from({ length: count }, (_, index) => index + 1).join(','),
        );
      } catch {
        setOrder('1');
      }
    }
  };

  const run = async () => {
    if (!files.length) return;
    setLoading(true);
    setError(null);
    setImages([]);
    try {
      if (mode === 'merge') {
        downloadBytes(await mergePdfs(files), 'merged.pdf', 'application/pdf');
      } else if (mode === 'split') {
        const pages = await splitPdf(files[0]!);
        const { zipSync } = await import('fflate');
        const entries = Object.fromEntries(
          pages.map((bytes, index) => [`page-${index + 1}.pdf`, bytes]),
        );
        downloadBytes(zipSync(entries), 'split-pages.zip', 'application/zip');
      } else if (mode === 'organize') {
        downloadBytes(
          await organizePdf(files[0]!, order, rotation),
          'organized.pdf',
          'application/pdf',
        );
      } else if (mode === 'watermark') {
        downloadBytes(
          await watermarkPdf(files[0]!, watermark),
          'watermarked.pdf',
          'application/pdf',
        );
      } else if (mode === 'metadata') {
        downloadBytes(
          await cleanPdfMetadata(files[0]!),
          'clean.pdf',
          'application/pdf',
        );
      } else {
        setImages(await extractPdfImages(files[0]!));
      }
    } catch (cause) {
      setError(t('pdfToolkit.error', { msg: (cause as Error).message }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('pdfToolkit.title')}</h1>
      <Tabs
        value={mode}
        onValueChange={(value) => {
          setMode(value as Mode);
          setFiles([]);
          setImages([]);
        }}
      >
        <TabsList className="h-auto flex-wrap">
          {(
            [
              'merge',
              'split',
              'organize',
              'images',
              'watermark',
              'metadata',
            ] as const
          ).map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`pdfToolkit.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <FileDropzone
        accept="application/pdf,.pdf"
        multiple={mode === 'merge'}
        onFiles={(dropped) => void receiveFiles(dropped)}
        className="flex min-h-40 items-center justify-center rounded-xl p-6 text-center"
      >
        <div>
          <FileText className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
          <p>{t('pdfToolkit.drop')}</p>
          {!!files.length && (
            <p className="mt-2 text-sm text-muted-foreground">
              {files.map(({ name }) => name).join(' · ')}
            </p>
          )}
        </div>
      </FileDropzone>
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
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <Button disabled={!files.length || loading} onClick={() => void run()}>
        {loading ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {t(mode === 'images' ? 'pdfToolkit.extract' : 'pdfToolkit.process')}
      </Button>
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
    </div>
  );
}
