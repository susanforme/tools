import { useId, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StringParam,
  NumberParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import { canvasBlob } from '@/lib/image-document-tools';
import { OrganizerFrame, useOrganizerStore } from './organizer-store';
import { PracticalText } from './practical-ui';
import { ChoiceField } from './calculator-ui';
import { Button } from './ui/button';
type Shape = {
  id: string;
  kind: string;
  points: number[][];
  color: string;
  text: string;
};
const INITIAL: Shape[] = [];
export function validateBoard(value: unknown): value is Shape[] {
  return (
    Array.isArray(value) &&
    new TextEncoder().encode(JSON.stringify(value)).length <= 1500000 &&
    value.length <= 500 &&
    value.every(
      (s) =>
        typeof s === 'object' &&
        s !== null &&
        typeof s.id === 'string' &&
        s.id.length < 100 &&
        ['pen', 'rectangle', 'arrow', 'note'].includes(s.kind) &&
        /^#[0-9a-f]{6}$/i.test(s.color) &&
        typeof s.text === 'string' &&
        s.text.length <= 300 &&
        Array.isArray(s.points) &&
        s.points.length >= 2 &&
        s.points.length <= 2000 &&
        s.points.every(
          (p: unknown) =>
            Array.isArray(p) &&
            p.length === 2 &&
            p.every(
              (n) =>
                typeof n === 'number' &&
                Number.isFinite(n) &&
                Math.abs(n) <= 1e7,
            ),
        ),
    ) &&
    new Set(value.map((s) => s.id)).size === value.length
  );
}
export function Whiteboard() {
  const { t } = useTranslation();
  const store = useOrganizerStore(
    'practical-whiteboard',
    INITIAL,
    validateBoard,
  );
  const [query, setQuery] = useQueryParams<{
    mode: string;
    color: string;
    zoom: number;
  }>({ mode: StringParam, color: StringParam, zoom: NumberParam });
  const mode = query.mode ?? 'pen',
    color = /^#[0-9a-f]{6}$/i.test(query.color ?? '')
      ? query.color!
      : '#2563eb',
    zoom = Math.min(4, Math.max(0.2, query.zoom ?? 1));
  const [origin, setOrigin] = useState([0, 0]),
    [draft, setDraft] = useState<Shape | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [text, setText] = useState(''),
    [error, setError] = useState<string | null>(null),
    [history, setHistory] = useState<Shape[][]>([]),
    [future, setFuture] = useState<Shape[][]>([]);
  const svg = useRef<SVGSVGElement>(null),
    marker = useId().replace(/:/g, '');
  const gesture = useRef<{
      start: number[];
      origin: number[];
      shape: Shape | null;
    } | null>(null),
    latestDraft = useRef<Shape | null>(null);
  const point = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      origin[0] + (((event.clientX - rect.left) / rect.width) * 1000) / zoom,
      origin[1] + (((event.clientY - rect.top) / rect.height) * 600) / zoom,
    ];
  };
  const commit = (next: Shape[]) => {
    if (store.setData(next)) {
      setHistory((old) => [...old.slice(-29), store.data]);
      setFuture([]);
    }
  };
  const updateDraft = (next: Shape | null) => {
    latestDraft.current = next;
    setDraft(next);
  };
  const down = (event: PointerEvent<SVGSVGElement>) => {
    const at = point(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (mode === 'pan') {
      gesture.current = {
        start: [event.clientX, event.clientY],
        origin: [...origin],
        shape: null,
      };
      return;
    }
    if (mode === 'select') {
      const id =
        (event.target as Element)
          .closest('[data-shape]')
          ?.getAttribute('data-shape') ?? null;
      setSelected(id);
      const shape = store.data.find((s) => s.id === id) ?? null;
      setText(shape?.text ?? '');
      gesture.current = { start: at, origin: [...origin], shape };
      if (shape) updateDraft({ ...shape });
      return;
    }
    const shape: Shape = {
      id: crypto.randomUUID(),
      kind: mode,
      points: [at, at],
      color,
      text: mode === 'note' ? text || t('studio20.note') : '',
    };
    gesture.current = { start: at, origin: [...origin], shape };
    updateDraft(shape);
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const active = gesture.current;
    if (!active) return;
    if (mode === 'pan') {
      const rect = event.currentTarget.getBoundingClientRect();
      setOrigin([
        active.origin[0] -
          (((event.clientX - active.start[0]) / rect.width) * 1000) / zoom,
        active.origin[1] -
          (((event.clientY - active.start[1]) / rect.height) * 600) / zoom,
      ]);
      return;
    }
    const shape = active.shape;
    if (!shape) return;
    const at = point(event);
    if (mode === 'select')
      updateDraft({
        ...shape,
        points: shape.points.map(([x, y]) => [
          x + at[0] - active.start[0],
          y + at[1] - active.start[1],
        ]),
      });
    else if (mode === 'pen')
      updateDraft({
        ...shape,
        points: [...(latestDraft.current?.points ?? []).slice(0, 1999), at],
      });
    else updateDraft({ ...shape, points: [active.start, at] });
  };
  const end = () => {
    const shape = latestDraft.current;
    if (shape)
      commit(
        mode === 'select'
          ? store.data.map((s) => (s.id === shape.id ? shape : s))
          : [...store.data, shape],
      );
    gesture.current = null;
    updateDraft(null);
  };
  const exportSvg = () => {
    if (!svg.current) throw new Error('invalid');
    const clone = svg.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', '1600');
    clone.setAttribute('height', '960');
    return new XMLSerializer().serializeToString(clone);
  };
  const png = async () => {
    let url = '';
    try {
      url = URL.createObjectURL(
        new Blob([exportSvg()], { type: 'image/svg+xml' }),
      );
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 960;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 1600, 960);
      ctx.drawImage(image, 0, 0);
      downloadBlob(await canvasBlob(canvas), 'whiteboard.png');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  };
  return (
    <OrganizerFrame title={t('studio20.tools.whiteboard.title')} store={store}>
      <div className="grid gap-3 md:grid-cols-3">
        <ChoiceField
          label={t('studio20.mode')}
          value={mode}
          options={['select', 'pan', 'pen', 'rectangle', 'arrow', 'note'].map(
            (value) => ({ value, label: t(`studio20.${value}`) }),
          )}
          onChange={(mode) => setQuery({ mode })}
        />
        <PracticalText
          label={t('studio20.color')}
          type="color"
          value={color}
          onChange={(color) => setQuery({ color })}
        />
        <PracticalText
          label={t('studio20.content')}
          value={text}
          maxLength={300}
          onChange={setText}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!history.length}
          onClick={() => {
            if (store.setData(history.at(-1)!)) {
              setFuture((old) => [store.data, ...old]);
              setHistory((old) => old.slice(0, -1));
            }
          }}
        >
          {t('studio20.undo')}
        </Button>
        <Button
          variant="outline"
          disabled={!future.length}
          onClick={() => {
            if (store.setData(future[0])) {
              setHistory((old) => [...old, store.data]);
              setFuture((old) => old.slice(1));
            }
          }}
        >
          {t('studio20.redo')}
        </Button>
        <Button
          variant="outline"
          onClick={() => setQuery({ zoom: Math.min(4, zoom * 1.25) })}
        >
          {t('studio20.zoomIn')}
        </Button>
        <Button
          variant="outline"
          onClick={() => setQuery({ zoom: Math.max(0.2, zoom / 1.25) })}
        >
          {t('studio20.zoomOut')}
        </Button>
        <Button
          variant="outline"
          disabled={!selected}
          onClick={() => {
            commit(store.data.filter((s) => s.id !== selected));
            setSelected(null);
          }}
        >
          {t('studio20.remove')}
        </Button>
        <Button
          variant="outline"
          disabled={!selected}
          onClick={() =>
            commit(
              store.data.map((s) =>
                s.id === selected ? { ...s, text, color } : s,
              ),
            )
          }
        >
          {t('studio20.save')}
        </Button>
        <Button variant="outline" onClick={() => void png()}>
          {t('studio20.png')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            try {
              downloadBlob(
                new Blob([exportSvg()], { type: 'image/svg+xml' }),
                'whiteboard.svg',
              );
            } catch (cause) {
              setError((cause as Error).message);
            }
          }}
        >
          {t('studio20.svg')}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <svg
        ref={svg}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`${origin[0]} ${origin[1]} ${1000 / zoom} ${600 / zoom}`}
        className="aspect-[5/3] w-full touch-none rounded-xl border bg-white"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={() => {
          gesture.current = null;
          updateDraft(null);
        }}
      >
        <defs>
          <marker
            id={marker}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10Z" fill="context-stroke" />
          </marker>
        </defs>
        {[
          ...store.data.filter((s) => s.id !== draft?.id),
          ...(draft ? [draft] : []),
        ].map((shape) => {
          const [a, b] = [shape.points[0], shape.points.at(-1)!],
            x = Math.min(a[0], b[0]),
            y = Math.min(a[1], b[1]);
          return (
            <g
              key={shape.id}
              data-shape={shape.id}
              stroke={shape.color}
              strokeWidth={selected === shape.id ? 4 : 2}
              fill="none"
            >
              {shape.kind === 'pen' ? (
                <polyline
                  points={shape.points.map((p) => p.join(',')).join(' ')}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : shape.kind === 'arrow' ? (
                <line
                  x1={a[0]}
                  y1={a[1]}
                  x2={b[0]}
                  y2={b[1]}
                  markerEnd={`url(#${marker})`}
                />
              ) : (
                <rect
                  x={x}
                  y={y}
                  width={Math.max(
                    shape.kind === 'note' ? 160 : 1,
                    Math.abs(a[0] - b[0]),
                  )}
                  height={Math.max(
                    shape.kind === 'note' ? 100 : 1,
                    Math.abs(a[1] - b[1]),
                  )}
                  rx={shape.kind === 'note' ? 6 : 0}
                  fill={shape.kind === 'note' ? '#fef08a' : 'transparent'}
                />
              )}{' '}
              {shape.kind === 'note' && (
                <text
                  x={x + 10}
                  y={y + 25}
                  fontSize="16"
                  stroke="none"
                  fill="#111827"
                >
                  {Array.from(
                    { length: Math.min(10, Math.ceil(shape.text.length / 16)) },
                    (_, i) => (
                      <tspan key={i} x={x + 10} dy={i ? 20 : 0}>
                        {shape.text.slice(i * 16, (i + 1) * 16)}
                      </tspan>
                    ),
                  )}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </OrganizerFrame>
  );
}
