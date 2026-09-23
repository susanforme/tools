import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import {
  exportTracks,
  readTracks,
  trackCollection,
  trackDistances,
  type Track,
} from '@/lib/media-tracks';
import { downloadBlob } from '@/lib/download';
import { FileDropzone } from './file-dropzone';
import { ChoiceField, NumberField } from './calculator-ui';
import { Button } from './ui/button';
const Map = lazy(() => import('./geojson-map'));
export function MediaTracks() {
  const { t } = useTranslation();
  const [tracks, setTracks] = useState<Track[]>([]),
    [selected, setSelected] = useState(0),
    [start, setStart] = useState(1),
    [end, setEnd] = useState(2),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const [query, setQuery] = useQueryParams<{ format: string }>({
    format: StringParam,
  });
  const format = ['geojson', 'gpx', 'kml'].includes(query.format ?? '')
    ? query.format!
    : 'geojson';
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current++;
    },
    [],
  );
  const track = tracks[selected],
    distances = track ? trackDistances(track.points) : [],
    altitude =
      track?.points.filter((p) => p[2] !== undefined).map((p) => p[2]!) ?? [];
  const low = Math.min(...altitude),
    high = Math.max(...altitude),
    total = distances.at(-1) ?? 0;
  const resetSelection = (next: Track[], index = 0) => {
    setTracks(next);
    setSelected(index);
    setStart(1);
    setEnd(next[index]?.points.length ?? 2);
  };
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('mediaWorkflow.trackLimit')}
      </p>
      <FileDropzone
        accept=".gpx,.kml,.geojson,.json"
        multiple
        onFiles={async (files) => {
          const ticket = ++revision.current;
          setBusy(true);
          setError(null);
          try {
            if (
              files.length > 20 ||
              files.reduce((n, f) => n + f.file.size, 0) > 5 * 1024 * 1024
            )
              throw new Error('limit');
            const next: Track[] = [];
            for (const f of files)
              next.push(
                ...(await readTracks(await f.file.text(), f.file.name)),
              );
            if (next.reduce((n, t) => n + t.points.length, 0) > 50000)
              throw new Error('limit');
            if (ticket === revision.current) resetSelection(next);
          } catch (cause) {
            if (ticket === revision.current) setError((cause as Error).message);
          } finally {
            if (ticket === revision.current) setBusy(false);
          }
        }}
      >
        {t('mediaWorkflow.trackUpload')}
      </FileDropzone>
      {busy && (
        <Button
          variant="outline"
          onClick={() => {
            revision.current++;
            setBusy(false);
          }}
        >
          {t('studio20.cancel')}
        </Button>
      )}
      {track && (
        <>
          <ChoiceField
            label={t('mediaWorkflow.track')}
            value={String(selected)}
            options={tracks.map((item, i) => ({
              value: String(i),
              label: `${i + 1}. ${item.name}`,
            }))}
            onChange={(value) => resetSelection(tracks, Number(value))}
          />
          <div className="grid gap-3 md:grid-cols-3">
            <NumberField
              label={t('mediaWorkflow.firstPoint')}
              value={start}
              min={1}
              max={track.points.length}
              step={1}
              onChange={setStart}
            />
            <NumberField
              label={t('mediaWorkflow.lastPoint')}
              value={end}
              min={2}
              max={track.points.length}
              step={1}
              onChange={setEnd}
            />
            <ChoiceField
              label={t('mediaWorkflow.format')}
              value={format}
              options={['geojson', 'gpx', 'kml'].map((value) => ({
                value,
                label: value.toUpperCase(),
              }))}
              onChange={(format) => setQuery({ format })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                !Number.isInteger(start) ||
                !Number.isInteger(end) ||
                start < 1 ||
                end > track.points.length ||
                end <= start
              }
              onClick={() =>
                resetSelection(
                  tracks.map((item, i) =>
                    i === selected
                      ? { ...item, points: item.points.slice(start - 1, end) }
                      : item,
                  ),
                  selected,
                )
              }
            >
              {t('mediaWorkflow.crop')}
            </Button>
            <Button
              variant="outline"
              disabled={tracks.length < 2}
              onClick={() =>
                resetSelection([
                  {
                    name: tracks.map((t) => t.name).join(' + '),
                    points: tracks.flatMap((t) => t.points),
                  },
                ])
              }
            >
              {t('mediaWorkflow.joinTracks')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadBlob(
                  new Blob([exportTracks(tracks, format)], {
                    type:
                      format === 'geojson'
                        ? 'application/geo+json'
                        : 'application/xml',
                  }),
                  `tracks.${format}`,
                )
              }
            >
              {t('studio20.download')}
            </Button>
          </div>
          <p>
            {t('mediaWorkflow.distance')}: {total.toFixed(3)} km ·{' '}
            {track.points.length} {t('mediaWorkflow.points')}
          </p>
          <Suspense fallback={<p>{t('studio20.busy')}</p>}>
            <Map collection={trackCollection([track])} />
          </Suspense>
          {altitude.length ? (
            <figure>
              <figcaption>
                {t('mediaWorkflow.elevation')} ({low.toFixed(1)}–{high.toFixed(1)}{' '}
                m)
              </figcaption>
              <svg
                viewBox="0 0 800 180"
                role="img"
                aria-label={t('mediaWorkflow.elevation')}
                className="h-44 w-full rounded border text-emerald-500"
              >
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  points={track.points
                    .flatMap((p, i) =>
                      p[2] === undefined
                        ? []
                        : [
                            `${10 + 780 * (distances[i] / (total || 1))},${170 - (160 * (p[2] - low)) / (high - low || 1)}`,
                          ],
                    )
                    .join(' ')}
                />
              </svg>
              <p className="text-xs text-muted-foreground">
                0 — {total.toFixed(3)} km
              </p>
            </figure>
          ) : (
            <p>{t('mediaWorkflow.noElevation')}</p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {t('mediaWorkflow.failed', {
            message: t(`mediaWorkflow.${error}`, { defaultValue: error }),
          })}
        </p>
      )}
    </section>
  );
}
