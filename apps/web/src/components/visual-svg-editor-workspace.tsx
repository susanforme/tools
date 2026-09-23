import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberParam, useQueryParams } from '@/hooks/useQueryParams';
import {
  arrangeObjects,
  newSvgObject,
  objectTransform,
  sceneSvg,
  selectedObjects,
  svgPath,
  validScene,
  type SvgObject,
  type SvgScene,
} from '@/lib/visual-svg-editor';
import { downloadBlob } from '@/lib/download';
import { patternPng } from '@/lib/seamless-pattern';
import { NumberField, ChoiceField } from './calculator-ui';
import { PracticalText, useLatestJob } from './practical-ui';
import { VisualError } from './visual-design-ui';
import { Button } from './ui/button';
import { Input } from './ui/input';
export function VisualSvgEditor() {
  const { t } = useTranslation();
  const [q, setQ] = useQueryParams<{
    canvasWidth: number;
    canvasHeight: number;
  }>({ canvasWidth: NumberParam, canvasHeight: NumberParam });
  const [objects, setObjects] = useState<SvgObject[]>([
      newSvgObject('rect', 'first'),
    ]),
    [selection, setSelection] = useState<string[]>(['first']),
    [history, setHistory] = useState<SvgObject[][]>([]),
    [error, setError] = useState<string | null>(null);
  const scene: SvgScene = {
    width: q.canvasWidth ?? 640,
    height: q.canvasHeight ?? 400,
    objects,
  };
  const selected = selectedObjects(objects, selection),
    active = selected.length === 1 ? selected[0] : null;
  const drag = useRef<{
    startX: number;
    startY: number;
    before: SvgObject[];
    ids: string[];
    node: { id: string; index: number; offset: number } | null;
    matrix: DOMMatrix;
  } | null>(null);
  const loadTicket = useRef(0);
  useEffect(
    () => () => {
      loadTicket.current++;
    },
    [],
  );
  const job = useLatestJob<Blob>(JSON.stringify(scene));
  const commit = (next: SvgObject[]) => {
    setHistory((old) => [...old.slice(-29), objects]);
    setObjects(next);
    setError(null);
  };
  const patch = (id: string, changes: Partial<SvgObject>) =>
    commit(objects.map((o) => (o.id === id ? { ...o, ...changes } : o)));
  const act = (operation: string) => {
    try {
      commit(arrangeObjects(objects, selection, operation));
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  const moveLayer = (direction: number) => {
    const ids = new Set(selected.map((o) => o.id));
    const next = [...objects];
    const indices =
      direction > 0
        ? Array.from({ length: next.length }, (_, i) => next.length - 1 - i)
        : Array.from({ length: next.length }, (_, i) => i);
    for (const i of indices) {
      const j = i + direction;
      if (
        j >= 0 &&
        j < next.length &&
        ids.has(next[i].id) &&
        !ids.has(next[j].id)
      )
        [next[i], next[j]] = [next[j], next[i]];
    }
    commit(next);
  };
  let svg = '';
  try {
    svg = sceneSvg(scene);
  } catch {
    /* 输入中的无效尺寸由下方错误提示覆盖。 */
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('visualDesign.svgHint')}
      </p>
      <div className="flex flex-wrap gap-2">
        {(['rect', 'ellipse', 'text', 'path'] as const).map((kind) => (
          <Button
            key={kind}
            variant="outline"
            disabled={objects.length >= 100}
            onClick={() => {
              const object = newSvgObject(kind, crypto.randomUUID());
              object.name = t(`visualDesign.${kind}`);
              object.text = t('visualDesign.sampleText');
              commit([...objects, object]);
              setSelection([object.id]);
            }}
          >
            {t(`visualDesign.${kind}`)}
          </Button>
        ))}
        <Button
          variant="outline"
          disabled={!history.length}
          onClick={() => {
            setObjects(history.at(-1)!);
            setHistory(history.slice(0, -1));
            setSelection([]);
          }}
        >
          {t('visualDesign.undo')}
        </Button>
        <Button
          variant="outline"
          disabled={!selected.length}
          onClick={() => {
            commit(objects.filter((o) => !selected.some((s) => s.id === o.id)));
            setSelection([]);
          }}
        >
          {t('visualDesign.remove')}
        </Button>
        <Button
          variant="outline"
          disabled={selected.length < 2}
          onClick={() => {
            const group = crypto.randomUUID(),
              ids = new Set(selected.map((o) => o.id));
            commit([
              ...objects.filter((o) => !ids.has(o.id)),
              ...selected.map((o) => ({ ...o, group })),
            ]);
          }}
        >
          {t('visualDesign.group')}
        </Button>
        <Button
          variant="outline"
          disabled={!selected.some((o) => o.group)}
          onClick={() =>
            commit(
              objects.map((o) =>
                selected.some((s) => s.id === o.id) ? { ...o, group: null } : o,
              ),
            )
          }
        >
          {t('visualDesign.ungroup')}
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <NumberField
          label={t('visualDesign.canvasWidth')}
          value={scene.width}
          min={10}
          max={4000}
          onChange={(canvasWidth) => setQ({ canvasWidth })}
        />
        <NumberField
          label={t('visualDesign.canvasHeight')}
          value={scene.height}
          min={10}
          max={4000}
          onChange={(canvasHeight) => setQ({ canvasHeight })}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_240px]">
        <div className="space-y-2">
          <h2 className="font-semibold">{t('visualDesign.layers')}</h2>
          <div className="max-h-80 space-y-1 overflow-auto">
            {[...objects].reverse().map((o) => (
              <div key={o.id} className="flex gap-1">
                <Button
                  className="min-w-0 flex-1 truncate"
                  variant={
                    selected.some((s) => s.id === o.id) ? 'default' : 'outline'
                  }
                  onClick={(e) =>
                    setSelection(
                      e.shiftKey
                        ? selection.includes(o.id)
                          ? selection.filter((id) => id !== o.id)
                          : [...selection, o.id]
                        : [o.id],
                    )
                  }
                >
                  {o.name}
                  {o.group ? ' ⊞' : ''}
                </Button>
                <Button
                  variant="outline"
                  aria-label={t(
                    o.hidden ? 'visualDesign.show' : 'visualDesign.hide',
                  )}
                  onClick={() => patch(o.id, { hidden: !o.hidden })}
                >
                  {o.hidden ? '○' : '●'}
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!selected.length}
              onClick={() => moveLayer(1)}
            >
              {t('visualDesign.up')}
            </Button>
            <Button
              variant="outline"
              disabled={!selected.length}
              onClick={() => moveLayer(-1)}
            >
              {t('visualDesign.down')}
            </Button>
          </div>
          <ChoiceField
            label={t('visualDesign.align')}
            value=""
            options={[
              'left',
              'center',
              'right',
              'top',
              'middle',
              'bottom',
              'distributeX',
              'distributeY',
            ].map((value) => ({ value, label: t(`visualDesign.${value}`) }))}
            onChange={act}
          />
        </div>
        <svg
          viewBox={`0 0 ${scene.width} ${scene.height}`}
          className="max-h-[70vh] w-full touch-none rounded border bg-white"
          role="img"
          aria-label={t('visualDesign.editorTitle')}
          onPointerDown={(e) => {
            const target = e.target as Element;
            const group = target.closest<SVGGElement>('[data-object]');
            if (!group) {
              setSelection([]);
              return;
            }
            const id = group.dataset.object!;
            const pick = e.shiftKey
              ? [...new Set([...selection, id])]
              : selected.some((o) => o.id === id)
                ? selection
                : [id];
            setSelection(pick);
            const node = target.getAttribute('data-node');
            const matrix = (
              node ? group.getScreenCTM() : e.currentTarget.getScreenCTM()
            )?.inverse();
            if (!matrix) return;
            const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
              matrix,
            );
            drag.current = {
              startX: p.x,
              startY: p.y,
              before: objects,
              ids: selectedObjects(objects, pick).map((o) => o.id),
              node: node
                ? {
                    id,
                    index: +node.split(':')[0],
                    offset: +node.split(':')[1],
                  }
                : null,
              matrix,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const state = drag.current;
            if (!state) return;
            const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
              state.matrix,
            );
            if (state.node) {
              const node = state.node;
              setObjects(
                state.before.map((o) =>
                  o.id === node.id
                    ? {
                        ...o,
                        nodes: o.nodes.map((n, i) =>
                          i === node.index
                            ? {
                                ...n,
                                values: n.values.map((v, j) =>
                                  j === node.offset
                                    ? Math.max(0, Math.min(100, p.x))
                                    : j === node.offset + 1
                                      ? Math.max(0, Math.min(100, p.y))
                                      : v,
                                ),
                              }
                            : n,
                        ),
                      }
                    : o,
                ),
              );
            } else
              setObjects(
                state.before.map((o) =>
                  state.ids.includes(o.id)
                    ? {
                        ...o,
                        x: o.x + p.x - state.startX,
                        y: o.y + p.y - state.startY,
                      }
                    : o,
                ),
              );
          }}
          onPointerUp={() => {
            if (drag.current) {
              const before = drag.current.before;
              setHistory((old) => [...old.slice(-29), before]);
              drag.current = null;
            }
          }}
          onPointerCancel={() => {
            if (drag.current) setObjects(drag.current.before);
            drag.current = null;
          }}
        >
          {objects
            .filter((o) => !o.hidden)
            .map((o) => (
              <g
                key={o.id}
                data-object={o.id}
                transform={objectTransform(o)}
                fill={o.fill}
                stroke={o.stroke}
                strokeWidth={o.strokeWidth}
              >
                {o.kind === 'rect' ? (
                  <rect
                    width="100"
                    height="100"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : o.kind === 'ellipse' ? (
                  <ellipse
                    cx="50"
                    cy="50"
                    rx="50"
                    ry="50"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : o.kind === 'text' ? (
                  <text
                    x="0"
                    y="75"
                    fontSize="75"
                    textLength="100"
                    lengthAdjust="spacingAndGlyphs"
                    vectorEffect="non-scaling-stroke"
                  >
                    {o.text}
                  </text>
                ) : (
                  <path
                    d={svgPath(o.nodes)}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {selected.some((s) => s.id === o.id) && (
                  <rect
                    x="-2"
                    y="-2"
                    width="104"
                    height="104"
                    fill="none"
                    stroke="#e11d48"
                    strokeWidth="1"
                    strokeDasharray="4 2"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                )}
                {active?.id === o.id &&
                  o.kind === 'path' &&
                  o.nodes.flatMap((n, i) =>
                    Array.from({ length: n.values.length / 2 }, (_, k) => (
                      <circle
                        key={`${i}-${k}`}
                        data-node={`${i}:${k * 2}`}
                        cx={n.values[k * 2]}
                        cy={n.values[k * 2 + 1]}
                        r="3"
                        fill="#fff"
                        stroke="#e11d48"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                    )),
                  )}
              </g>
            ))}
        </svg>
        <div className="max-h-[70vh] space-y-3 overflow-auto">
          {active && (
            <>
              <PracticalText
                label={t('visualDesign.name')}
                value={active.name}
                maxLength={100}
                onChange={(name) => patch(active.id, { name })}
              />
              {(
                [
                  'x',
                  'y',
                  'width',
                  'height',
                  'rotation',
                  'strokeWidth',
                ] as const
              ).map((field) => (
                <NumberField
                  key={field}
                  label={t(`visualDesign.object_${field}`)}
                  value={active[field]}
                  min={
                    field === 'x' || field === 'y' || field === 'rotation'
                      ? -10000
                      : 0
                  }
                  onChange={(value) => patch(active.id, { [field]: value })}
                />
              ))}
              {(['fill', 'stroke'] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <label className="text-sm">
                    {t(`visualDesign.${field}`)}
                    <Input
                      type="color"
                      value={
                        active[field] === 'none' ? '#000000' : active[field]
                      }
                      onChange={(e) =>
                        patch(active.id, { [field]: e.target.value })
                      }
                    />
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      patch(active.id, {
                        [field]: active[field] === 'none' ? '#000000' : 'none',
                      })
                    }
                  >
                    {t('visualDesign.none')}
                  </Button>
                </div>
              ))}
              {active.kind === 'text' && (
                <PracticalText
                  label={t('visualDesign.text')}
                  value={active.text}
                  maxLength={500}
                  onChange={(text) => patch(active.id, { text })}
                />
              )}{' '}
              {active.kind === 'path' && (
                <>
                  <h3>{t('visualDesign.nodes')}</h3>
                  {active.nodes.map((node, i) => (
                    <div key={i} className="rounded border p-2">
                      <span>{node.command}</span>
                      {node.values.map((value, j) => (
                        <NumberField
                          key={j}
                          label={`${i + 1} ${j % 2 ? 'Y' : 'X'}${Math.floor(j / 2) + 1}`}
                          value={value}
                          min={0}
                          max={100}
                          onChange={(v) =>
                            patch(active.id, {
                              nodes: active.nodes.map((n, k) =>
                                k === i
                                  ? {
                                      ...n,
                                      values: n.values.map((old, l) =>
                                        l === j ? v : old,
                                      ),
                                    }
                                  : n,
                              ),
                            })
                          }
                        />
                      ))}
                      {i > 0 && active.nodes.length > 2 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            patch(active.id, {
                              nodes: active.nodes.filter((_, k) => k !== i),
                            })
                          }
                        >
                          {t('visualDesign.remove')}
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    disabled={active.nodes.length >= 100}
                    onClick={() => {
                      const nodes = [...active.nodes];
                      const at =
                        nodes.at(-1)?.command === 'Z'
                          ? nodes.length - 1
                          : nodes.length;
                      nodes.splice(at, 0, { command: 'L', values: [50, 50] });
                      patch(active.id, { nodes });
                    }}
                  >
                    {t('visualDesign.addNode')}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!svg}
          onClick={() =>
            downloadBlob(
              new Blob([svg], { type: 'image/svg+xml' }),
              'drawing.svg',
            )
          }
        >
          SVG
        </Button>
        <Button
          disabled={!svg || job.busy}
          onClick={() => void job.run(() => patternPng(svg))}
        >
          PNG
        </Button>
        {job.result && (
          <Button onClick={() => downloadBlob(job.result!, 'drawing.png')}>
            {t('visualDesign.download')}
          </Button>
        )}
        <Button
          variant="outline"
          disabled={!svg}
          onClick={() =>
            downloadBlob(
              new Blob([JSON.stringify(scene, null, 2)], {
                type: 'application/json',
              }),
              'drawing.json',
            )
          }
        >
          {t('visualDesign.saveProject')}
        </Button>
        <label className="text-sm">
          {t('visualDesign.openProject')}
          <Input
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const ticket = ++loadTicket.current;
              void (async () => {
                try {
                  if (file.size > 500000) throw new Error('size');
                  const value: unknown = JSON.parse(await file.text());
                  if (!validScene(value)) throw new Error('svg');
                  if (ticket !== loadTicket.current) return;
                  commit(value.objects);
                  setQ({
                    canvasWidth: value.width,
                    canvasHeight: value.height,
                  });
                  setSelection([]);
                } catch (cause) {
                  if (ticket === loadTicket.current)
                    setError((cause as Error).message);
                }
              })();
            }}
          />
        </label>
      </div>
      <VisualError error={error ?? job.error ?? (!svg ? 'svg' : null)} />
    </div>
  );
}
