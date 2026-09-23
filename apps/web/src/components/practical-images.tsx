import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrayParam,
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { downloadBlob, downloadBytes } from '@/lib/download';
import { makeSprites } from '@/lib/practical-sprites';
import type { VectorTask } from '@/workers/practical-vector.worker';
import { PracticalFrame, ExportText, useLatestJob } from './practical-ui';
import {
  useImageDocuments,
  DocumentUpload,
  DocumentImageList,
} from './image-document-inputs';
import { ChoiceField, NumberField } from './calculator-ui';
import { Button } from './ui/button';
const createVectorWorker = () =>
  new Worker(
    new URL('../workers/practical-vector.worker.ts', import.meta.url),
    { type: 'module' },
  );
export function ImageVectorizer() {
  const { t } = useTranslation();
  const images = useImageDocuments(),
    selected = images.images[0];
  const [query, setQuery] = useQueryParams<{
    mode: string;
    colors: number;
    threshold: number;
    simplify: number;
  }>({
    mode: StringParam,
    colors: NumberParam,
    threshold: NumberParam,
    simplify: NumberParam,
  });
  const worker = useBoundedWorker<VectorTask, string>(
    createVectorWorker,
    30000,
  );
  const prep = useLatestJob<boolean>(JSON.stringify([selected?.id, query]));
  const inputKey = JSON.stringify([selected?.id, query]);
  const latestInput = useRef(inputKey);
  latestInput.current = inputKey;
  useEffect(
    () => () => {
      latestInput.current = '';
    },
    [],
  );
  const [url, setUrl] = useState('');
  useEffect(() => {
    worker.clear();
  }, [
    selected?.id,
    query.mode,
    query.colors,
    query.threshold,
    query.simplify,
    worker.clear,
  ]);
  useEffect(() => {
    if (!worker.result) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(
      new Blob([worker.result], { type: 'image/svg+xml' }),
    );
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [worker.result]);
  return (
    <PracticalFrame
      id="image-vectorizer"
      error={images.error || worker.error || prep.error}
    >
      <DocumentUpload
        multiple={false}
        disabled={images.loading || !!selected}
        onFiles={(files) => void images.add(files.slice(0, 1))}
      />
      <DocumentImageList
        images={images.images}
        disabled={images.loading}
        move={images.move}
        remove={images.remove}
      />
      <p className="text-sm text-muted-foreground">
        {t('studio20.vectorLimit')}
      </p>
      <div className="grid gap-3 md:grid-cols-4">
        <ChoiceField
          label={t('studio20.mode')}
          value={query.mode ?? 'color'}
          options={['color', 'monochrome'].map((value) => ({
            value,
            label: t(`studio20.${value}`),
          }))}
          onChange={(mode) => setQuery({ mode })}
        />
        {(['colors', 'threshold', 'simplify'] as const).map((key) => (
          <NumberField
            key={key}
            label={t(`studio20.${key === 'colors' ? 'colorCount' : key}`)}
            value={
              query[key] ??
              (key === 'colors' ? 8 : key === 'threshold' ? 128 : 1)
            }
            min={key === 'colors' ? 2 : 0}
            max={key === 'colors' ? 32 : key === 'threshold' ? 255 : 20}
            onChange={(value) => setQuery({ [key]: value })}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          disabled={!selected || worker.busy || prep.busy}
          onClick={() =>
            void prep.run(async () => {
              const bitmap = await createImageBitmap(selected.blob);
              try {
                const scale = Math.min(
                    1,
                    1000 / Math.max(bitmap.width, bitmap.height),
                  ),
                  canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(bitmap.width * scale));
                canvas.height = Math.max(1, Math.round(bitmap.height * scale));
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('canvas');
                ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                if (latestInput.current !== inputKey) return false;
                worker.run({
                  image: ctx.getImageData(0, 0, canvas.width, canvas.height),
                  mode: query.mode ?? 'color',
                  colors: query.colors ?? 8,
                  threshold: query.threshold ?? 128,
                  simplify: query.simplify ?? 1,
                });
                return true;
              } finally {
                bitmap.close();
              }
            })
          }
        >
          {t('studio20.run')}
        </Button>
        {worker.busy && (
          <Button variant="outline" onClick={worker.cancel}>
            {t('studio20.cancel')}
          </Button>
        )}
      </div>
      {url && (
        <img
          src={url}
          alt={t('studio20.preview')}
          className="max-h-96 w-full rounded-xl border object-contain"
        />
      )}
      {worker.result && (
        <ExportText
          value={worker.result}
          name="vector.svg"
          type="image/svg+xml"
        />
      )}
    </PracticalFrame>
  );
}
export function SpriteSheet() {
  const { t } = useTranslation(),
    images = useImageDocuments();
  const [query, setQuery] = useQueryParams<{
    mode: string;
    columns: number;
    gap: number;
    width: number;
    height: number;
    fps: number;
  }>({
    mode: StringParam,
    columns: NumberParam,
    gap: NumberParam,
    width: NumberParam,
    height: NumberParam,
    fps: NumberParam,
  });
  const job = useLatestJob<Awaited<ReturnType<typeof makeSprites>>>(
    JSON.stringify([
      images.images.map((i) => i.id),
      query.mode,
      query.columns,
      query.gap,
      query.width,
      query.height,
    ]),
  );
  const [playing, setPlaying] = useState(false),
    [frame, setFrame] = useState(0),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setPlaying(false);
    setFrame(0);
  }, [job.result]);
  useEffect(() => {
    if (!playing || !job.result) return;
    const timer = setInterval(
      () => setFrame((old) => (old + 1) % job.result!.urls.length),
      1000 / Math.min(60, Math.max(1, query.fps ?? 8)),
    );
    return () => clearInterval(timer);
  }, [playing, job.result, query.fps]);
  const zip = async () => {
    try {
      if (!job.result) return;
      const { zipSync, strToU8 } = await import('fflate');
      const files: Record<string, Uint8Array> = {
        'sprites.json': strToU8(JSON.stringify(job.result.metadata, null, 2)),
        'sprites.png': new Uint8Array(
          await (await fetch(job.result.png)).arrayBuffer(),
        ),
      };
      for (const [i, url] of job.result.urls.entries())
        files[`frames/${i + 1}.png`] = new Uint8Array(
          await (await fetch(url)).arrayBuffer(),
        );
      downloadBytes(zipSync(files), 'sprites.zip', 'application/zip');
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  return (
    <PracticalFrame
      id="sprite-sheet"
      error={images.error || job.error || error}
    >
      <DocumentUpload
        disabled={images.loading}
        onFiles={(files) => void images.add(files)}
      />
      <DocumentImageList
        images={images.images}
        disabled={images.loading}
        move={images.move}
        remove={images.remove}
      />
      <p className="text-sm text-muted-foreground">
        {t('studio20.spriteResize')}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <ChoiceField
          label={t('studio20.mode')}
          value={query.mode ?? 'pack'}
          options={['pack', 'slice'].map((value) => ({
            value,
            label: t(`studio20.${value}`),
          }))}
          onChange={(mode) => setQuery({ mode })}
        />
        {(query.mode === 'slice'
          ? ['width', 'height', 'fps']
          : ['columns', 'gap', 'fps']
        ).map((key) => (
          <NumberField
            key={key}
            label={t(
              `studio20.${key === 'width' ? 'frameWidth' : key === 'height' ? 'frameHeight' : key}`,
            )}
            value={
              (query[key as keyof typeof query] as number) ??
              (key === 'fps'
                ? 8
                : key === 'gap'
                  ? 0
                  : key === 'columns'
                    ? 4
                    : 32)
            }
            min={key === 'gap' ? 0 : 1}
            max={
              key === 'fps'
                ? 60
                : key === 'columns'
                  ? 32
                  : key === 'gap'
                    ? 100
                    : 2000
            }
            onChange={(value) => setQuery({ [key]: value })}
          />
        ))}
      </div>
      <Button
        disabled={!images.images.length || job.busy}
        onClick={() =>
          void job.run(() =>
            makeSprites(
              images.images,
              query.mode ?? 'pack',
              query.columns ?? 4,
              query.gap ?? 0,
              query.width ?? 32,
              query.height ?? 32,
            ),
          )
        }
      >
        {t('studio20.run')}
      </Button>
      {job.result && (
        <>
          <img
            src={job.result.png}
            alt={t('studio20.preview')}
            className="max-h-96 w-full border object-contain"
          />
          <div className="flex flex-wrap items-center gap-3">
            <img
              src={job.result.urls[frame] ?? job.result.urls[0]}
              alt={t('studio20.frame')}
              className="h-28 w-28 object-contain"
            />
            <Button onClick={() => setPlaying(!playing)}>
              {t(`studio20.${playing ? 'pause' : 'play'}`)}
            </Button>
            <Button variant="outline" onClick={() => void zip()}>
              {t('studio20.zip')}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  downloadBlob(
                    await (await fetch(job.result!.png)).blob(),
                    'sprites.png',
                  );
                } catch (cause) {
                  setError((cause as Error).message);
                }
              }}
            >
              {t('studio20.png')}
            </Button>
          </div>
          <ExportText
            value={JSON.stringify(job.result.metadata, null, 2)}
            name="sprites.json"
            type="application/json"
          />
        </>
      )}
    </PracticalFrame>
  );
}
export function ClipPathEditor() {
  const { t } = useTranslation();
  const images = useImageDocuments(),
    id = useId().replace(/:/g, '');
  const [query, setQuery] = useQueryParams<{
    mode: string;
    points: string[];
    x: number;
    y: number;
    radius: number;
    rx: number;
    ry: number;
  }>({
    mode: StringParam,
    points: ArrayParam,
    x: NumberParam,
    y: NumberParam,
    radius: NumberParam,
    rx: NumberParam,
    ry: NumberParam,
  });
  const mode = ['circle', 'ellipse'].includes(query.mode ?? '')
    ? query.mode!
    : 'polygon';
  const points = (query.points ?? ['10,10', '90,10', '90,90', '10,90'])
    .slice(0, 30)
    .map((p) => p.split(',').map(Number))
    .filter(
      (p) =>
        p.length === 2 &&
        p.every((n) => Number.isFinite(n) && n >= 0 && n <= 100),
    );
  const [selected, setSelected] = useState(0),
    drag = useRef<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const safe = (n: number | undefined, fallback: number) =>
      Number.isFinite(n) ? Math.max(0, Math.min(100, n!)) : fallback,
    x = safe(query.x, 50),
    y = safe(query.y, 50),
    r = safe(query.radius, 40),
    rx = safe(query.rx, 40),
    ry = safe(query.ry, 30);
  const css =
    mode === 'polygon'
      ? `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(', ')})`
      : mode === 'circle'
        ? `circle(${r}% at ${x}% ${y}%)`
        : `ellipse(${rx}% ${ry}% at ${x}% ${y}%)`;
  const updatePoint = (index: number, nx: number, ny: number) =>
    setQuery({
      points: points.map((point, i) =>
        i === index ? `${nx},${ny}` : point.join(','),
      ),
    });
  return (
    <PracticalFrame id="clip-path-editor">
      <ChoiceField
        label={t('studio20.mode')}
        value={mode}
        options={['polygon', 'circle', 'ellipse'].map((value) => ({
          value,
          label: t(`studio20.${value}`),
        }))}
        onChange={(mode) => setQuery({ mode })}
      />
      <DocumentUpload
        multiple={false}
        disabled={images.loading || !!images.images.length}
        onFiles={(files) => void images.add(files.slice(0, 1))}
      />
      <DocumentImageList
        images={images.images}
        disabled={images.loading}
        move={images.move}
        remove={images.remove}
      />
      <svg
        ref={svg}
        viewBox="0 0 100 100"
        className="mx-auto aspect-square w-full max-w-md touch-none rounded-xl border bg-muted"
        onPointerMove={(event) => {
          if (drag.current === null || !svg.current) return;
          const rect = svg.current.getBoundingClientRect();
          const nx = Math.round(
              Math.min(
                100,
                Math.max(0, ((event.clientX - rect.left) / rect.width) * 100),
              ),
            ),
            ny = Math.round(
              Math.min(
                100,
                Math.max(0, ((event.clientY - rect.top) / rect.height) * 100),
              ),
            );
          if (mode === 'polygon') updatePoint(drag.current, nx, ny);
          else setQuery({ x: nx, y: ny });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <defs>
          <clipPath id={id}>
            {mode === 'polygon' ? (
              <polygon points={points.map((p) => p.join(',')).join(' ')} />
            ) : mode === 'circle' ? (
              <circle cx={x} cy={y} r={r} />
            ) : (
              <ellipse cx={x} cy={y} rx={rx} ry={ry} />
            )}
          </clipPath>
        </defs>
        <g clipPath={`url(#${id})`}>
          <rect width="100" height="100" fill="#6366f1" />
          {images.images[0] && (
            <image
              href={images.images[0].url}
              width="100"
              height="100"
              preserveAspectRatio="xMidYMid slice"
            />
          )}
        </g>
        {(mode === 'polygon' ? points : [[x, y]]).map(([px, py], i) => (
          <circle
            key={i}
            cx={px}
            cy={py}
            r="2"
            fill="#fbbf24"
            stroke="#111827"
            strokeWidth=".5"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = i;
              setSelected(i);
            }}
          />
        ))}
      </svg>
      <div className="grid gap-3 md:grid-cols-3">
        {mode === 'polygon' ? (
          <>
            <ChoiceField
              label={t('studio20.point')}
              value={String(Math.min(selected, points.length - 1))}
              options={points.map((_, i) => ({
                value: String(i),
                label: String(i + 1),
              }))}
              onChange={(value) => setSelected(Number(value))}
            />
            {[0, 1].map((axis) => (
              <NumberField
                key={axis}
                label={axis ? 'Y %' : 'X %'}
                value={points[selected]?.[axis] ?? 0}
                min={0}
                max={100}
                onChange={(value) =>
                  updatePoint(
                    selected,
                    axis ? (points[selected]?.[0] ?? 0) : value,
                    axis ? value : (points[selected]?.[1] ?? 0),
                  )
                }
              />
            ))}
          </>
        ) : (
          ['x', 'y', ...(mode === 'circle' ? ['radius'] : ['rx', 'ry'])].map(
            (key) => (
              <NumberField
                key={key}
                label={t(
                  `studio20.${key === 'rx' ? 'radiusX' : key === 'ry' ? 'radiusY' : key}`,
                )}
                value={
                  key === 'x'
                    ? x
                    : key === 'y'
                      ? y
                      : key === 'radius'
                        ? r
                        : key === 'rx'
                          ? rx
                          : ry
                }
                min={0}
                max={100}
                onChange={(value) => setQuery({ [key]: value })}
              />
            ),
          )
        )}
      </div>
      {mode === 'polygon' && (
        <div className="flex gap-2">
          <Button
            disabled={points.length >= 30}
            onClick={() =>
              setQuery({ points: [...points.map((p) => p.join(',')), '50,50'] })
            }
          >
            {t('studio20.addPoint')}
          </Button>
          <Button
            variant="outline"
            disabled={points.length <= 3}
            onClick={() => {
              setQuery({
                points: points
                  .filter((_, i) => i !== selected)
                  .map((p) => p.join(',')),
              });
              setSelected(0);
            }}
          >
            {t('studio20.deletePoint')}
          </Button>
        </div>
      )}
      <pre className="overflow-auto rounded-lg bg-muted p-3">
        clip-path: {css};
      </pre>
      <ExportText value={`clip-path: ${css};`} name="clip-path.css" />
    </PracticalFrame>
  );
}
