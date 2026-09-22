import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import {
  importImage,
  MAX_IMAGES,
  type ImageSource,
} from '@/lib/image-document-tools';
import { FileDropzone } from './file-dropzone';
import { Button } from './ui/button';

export function useImageDocuments() {
  const { t } = useTranslation();
  const [images, setImages] = useState<ImageSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sources = useRef(images);
  sources.current = images;
  const alive = useRef(true);
  const uploading = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      sources.current.forEach((image) => URL.revokeObjectURL(image.url));
    };
  }, []);
  const add = async (files: File[]) => {
    if (uploading.current || !files.length) return;
    uploading.current = true;
    setLoading(true);
    setError(null);
    const added: ImageSource[] = [];
    try {
      if (
        sources.current.length + files.length > MAX_IMAGES ||
        files.reduce((sum, file) => sum + file.size, 0) > 100 * 1024 * 1024
      )
        throw new Error('imageDocumentCommon.limit');
      let pixels = sources.current.reduce(
        (sum, image) => sum + image.width * image.height,
        0,
      );
      for (const file of files) {
        const image = await importImage(file);
        added.push(image);
        if (!alive.current) return;
        pixels += image.width * image.height;
        if (pixels > 40_000_000)
          throw new Error('imageDocumentCommon.totalPixels');
      }
      const next = [...sources.current, ...added];
      sources.current = next;
      setImages(next);
      added.length = 0;
    } catch (cause) {
      if (alive.current)
        setError(
          t('imageDocumentCommon.importError', {
            msg: t((cause as Error).message, {
              defaultValue: (cause as Error).message,
            }),
          }),
        );
    } finally {
      added.forEach((image) => URL.revokeObjectURL(image.url));
      uploading.current = false;
      if (alive.current) setLoading(false);
    }
  };
  const remove = (id: string) => {
    const source = sources.current.find((image) => image.id === id);
    if (source) URL.revokeObjectURL(source.url);
    setImages((previous) => previous.filter((image) => image.id !== id));
  };
  const move = (from: number, to: number) =>
    setImages((previous) => {
      if (
        from < 0 ||
        to < 0 ||
        from >= previous.length ||
        to >= previous.length
      )
        return previous;
      const next = [...previous];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  return { images, loading, error, add, remove, move };
}

export function DocumentUpload({
  disabled,
  onFiles,
  camera = false,
}: {
  disabled: boolean;
  onFiles: (files: File[]) => void;
  camera?: boolean;
}) {
  const { t } = useTranslation();
  const capture = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <FileDropzone
        accept="image/*"
        multiple
        disabled={disabled}
        onFiles={(files) => {
          if (!disabled) onFiles(files.map(({ file }) => file));
        }}
        className="flex min-h-28 items-center justify-center rounded-xl p-4 text-center"
      >
        <span>{t('imageDocumentCommon.upload')}</span>
      </FileDropzone>
      <p className="text-xs text-muted-foreground">
        {t('imageDocumentCommon.limitHint')}
      </p>
      {camera && (
        <>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => capture.current?.click()}
          >
            {t('documentScanner.camera')}
          </Button>
          <input
            ref={capture}
            type="file"
            accept="image/*"
            capture="environment"
            disabled={disabled}
            className="sr-only"
            aria-label={t('documentScanner.camera')}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFiles([file]);
              event.target.value = '';
            }}
          />
        </>
      )}
    </div>
  );
}

export function DocumentImageList({
  images,
  disabled,
  move,
  remove,
  selected,
  onSelect,
}: {
  images: ImageSource[];
  disabled: boolean;
  move: (from: number, to: number) => void;
  remove: (id: string) => void;
  selected?: string;
  onSelect?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const dragged = useRef<number | null>(null);
  return (
    <ol className="grid gap-3 md:grid-cols-3">
      {images.map((image, index) => (
        <li
          key={image.id}
          draggable={!disabled}
          onDragStart={() => {
            dragged.current = index;
          }}
          onDragEnd={() => {
            dragged.current = null;
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!disabled && dragged.current !== null)
              move(dragged.current, index);
            dragged.current = null;
          }}
          className={`space-y-2 rounded-lg border p-3 ${selected === image.id ? 'border-primary' : ''}`}
        >
          {onSelect ? (
            <Button
              variant="ghost"
              className="h-auto w-full p-0"
              disabled={disabled}
              aria-label={t('documentScanner.editPage', { number: index + 1 })}
              onClick={() => onSelect(image.id)}
            >
              <img
                src={image.url}
                alt={image.name}
                draggable={false}
                className="h-28 w-full object-contain"
              />
            </Button>
          ) : (
            <img
              src={image.url}
              alt={image.name}
              draggable={false}
              className="h-28 w-full object-contain"
            />
          )}
          <p className="truncate text-sm" title={image.name}>
            {index + 1}. {image.name}
          </p>
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="outline"
              disabled={disabled || index === 0}
              aria-label={t('imageDocumentCommon.up')}
              onClick={() => move(index, index - 1)}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              disabled={disabled || index === images.length - 1}
              aria-label={t('imageDocumentCommon.down')}
              onClick={() => move(index, index + 1)}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              disabled={disabled}
              aria-label={t('imageDocumentCommon.remove')}
              onClick={() => remove(image.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}
