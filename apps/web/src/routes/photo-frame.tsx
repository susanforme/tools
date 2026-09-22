import { Checkbox } from '@/components/ui/checkbox';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberField } from '@/components/calculator-ui';
import {
  CreativePage,
  CreativeProjectActions,
  CreativeTextField,
} from '@/components/creative-tool-controls';
import { FileDropzone } from '@/components/file-dropzone';
import { Button } from '@/components/ui/button';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  canvasPng,
  decodeCreativeImage,
  isHex,
  readCreativeImage,
} from '@/lib/creative-tools';
import { downloadBlob, downloadBytes } from '@/lib/download';
import { boundedNumber } from '@/lib/focus-tools';
import {
  drawPhotoFrame,
  formatPhotoExif,
  validatePhotoFrameProject,
  type FrameSettings,
  type FramedPhoto,
} from '@/lib/photo-frame';

export const Route = createFileRoute('/photo-frame')({
  component: PhotoFramePage,
});
function PhotoFramePage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    margin: number;
    background: string;
    foreground: string;
    camera: string;
    parameters: string;
    date: string;
  }>({
    margin: NumberParam,
    background: StringParam,
    foreground: StringParam,
    camera: StringParam,
    parameters: StringParam,
    date: StringParam,
  });
  const [photos, setPhotos] = useState<FramedPhoto[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [author, setAuthor] = useState('');
  const [busy, setBusy] = useState(false),
    [rendering, setRendering] = useState(false),
    [error, setError] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    alive = useRef(true),
    job = useRef(0),
    working = useRef(false);
  const settings: FrameSettings = {
    margin: boundedNumber(query.margin, 5, 1, 20),
    background: isHex(query.background) ? query.background : '#ffffff',
    foreground: isHex(query.foreground) ? query.foreground : '#202020',
    author,
    camera: query.camera !== 'off',
    parameters: query.parameters !== 'off',
    date: query.date !== 'off',
  };
  const photo =
    photos.find((item) => item.id === selected) ?? photos[0] ?? null;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      job.current++;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (!photo) return;
    setRendering(true);
    void decodeCreativeImage(photo.image)
      .then((image) => {
        if (!cancelled && canvas.current)
          drawPhotoFrame(canvas.current, image, photo, settingsRef.current);
      })
      .catch((cause: Error) => {
        if (!cancelled)
          setError(
            t(cause.message, { defaultValue: t('creativeCommon.imageError') }),
          );
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    photo,
    settings.margin,
    settings.background,
    settings.foreground,
    author,
    settings.camera,
    settings.parameters,
    settings.date,
    t,
  ]);
  const add = async (files: File[]) => {
    if (working.current || !files.length) return;
    working.current = true;
    setBusy(true);
    setError(null);
    const ticket = ++job.current;
    try {
      if (
        photos.length + files.length > 10 ||
        files.reduce((sum, file) => sum + file.size, 0) > 100_000_000
      )
        throw new Error('photoFrame.limit');
      const { parse } = await import('exifr');
      const added: FramedPhoto[] = [];
      let pixels = photos.reduce(
        (sum, item) => sum + item.image.width * item.image.height,
        0,
      );
      for (const file of files) {
        const image = await readCreativeImage(file);
        if (!alive.current || ticket !== job.current) return;
        pixels += image.width * image.height;
        if (pixels > 20_000_000) throw new Error('photoFrame.limit');
        let metadata: unknown = null;
        try {
          metadata = await parse(file, [
            'Make',
            'Model',
            'LensModel',
            'FNumber',
            'ExposureTime',
            'ISO',
            'FocalLength',
            'DateTimeOriginal',
          ]);
        } catch {
          /* 无 EXIF 的照片仍可手动填写参数。 */
        }
        added.push({
          id: crypto.randomUUID(),
          image,
          ...formatPhotoExif(metadata),
          caption: '',
        });
      }
      if (alive.current && ticket === job.current)
        setPhotos((previous) => [...previous, ...added]);
    } catch (cause) {
      if (alive.current && ticket === job.current)
        setError(
          t((cause as Error).message, {
            defaultValue: t('creativeCommon.imageError'),
          }),
        );
    } finally {
      working.current = false;
      if (alive.current && ticket === job.current) setBusy(false);
    }
  };
  const exportAll = async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    const ticket = ++job.current;
    try {
      const entries: Record<string, Uint8Array> = {};
      for (const [index, entry] of photos.entries()) {
        const image = await decodeCreativeImage(entry.image);
        if (!alive.current || ticket !== job.current) return;
        const output = document.createElement('canvas');
        drawPhotoFrame(output, image, entry, settings);
        entries[`${String(index + 1).padStart(2, '0')}-framed.png`] =
          new Uint8Array(await (await canvasPng(output)).arrayBuffer());
        output.width = output.height = 0;
      }
      const { zipSync } = await import('fflate');
      if (alive.current && ticket === job.current)
        downloadBytes(
          zipSync(entries, { level: 0 }),
          'framed-photos.zip',
          'application/zip',
        );
    } catch (cause) {
      if (alive.current && ticket === job.current)
        setError(
          t((cause as Error).message, {
            defaultValue: t('creativeCommon.saveError'),
          }),
        );
    } finally {
      working.current = false;
      if (alive.current && ticket === job.current) setBusy(false);
    }
  };
  return (
    <CreativePage title={t('photoFrame.title')}>
      <FileDropzone
        accept="image/*"
        multiple
        disabled={busy}
        onFiles={(files) => void add(files.map(({ file }) => file))}
        className="flex min-h-24 items-center justify-center rounded-xl p-4"
      >
        {t('photoFrame.upload')}
      </FileDropzone>
      <p className="text-xs text-muted-foreground">
        {t('photoFrame.limit')} · {t('creativeCommon.imageLimit')}
      </p>
      <fieldset disabled={busy} className="grid gap-3 md:grid-cols-3">
        <NumberField
          label={t('photoFrame.margin')}
          value={settings.margin}
          min={1}
          onChange={(value) =>
            setQuery({ margin: boundedNumber(value, 5, 1, 20) })
          }
        />
        <CreativeTextField
          label={t('creativeCommon.background')}
          value={settings.background}
          type="color"
          onChange={(value) => setQuery({ background: value })}
        />
        <CreativeTextField
          label={t('photoFrame.foreground')}
          value={settings.foreground}
          type="color"
          onChange={(value) => setQuery({ foreground: value })}
        />
        <CreativeTextField
          label={t('photoFrame.author')}
          value={author}
          maxLength={120}
          onChange={setAuthor}
        />
        {(['camera', 'parameters', 'date'] as const).map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={settings[key]}
              onCheckedChange={(checked) =>
                setQuery({ [key]: checked === true ? 'on' : 'off' })
              }
            />
            {t(`photoFrame.${key}`)}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        {photos.map((entry, index) => (
          <Button
            key={entry.id}
            variant={entry.id === photo?.id ? 'default' : 'outline'}
            disabled={busy}
            onClick={() => setSelected(entry.id)}
          >
            {index + 1}. {entry.image.name.slice(0, 30)}
          </Button>
        ))}
      </div>
      {photo && (
        <div className="grid gap-4 md:grid-cols-2">
          <canvas
            ref={canvas}
            aria-label={t('photoFrame.preview')}
            className="max-h-[65vh] max-w-full rounded border object-contain"
          />
          <fieldset disabled={busy} className="space-y-3">
            {(['caption', 'camera', 'lens', 'parameters', 'date'] as const).map(
              (key) => (
                <CreativeTextField
                  key={key}
                  label={t(`photoFrame.${key}`)}
                  value={photo[key]}
                  onChange={(value) =>
                    setPhotos((previous) =>
                      previous.map((entry) =>
                        entry.id === photo.id
                          ? { ...entry, [key]: value }
                          : entry,
                      ),
                    )
                  }
                />
              ),
            )}
            <Button
              variant="outline"
              onClick={() =>
                setPhotos((previous) =>
                  previous.filter((entry) => entry.id !== photo.id),
                )
              }
            >
              {t('creativeCommon.remove')}
            </Button>
          </fieldset>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!photo || busy || rendering}
          onClick={async () => {
            try {
              if (canvas.current) {
                const blob = await canvasPng(canvas.current);
                if (alive.current) downloadBlob(blob, 'framed-photo.png');
              }
            } catch {
              if (alive.current) setError(t('creativeCommon.saveError'));
            }
          }}
        >
          {t('creativeCommon.png')}
        </Button>
        <Button
          disabled={!photos.length || busy || rendering}
          onClick={() => void exportAll()}
        >
          {t(busy ? 'creativeCommon.processing' : 'photoFrame.zip')}
        </Button>
      </div>
      <CreativeProjectActions
        name="photo-frame-project"
        value={{ version: 1, photos, settings }}
        disabled={busy}
        onImport={async (value) => {
          if (!validatePhotoFrameProject(value))
            throw new Error('creativeCommon.invalidProject');
          const ticket = ++job.current;
          for (const entry of value.photos)
            await decodeCreativeImage(entry.image);
          if (!alive.current || ticket !== job.current) return;
          setPhotos(value.photos);
          setSelected(null);
          setAuthor(value.settings.author);
          setQuery({
            margin: value.settings.margin,
            background: value.settings.background,
            foreground: value.settings.foreground,
            camera: value.settings.camera ? 'on' : 'off',
            parameters: value.settings.parameters ? 'on' : 'off',
            date: value.settings.date ? 'on' : 'off',
          });
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </CreativePage>
  );
}
