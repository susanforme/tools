import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { downloadBytes } from '@/lib/download';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceField, NumberField } from './calculator-ui';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
type Photo = {
  id: string;
  file: File;
  bitmap: ImageBitmap;
  rating: number;
  status: string;
};
function Preview({
  photo,
  zoom,
  x,
  y,
}: {
  photo: Photo;
  zoom: number;
  x: number;
  y: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = 800;
    c.height = 600;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const image = photo.bitmap,
      scale = Math.min(800 / image.width, 600 / image.height) * zoom;
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 800, 600);
    ctx.drawImage(
      image,
      400 - image.width * scale * (x / 100),
      300 - image.height * scale * (y / 100),
      image.width * scale,
      image.height * scale,
    );
  }, [photo, zoom, x, y]);
  return (
    <canvas
      ref={ref}
      className="w-full rounded border"
      aria-label={photo.file.name}
    />
  );
}
export default function PhotoWorkbench() {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<Photo[]>([]),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const live = useRef<Photo[]>([]),
    ticket = useRef(0);
  const zipCancel = useRef<(() => void) | null>(null);
  const [q, setQ] = useQueryParams<{
    zoom: number;
    x: number;
    y: number;
    filter: string;
    stars: number;
  }>({
    zoom: NumberParam,
    x: NumberParam,
    y: NumberParam,
    filter: StringParam,
    stars: NumberParam,
  });
  useEffect(
    () => () => {
      ticket.current++;
      zipCancel.current?.();
      live.current.forEach((p) => p.bitmap.close());
    },
    [],
  );
  function update(next: Photo[]) {
    live.current = next;
    setPhotos(next);
  }
  async function load(files: File[]) {
    if (!files.length) return;
    const id = ++ticket.current;
    setError(null);
    setBusy(true);
    const added: Photo[] = [];
    try {
      if (
        files.length + photos.length > 40 ||
        [...files, ...photos.map((p) => p.file)].reduce(
          (s, f) => s + f.size,
          0,
        ) > 200_000_000
      )
        throw new Error('limit');
      let pixels = photos.reduce(
        (s, p) => s + p.bitmap.width * p.bitmap.height,
        0,
      );
      for (const file of files) {
        const bitmap = await createImageBitmap(file);
        if (id !== ticket.current) {
          bitmap.close();
          throw new Error('cancelled');
        }
        pixels += bitmap.width * bitmap.height;
        if (pixels > 120_000_000) {
          bitmap.close();
          throw new Error('limit');
        }
        added.push({
          id: crypto.randomUUID(),
          file,
          bitmap,
          rating: 0,
          status: 'unrated',
        });
      }
      if (id !== ticket.current) {
        added.forEach((p) => p.bitmap.close());
        return;
      }
      update([...live.current, ...added]);
    } catch (e) {
      added.forEach((p) => p.bitmap.close());
      if (id === ticket.current) setError((e as Error).message);
    } finally {
      if (id === ticket.current) setBusy(false);
    }
  }
  async function pack() {
    setBusy(true);
    setError(null);
    const id = ++ticket.current;
    try {
      const selected = photos.filter((p) => p.status === 'keep');
      if (!selected.length) throw new Error('selection');
      const { zip } = await import('fflate');
      const entries: Record<string, Uint8Array> = {};
      for (const [i, p] of selected.entries())
        entries[
          `${String(i + 1).padStart(3, '0')}-${p.file.name.replace(/[\\/]/g, '_')}`
        ] = new Uint8Array(await p.file.arrayBuffer());
      if (id !== ticket.current) return;
      const output = await new Promise<Uint8Array>((resolve, reject) => {
        zipCancel.current = zip(entries, { level: 0 }, (e, data) => {
          zipCancel.current = null;
          e ? reject(e) : resolve(data);
        });
      });
      if (id === ticket.current)
        downloadBytes(output, 'selected-photos.zip', 'application/zip');
    } catch (e) {
      if (id === ticket.current) setError((e as Error).message);
    } finally {
      if (id === ticket.current) setBusy(false);
    }
  }
  const shown = photos.filter(
    (p) =>
      (!q.filter || q.filter === 'all' || p.status === q.filter) &&
      p.rating >= (q.stars ?? 0),
  );
  const clamp = (
    n: number | undefined,
    min: number,
    max: number,
    fallback: number,
  ) => (Number.isFinite(n) ? Math.max(min, Math.min(max, n!)) : fallback);
  return (
    <div className="space-y-4">
      <Label htmlFor="photo-files">{t('batch4Media.photoFiles')}</Label>
      <Input
        id="photo-files"
        type="file"
        multiple
        accept="image/*"
        disabled={busy}
        onChange={(e) => {
          void load(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <p className="text-sm text-muted-foreground">
        {t('batch4Media.photoLimit')}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <NumberField
          label={t('batch4Media.zoom')}
          value={q.zoom ?? 1}
          min={0.1}
          max={10}
          step={0.1}
          onChange={(zoom) => setQ({ zoom })}
        />
        <NumberField
          label={t('batch4Media.panX')}
          value={q.x ?? 50}
          min={0}
          max={100}
          onChange={(x) => setQ({ x })}
        />
        <NumberField
          label={t('batch4Media.panY')}
          value={q.y ?? 50}
          min={0}
          max={100}
          onChange={(y) => setQ({ y })}
        />
        <ChoiceField
          label={t('batch4Media.filter')}
          value={q.filter ?? 'all'}
          options={['all', 'keep', 'reject', 'unrated'].map((value) => ({
            value,
            label: t(`batch4Media.${value}`),
          }))}
          onChange={(filter) => setQ({ filter })}
        />
        <NumberField
          label={t('batch4Media.minStars')}
          value={q.stars ?? 0}
          min={0}
          max={5}
          step={1}
          onChange={(stars) => setQ({ stars })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !photos.some((p) => p.status === 'keep')}
          onClick={() => void pack()}
        >
          {t('batch4Media.zipSelected')} (
          {photos.filter((p) => p.status === 'keep').length})
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            photos.forEach((p) => p.bitmap.close());
            update([]);
          }}
        >
          {t('batch4Media.clear')}
        </Button>
      </div>
      {busy && <p role="status">{t('batch4Media.loading')}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {t('batch4Media.failed', {
            msg: t(`batch4Media.errors.${error}`, { defaultValue: error }),
          })}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((p) => (
          <div key={p.id} className="min-w-0 space-y-2 rounded-lg border p-3">
            <Preview
              photo={p}
              zoom={clamp(q.zoom, 0.1, 10, 1)}
              x={clamp(q.x, 0, 100, 50)}
              y={clamp(q.y, 0, 100, 50)}
            />
            <p className="break-all text-sm">{p.file.name}</p>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 6 }, (_, rating) => (
                <Button
                  key={rating}
                  variant={p.rating === rating ? 'default' : 'outline'}
                  size="sm"
                  aria-label={t('batch4Media.rating', { rating })}
                  onClick={() =>
                    update(
                      live.current.map((photo) =>
                        photo.id === p.id ? { ...photo, rating } : photo,
                      ),
                    )
                  }
                >
                  {rating === 0 ? '0' : `${rating} ★`}
                </Button>
              ))}
            </div>
            <ChoiceField
              label={t('batch4Media.decision')}
              value={p.status}
              options={['unrated', 'keep', 'reject'].map((value) => ({
                value,
                label: t(`batch4Media.${value}`),
              }))}
              onChange={(status) =>
                update(
                  live.current.map((photo) =>
                    photo.id === p.id ? { ...photo, status } : photo,
                  ),
                )
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
