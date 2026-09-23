import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import {
  pixelFrame,
  pixelLine,
  validPixelProject,
  type PixelProject,
} from '@/lib/media-pixels';
import { downloadBlob, downloadBytes } from '@/lib/download';
import { NumberField, ChoiceField } from './calculator-ui';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { FileDropzone } from './file-dropzone';
const createWorker = () =>
  new Worker(new URL('../workers/media-pixels.worker.ts', import.meta.url), {
    type: 'module',
  });
const blank = (width: number, height: number) =>
  Array<string>(width * height).fill('');
const initial: PixelProject = {
  width: 32,
  height: 32,
  layers: [{ name: '1', visible: true }],
  frames: [[blank(32, 32)]],
};
const PALETTE = [
  '#000000',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#78716c',
  '#64748b',
];
export function MediaPixels() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    brush: string;
    onion: string;
    fps: number;
    width: number;
    height: number;
  }>({
    brush: StringParam,
    onion: StringParam,
    fps: NumberParam,
    width: NumberParam,
    height: NumberParam,
  });
  const [project, setProject] = useState(initial),
    [frame, setFrame] = useState(0),
    [layer, setLayer] = useState(0),
    [color, setColor] = useState('#3b82f6'),
    [palette, setPalette] = useState(PALETTE),
    [playing, setPlaying] = useState(false),
    [error, setError] = useState<string | null>(null),
    [history, setHistory] = useState<PixelProject[]>([]),
    [future, setFuture] = useState<PixelProject[]>([]),
    [cursor, setCursor] = useState<[number, number]>([0, 0]);
  const canvas = useRef<HTMLCanvasElement>(null),
    preview = useRef<HTMLCanvasElement>(null),
    painting = useRef<[number, number] | null>(null),
    revision = useRef(0);
  const task = useBoundedWorker<
    { project: PixelProject; fps: number },
    Uint8Array
  >(createWorker, 60000);
  useEffect(() => {
    task.clear();
  }, [project, query.fps, task.clear]);
  useEffect(
    () => () => {
      revision.current++;
    },
    [],
  );
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setFrame((f) => (f + 1) % project.frames.length),
      1000 / Math.min(50, Math.max(1, query.fps ?? 8)),
    );
    return () => clearInterval(timer);
  }, [playing, project.frames.length, query.fps]);
  const actualFrame = Math.min(frame, project.frames.length - 1),
    actualLayer = Math.min(layer, project.layers.length - 1);
  useEffect(() => {
    const target = canvas.current,
      thumbnail = preview.current;
    if (!target || !thumbnail) return;
    target.width = thumbnail.width = project.width;
    target.height = thumbnail.height = project.height;
    const ctx = target.getContext('2d')!,
      thumb = thumbnail.getContext('2d')!,
      temp = document.createElement('canvas');
    temp.width = project.width;
    temp.height = project.height;
    const tc = temp.getContext('2d')!;
    const render = (i: number, alpha: number) => {
      tc.putImageData(
        new ImageData(
          new Uint8ClampedArray(pixelFrame(project, i)),
          project.width,
          project.height,
        ),
        0,
        0,
      );
      ctx.globalAlpha = alpha;
      ctx.drawImage(temp, 0, 0);
    };
    if (query.onion !== 'false' && !playing) {
      if (actualFrame > 0) render(actualFrame - 1, 0.2);
      if (actualFrame + 1 < project.frames.length)
        render(actualFrame + 1, 0.15);
    }
    render(actualFrame, 1);
    thumb.putImageData(
      new ImageData(
        new Uint8ClampedArray(pixelFrame(project, actualFrame)),
        project.width,
        project.height,
      ),
      0,
      0,
    );
    temp.width = temp.height = 0;
  }, [project, actualFrame, query.onion, playing]);
  const checkpoint = () => {
    setHistory((h) => [...h.slice(-29), project]);
    setFuture([]);
  };
  const change = (next: PixelProject) => {
    if (!validPixelProject(next)) {
      setError('pixelLimit');
      return;
    }
    revision.current++;
    checkpoint();
    setProject(next);
    setError(null);
    setPlaying(false);
  };
  const draw = (point: [number, number]) => {
    revision.current++;
    const from = painting.current ?? point;
    painting.current = point;
    setCursor(point);
    setProject((old) => {
      const pixels = [...old.frames[actualFrame][actualLayer]];
      for (const [x, y] of pixelLine(from, point))
        if (x >= 0 && y >= 0 && x < old.width && y < old.height)
          pixels[y * old.width + x] = query.brush === 'erase' ? '' : color;
      return {
        ...old,
        frames: old.frames.map((f, i) =>
          i === actualFrame
            ? f.map((l, j) => (j === actualLayer ? pixels : l))
            : f,
        ),
      };
    });
  };
  const point = (event: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.max(
        0,
        Math.min(
          project.width - 1,
          Math.floor(
            ((event.clientX - rect.left) / rect.width) * project.width,
          ),
        ),
      ),
      Math.max(
        0,
        Math.min(
          project.height - 1,
          Math.floor(
            ((event.clientY - rect.top) / rect.height) * project.height,
          ),
        ),
      ),
    ];
  };
  const moveFrame = (direction: number) => {
    const to = actualFrame + direction;
    if (to < 0 || to >= project.frames.length) return;
    const frames = [...project.frames];
    [frames[actualFrame], frames[to]] = [frames[to], frames[actualFrame]];
    change({ ...project, frames });
    setFrame(to);
  };
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{t('batch3Media.pixels')}</h2>
      <p className="text-sm text-muted-foreground">
        {t('batch3Media.pixelLimit')}
      </p>
      <div className="grid gap-3 md:grid-cols-4">
        <NumberField
          label={t('studio20.width')}
          value={query.width ?? 32}
          min={1}
          max={64}
          step={1}
          onChange={(width) => setQuery({ width })}
        />
        <NumberField
          label={t('studio20.height')}
          value={query.height ?? 32}
          min={1}
          max={64}
          step={1}
          onChange={(height) => setQuery({ height })}
        />
        <NumberField
          label={t('studio20.fps')}
          value={query.fps ?? 8}
          min={1}
          max={50}
          step={1}
          onChange={(fps) => setQuery({ fps })}
        />
        <Button
          variant="outline"
          onClick={() => {
            const width = query.width ?? 32,
              height = query.height ?? 32;
            if (
              !Number.isInteger(width) ||
              !Number.isInteger(height) ||
              width < 1 ||
              height < 1 ||
              width > 64 ||
              height > 64
            ) {
              setError('invalid');
              return;
            }
            change({
              width,
              height,
              layers: project.layers,
              frames: project.frames.map((f) =>
                f.map((pixels) =>
                  Array.from({ length: width * height }, (_, i) => {
                    const x = i % width,
                      y = Math.floor(i / width);
                    return x < project.width && y < project.height
                      ? pixels[y * project.width + x]
                      : '';
                  }),
                ),
              ),
            });
          }}
        >
          {t('batch3Media.resizeCanvas')}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={!history.length}
          onClick={() => {
            revision.current++;
            setFuture((f) => [project, ...f]);
            setProject(history.at(-1)!);
            setHistory((h) => h.slice(0, -1));
            setPlaying(false);
          }}
        >
          {t('studio20.undo')}
        </Button>
        <Button
          variant="outline"
          disabled={!future.length}
          onClick={() => {
            revision.current++;
            setHistory((h) => [...h, project]);
            setProject(future[0]);
            setFuture((f) => f.slice(1));
          }}
        >
          {t('studio20.redo')}
        </Button>
        <Button variant="outline" onClick={() => setPlaying((p) => !p)}>
          {t(playing ? 'studio20.pause' : 'studio20.play')}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            change({
              ...project,
              frames: project.frames.map((f, i) =>
                i === actualFrame
                  ? f.map((p, j) =>
                      j === actualLayer
                        ? blank(project.width, project.height)
                        : p,
                    )
                  : f,
              ),
            })
          }
        >
          {t('batch3Media.clearLayer')}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-2">
          <canvas
            ref={canvas}
            tabIndex={0}
            aria-label={t('batch3Media.drawHint')}
            className="aspect-square w-full max-w-lg touch-none border bg-muted/30 outline-offset-2 [image-rendering:pixelated]"
            onPointerDown={(event) => {
              if (playing) return;
              revision.current++;
              checkpoint();
              event.currentTarget.setPointerCapture(event.pointerId);
              painting.current = null;
              draw(point(event));
            }}
            onPointerMove={(event) => {
              if (painting.current) draw(point(event));
            }}
            onPointerUp={() => {
              painting.current = null;
            }}
            onPointerCancel={() => {
              painting.current = null;
            }}
            onKeyDown={(event) => {
              if (playing) return;
              const delta: Record<string, [number, number]> = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
              };
              if (delta[event.key]) {
                event.preventDefault();
                setCursor(([x, y]) => [
                  Math.max(
                    0,
                    Math.min(project.width - 1, x + delta[event.key][0]),
                  ),
                  Math.max(
                    0,
                    Math.min(project.height - 1, y + delta[event.key][1]),
                  ),
                ]);
              } else if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                checkpoint();
                painting.current = null;
                draw(cursor);
                painting.current = null;
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            {t('batch3Media.drawHint')} ({cursor[0] + 1}, {cursor[1] + 1})
          </p>
        </div>
        <div className="space-y-3">
          <canvas
            ref={preview}
            aria-label={t('studio20.preview')}
            className="h-32 w-32 border [image-rendering:pixelated]"
          />
          <ChoiceField
            label={t('batch3Media.brush')}
            value={query.brush ?? 'paint'}
            options={['paint', 'erase'].map((value) => ({
              value,
              label: t(`batch3Media.${value}`),
            }))}
            onChange={(brush) => setQuery({ brush })}
          />
          <ChoiceField
            label={t('batch3Media.onion')}
            value={query.onion ?? 'true'}
            options={['true', 'false'].map((value) => ({
              value,
              label: t(value === 'true' ? 'studio20.yes' : 'studio20.no'),
            }))}
            onChange={(onion) => setQuery({ onion })}
          />
          <Label htmlFor="pixel-color">{t('studio20.color')}</Label>
          <Input
            id="pixel-color"
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            {palette.map((value) => (
              <Button
                key={value}
                size="icon"
                variant={value === color ? 'secondary' : 'outline'}
                aria-label={value}
                onClick={() => setColor(value)}
              >
                <svg width="20" height="20">
                  <rect width="20" height="20" fill={value} />
                </svg>
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            disabled={palette.length >= 32 || palette.includes(color)}
            onClick={() => setPalette((p) => [...p, color])}
          >
            {t('batch3Media.addColor')}
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h3>{t('batch3Media.frames')}</h3>
          <div className="flex flex-wrap gap-1">
            {project.frames.map((_, i) => (
              <Button
                key={i}
                variant={i === actualFrame ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => {
                  setFrame(i);
                  setPlaying(false);
                }}
              >
                {i + 1}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                change({
                  ...project,
                  frames: [
                    ...project.frames,
                    project.layers.map(() =>
                      blank(project.width, project.height),
                    ),
                  ],
                });
                setFrame(project.frames.length);
              }}
            >
              {t('studio20.add')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                change({
                  ...project,
                  frames: [
                    ...project.frames,
                    project.frames[actualFrame].map((p) => [...p]),
                  ],
                });
                setFrame(project.frames.length);
              }}
            >
              {t('batch3Media.duplicateFrame')}
            </Button>
            <Button
              variant="outline"
              disabled={project.frames.length === 1}
              onClick={() =>
                change({
                  ...project,
                  frames: project.frames.filter((_, i) => i !== actualFrame),
                })
              }
            >
              {t('studio20.remove')}
            </Button>
            <Button
              variant="outline"
              disabled={actualFrame === 0}
              onClick={() => moveFrame(-1)}
            >
              ←
            </Button>
            <Button
              variant="outline"
              disabled={actualFrame === project.frames.length - 1}
              onClick={() => moveFrame(1)}
            >
              →
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <h3>{t('batch3Media.layers')}</h3>
          <ChoiceField
            label={t('batch3Media.layer')}
            value={String(actualLayer)}
            options={project.layers.map((l, i) => ({
              value: String(i),
              label: `${i + 1}. ${l.name}`,
            }))}
            onChange={(value) => setLayer(Number(value))}
          />
          <Label htmlFor="pixel-layer-name">{t('studio20.name')}</Label>
          <Input
            id="pixel-layer-name"
            value={project.layers[actualLayer].name}
            maxLength={80}
            onChange={(e) =>
              change({
                ...project,
                layers: project.layers.map((l, i) =>
                  i === actualLayer ? { ...l, name: e.target.value } : l,
                ),
              })
            }
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                change({
                  ...project,
                  layers: [
                    ...project.layers,
                    { name: String(project.layers.length + 1), visible: true },
                  ],
                  frames: project.frames.map((f) => [
                    ...f,
                    blank(project.width, project.height),
                  ]),
                });
                setLayer(project.layers.length);
              }}
            >
              {t('studio20.add')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                change({
                  ...project,
                  layers: project.layers.map((l, i) =>
                    i === actualLayer ? { ...l, visible: !l.visible } : l,
                  ),
                })
              }
            >
              {t(
                project.layers[actualLayer].visible
                  ? 'batch3Media.hide'
                  : 'batch3Media.show',
              )}
            </Button>
            <Button
              variant="outline"
              disabled={project.layers.length === 1}
              onClick={() =>
                change({
                  ...project,
                  layers: project.layers.filter((_, i) => i !== actualLayer),
                  frames: project.frames.map((f) =>
                    f.filter((_, i) => i !== actualLayer),
                  ),
                })
              }
            >
              {t('studio20.remove')}
            </Button>
            <Button
              variant="outline"
              disabled={actualLayer === project.layers.length - 1}
              onClick={() => {
                const layers = [...project.layers],
                  to = actualLayer + 1;
                [layers[actualLayer], layers[to]] = [
                  layers[to],
                  layers[actualLayer],
                ];
                change({
                  ...project,
                  layers,
                  frames: project.frames.map((f) => {
                    const next = [...f];
                    [next[actualLayer], next[to]] = [
                      next[to],
                      next[actualLayer],
                    ];
                    return next;
                  }),
                });
                setLayer(to);
              }}
            >
              {t('batch3Media.raiseLayer')}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => task.run({ project, fps: query.fps ?? 8 })}
          disabled={task.busy}
        >
          {t('batch3Media.makeGif')}
        </Button>
        {task.busy && (
          <Button onClick={task.cancel} variant="outline">
            {t('studio20.cancel')}
          </Button>
        )}
        {task.result && (
          <Button
            variant="outline"
            onClick={() =>
              downloadBytes(task.result!, 'animation.gif', 'image/gif')
            }
          >
            {t('studio20.download')} GIF
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() =>
            preview.current?.toBlob((blob) => {
              if (blob) downloadBlob(blob, 'frame.png');
            })
          }
        >
          {t('studio20.download')} PNG
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            downloadBlob(
              new Blob([JSON.stringify(project)], { type: 'application/json' }),
              'pixel-project.json',
            )
          }
        >
          {t('batch3Media.saveProject')}
        </Button>
      </div>
      <FileDropzone
        accept=".json,image/png"
        onFiles={async (files) => {
          const file = files[0]?.file;
          if (!file) return;
          const ticket = ++revision.current;
          setError(null);
          try {
            if (file.size > 10 * 1024 * 1024) throw new Error('limit');
            if (file.name.toLowerCase().endsWith('.json')) {
              const value: unknown = JSON.parse(await file.text());
              if (!validPixelProject(value)) throw new Error('invalid');
              if (ticket === revision.current) {
                change(value);
                setFrame(0);
                setLayer(0);
              }
            } else {
              const bitmap = await createImageBitmap(file);
              try {
                if (bitmap.width > 4096 || bitmap.height > 4096)
                  throw new Error('limit');
                const c = document.createElement('canvas');
                c.width = project.width;
                c.height = project.height;
                const ctx = c.getContext('2d')!;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(bitmap, 0, 0, project.width, project.height);
                const rgba = ctx.getImageData(
                    0,
                    0,
                    project.width,
                    project.height,
                  ).data,
                  pixels = Array.from(
                    { length: project.width * project.height },
                    (_, i) =>
                      rgba[i * 4 + 3] < 128
                        ? ''
                        : `#${[rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`,
                  );
                if (ticket === revision.current)
                  change({
                    ...project,
                    frames: project.frames.map((f, i) =>
                      i === actualFrame
                        ? f.map((l, j) => (j === actualLayer ? pixels : l))
                        : f,
                    ),
                  });
                c.width = c.height = 0;
              } finally {
                bitmap.close();
              }
            }
          } catch (cause) {
            if (ticket === revision.current) setError((cause as Error).message);
          }
        }}
      >
        {t('batch3Media.importPixel')}
      </FileDropzone>
      {(error || task.error) && (
        <p role="alert" className="text-destructive">
          {t('batch3Media.failed', {
            message: t(`batch3Media.${error ?? task.error}`, {
              defaultValue: error ?? task.error ?? '',
            }),
          })}
        </p>
      )}
    </section>
  );
}
