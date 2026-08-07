import { FileDropzone } from '@/components/file-dropzone';
import { ChoiceField, NumberField } from '@/components/calculator-ui';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import { createFileRoute } from '@tanstack/react-router';
import { Download, ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/id-photo')({ component: IdPhotoPage });
const SIZES = { one: [25, 35], two: [35, 49], passport: [33, 48] } as const;
const COLORS = {
  white: [255, 255, 255],
  blue: [67, 142, 219],
  red: [220, 55, 55],
} as const;

async function makePhotos(
  file: File,
  size: keyof typeof SIZES,
  background: keyof typeof COLORS,
  threshold: number,
) {
  const bitmap = await createImageBitmap(file);
  const [widthMm, heightMm] = SIZES[size];
  const width = Math.round((widthMm / 25.4) * 300);
  const height = Math.round((heightMm / 25.4) * 300);
  const photo = document.createElement('canvas');
  photo.width = width;
  photo.height = height;
  const context = photo.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas unavailable');
  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  context.drawImage(
    bitmap,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  const image = context.getImageData(0, 0, width, height);
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    (width * height - 1) * 4,
  ];
  const sample = [0, 1, 2].map(
    (channel) =>
      corners.reduce((sum, index) => sum + image.data[index + channel]!, 0) /
      corners.length,
  );
  const replacement = COLORS[background];
  for (let index = 0; index < image.data.length; index += 4) {
    const distance = Math.hypot(
      image.data[index]! - sample[0],
      image.data[index + 1]! - sample[1],
      image.data[index + 2]! - sample[2],
    );
    if (distance <= threshold) {
      image.data[index] = replacement[0];
      image.data[index + 1] = replacement[1];
      image.data[index + 2] = replacement[2];
    }
  }
  context.putImageData(image, 0, 0);
  const sheet = document.createElement('canvas');
  sheet.width = 2480;
  sheet.height = 3508;
  const sheetContext = sheet.getContext('2d');
  if (!sheetContext) throw new Error('Canvas unavailable');
  sheetContext.fillStyle = '#ffffff';
  sheetContext.fillRect(0, 0, sheet.width, sheet.height);
  const gap = 24;
  for (let y = 60; y + height <= sheet.height - 60; y += height + gap) {
    for (let x = 60; x + width <= sheet.width - 60; x += width + gap) {
      sheetContext.drawImage(photo, x, y);
    }
  }
  const blob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('图片生成失败'))),
        'image/png',
      ),
    );
  bitmap.close();
  return { photo: await blob(photo), sheet: await blob(sheet) };
}

function IdPhotoPage() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [size, setSize] = useState<keyof typeof SIZES>('one');
  const [background, setBackground] = useState<keyof typeof COLORS>('blue');
  const [threshold, setThreshold] = useState(45);
  const [result, setResult] = useState<{
    photo: Blob;
    sheet: Blob;
    preview: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generate = async () => {
    if (!file) return;
    setError(null);
    try {
      if (result) URL.revokeObjectURL(result.preview);
      const next = await makePhotos(file, size, background, threshold);
      setResult({ ...next, preview: URL.createObjectURL(next.photo) });
    } catch (cause) {
      setError(t('idPhoto.error', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('idPhoto.title')}</h1>
      <FileDropzone
        accept="image/*"
        onFiles={(files) => setFile(files[0]?.file ?? null)}
        className="flex min-h-40 items-center justify-center rounded-xl p-6 text-center"
      >
        <div>
          <ImageIcon className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
          {file?.name ?? t('idPhoto.drop')}
        </div>
      </FileDropzone>
      <div className="grid gap-3 sm:grid-cols-3">
        <ChoiceField
          label={t('idPhoto.size')}
          value={size}
          onChange={(value) => setSize(value as keyof typeof SIZES)}
          options={Object.keys(SIZES).map((value) => ({
            value,
            label: t(`idPhoto.sizes.${value}`),
          }))}
        />
        <ChoiceField
          label={t('idPhoto.background')}
          value={background}
          onChange={(value) => setBackground(value as keyof typeof COLORS)}
          options={Object.keys(COLORS).map((value) => ({
            value,
            label: t(`idPhoto.colors.${value}`),
          }))}
        />
        <NumberField
          label={t('idPhoto.threshold')}
          value={threshold}
          min={0}
          step={1}
          onChange={setThreshold}
        />
      </div>
      <Button disabled={!file} onClick={() => void generate()}>
        {t('idPhoto.generate')}
      </Button>
      {error && <div className="text-sm text-destructive">{error}</div>}
      {result && (
        <div className="flex flex-wrap items-center gap-4">
          <img
            src={result.preview}
            alt=""
            className="max-h-72 rounded-lg border object-contain"
          />
          <Button
            variant="outline"
            onClick={() => downloadBlob(result.photo, 'id-photo.png')}
          >
            <Download className="h-4 w-4" />
            {t('idPhoto.photo')}
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadBlob(result.sheet, 'id-photo-a4.png')}
          >
            <Download className="h-4 w-4" />
            {t('idPhoto.sheet')}
          </Button>
        </div>
      )}
    </div>
  );
}
