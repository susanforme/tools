import { FileDropzone } from '@/components/file-dropzone';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { extractPalette, type PaletteColor } from '@/lib/image-palette';
import { createFileRoute } from '@tanstack/react-router';
import { Copy, ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/image-palette')({
  component: ImagePalettePage,
});

function ImagePalettePage() {
  const { t } = useTranslation();
  const [preview, setPreview] = useState('');
  const [colors, setColors] = useState<PaletteColor[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async (file: File) => {
    setError(null);
    try {
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(file));
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 240 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      setColors(
        extractPalette(
          context.getImageData(0, 0, canvas.width, canvas.height).data,
        ),
      );
      bitmap.close();
    } catch (cause) {
      setError(t('imagePalette.error', { msg: (cause as Error).message }));
    }
  };
  const css = colors
    .map(({ hex }, index) => `--color-${index + 1}: ${hex};`)
    .join('\n');
  const tailwind = colors
    .map(({ hex }, index) => `'palette-${index + 1}': '${hex}',`)
    .join('\n');

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('imagePalette.title')}</h1>
      <FileDropzone
        accept="image/*"
        onFiles={(files) => files[0] && void load(files[0].file)}
        className="flex min-h-40 items-center justify-center rounded-xl p-6 text-center"
      >
        {preview ? (
          <img
            src={preview}
            alt=""
            className="max-h-56 rounded-lg object-contain"
          />
        ) : (
          <div>
            <ImageIcon className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
            {t('imagePalette.drop')}
          </div>
        )}
      </FileDropzone>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {colors.map((color) => (
          <div key={color.hex} className="overflow-hidden rounded-xl border">
            <input
              type="color"
              aria-label={color.hex}
              className="block h-20 w-full cursor-pointer border-0 p-0"
              value={color.hex}
              readOnly
            />
            <button
              type="button"
              className="flex w-full items-center justify-between p-3 text-sm"
              onClick={() => void navigator.clipboard.writeText(color.hex)}
            >
              <span>{color.hex}</span>
              <span className="text-muted-foreground">
                {color.contrast.toFixed(2)}:1
              </span>
            </button>
          </div>
        ))}
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
      {!!colors.length && (
        <div className="grid gap-4 md:grid-cols-2">
          <CodeOutput title="CSS" value={css} />
          <CodeOutput title="Tailwind" value={tailwind} />
        </div>
      )}
    </div>
  );
}

function CodeOutput({ title, value }: { title: string; value: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">{title}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void navigator.clipboard.writeText(value)}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <Textarea readOnly className="min-h-40 font-mono" value={value} />
    </div>
  );
}
