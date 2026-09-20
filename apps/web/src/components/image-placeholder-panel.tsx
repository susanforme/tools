import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { NumberParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import type {
  PlaceholderRequest,
  PlaceholderResult,
} from '@/lib/image-placeholder';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const worker = () =>
  new Worker(
    new URL('../workers/image-placeholder.worker.ts', import.meta.url),
    { type: 'module' },
  );
export default function ImagePlaceholderPanel() {
  const { t } = useTranslation();
  const [components, setComponents] = useQueryParam<number>(
    'components',
    NumberParam,
    4,
  );
  const task = useBoundedWorker<PlaceholderRequest, PlaceholderResult>(
    worker,
    15000,
  );
  const [pixels, setPixels] = useState<Omit<
    PlaceholderRequest,
    'components'
  > | null>(null);
  const [original, setOriginal] = useState('');
  const [blurUrl, setBlurUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  useEffect(() => {
    if (!task.result) {
      setBlurUrl('');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = task.result.width;
    canvas.height = task.result.height;
    const context = canvas.getContext('2d');
    context?.putImageData(
      new ImageData(
        new Uint8ClampedArray(task.result.blurPixels),
        canvas.width,
        canvas.height,
      ),
      0,
      0,
    );
    setBlurUrl(canvas.toDataURL('image/png'));
  }, [task.result]);
  async function load(file: File) {
    const version = ++epoch.current;
    task.clear();
    setError(null);
    setOriginal('');
    setPixels(null);
    let bitmap: ImageBitmap | null = null;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('LIMIT');
      bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 40000000) throw new Error('LIMIT');
      const scale = Math.min(1, 100 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('INVALID');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      if (version !== epoch.current) return;
      setPixels({
        pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
        width: canvas.width,
        height: canvas.height,
      });
      setOriginal(canvas.toDataURL('image/png'));
    } catch (cause) {
      if (version === epoch.current) setError((cause as Error).message);
    } finally {
      bitmap?.close();
    }
  }
  const failure = error ?? task.error;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('communityVisual.placeholder.limit')}
      </p>
      <Label htmlFor="placeholder-file">
        {t('communityVisual.placeholder.drop')}
      </Label>
      <Input
        id="placeholder-file"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void load(file);
          e.target.value = '';
        }}
      />
      <Label htmlFor="placeholder-components">
        {t('communityVisual.placeholder.components')}
      </Label>
      <Input
        id="placeholder-components"
        className="w-24"
        type="number"
        min={2}
        max={6}
        value={components}
        onChange={(e) => {
          task.clear();
          setComponents(e.target.valueAsNumber);
        }}
      />
      <div className="flex gap-2">
        <Button
          disabled={!pixels || task.busy}
          onClick={() => pixels && task.run({ ...pixels, components })}
        >
          {t('communityVisual.run')}
        </Button>
        {task.busy && (
          <Button variant="outline" onClick={task.cancel}>
            {t('communityVisual.cancel')}
          </Button>
        )}
      </div>
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {t('communityVisual.failed', {
            msg: t(`communityVisual.errors.${failure}`, {
              defaultValue: failure,
            }),
          })}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {original && (
          <figure>
            <img
              className="h-40 w-full rounded-md border object-contain"
              src={original}
              alt={t('communityVisual.placeholder.original')}
            />
            <figcaption>{t('communityVisual.placeholder.original')}</figcaption>
          </figure>
        )}
        {task.result &&
          (
            [
              ['ThumbHash', task.result.thumbUrl, task.result.thumbhash],
              ['BlurHash', blurUrl, task.result.blurhash],
            ] as const
          ).map(([name, url, hash]) => (
            <div className="min-w-0 space-y-2" key={name}>
              <img
                src={url || undefined}
                className="h-40 w-full rounded-md border object-contain"
                alt={name}
              />
              <Label>{name}</Label>
              <Textarea
                className="break-all font-mono text-xs"
                readOnly
                value={hash}
                aria-label={name}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!url}
                onClick={() => {
                  void fetch(url)
                    .then((r) => r.blob())
                    .then((blob) => downloadBlob(blob, `${name}.png`))
                    .catch((cause: Error) => setError(cause.message));
                }}
              >
                {t('communityVisual.placeholder.png')}
              </Button>
            </div>
          ))}
      </div>
    </div>
  );
}
