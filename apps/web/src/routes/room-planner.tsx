import { Checkbox } from '@/components/ui/checkbox';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceField, Metric, NumberField } from '@/components/calculator-ui';
import {
  CreativePage,
  CreativeProjectActions,
  CreativeTextField,
} from '@/components/creative-tool-controls';
import { Button } from '@/components/ui/button';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { canvasPng } from '@/lib/creative-tools';
import { downloadBlob } from '@/lib/download';
import { boundedNumber } from '@/lib/focus-tools';
import {
  furnitureDistance,
  furnitureRect,
  roomCollisions,
  roomSvg,
  validateRoomProject,
  type Furniture,
  type RoomLayout,
  type SavedRoom,
} from '@/lib/room-planner';
export const Route = createFileRoute('/room-planner')({
  component: RoomPlannerPage,
});
const STORAGE_KEY = 'tools-room-planner-v1';
function RoomPlannerPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    width: number;
    height: number;
    snap: string;
  }>({ width: NumberParam, height: NumberParam, snap: StringParam });
  const width = boundedNumber(query.width, 500, 100, 3000),
    height = boundedNumber(query.height, 400, 100, 3000),
    snap = query.snap !== 'off';
  const [items, setItems] = useState<Furniture[]>([]),
    [plans, setPlans] = useState<SavedRoom[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [name, setName] = useState('');
  const [compare, setCompare] = useState<string[]>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState<string | null>(null),
    [saving, setSaving] = useState(false);
  const initial = useRef({ query, setQuery }),
    svg = useRef<SVGSVGElement>(null),
    dragging = useRef<{ id: string; dx: number; dy: number } | null>(null),
    alive = useRef(true),
    canSave = useRef(true);
  const layout: RoomLayout = { width, height, items },
    current = items.find((item) => item.id === selected) ?? null;
  const invalid = roomCollisions(layout),
    scale = Math.max(width, height) / 80;
  useEffect(() => {
    alive.current = true;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const value: unknown = JSON.parse(stored);
        if (!validateRoomProject(value)) throw new Error();
        setItems(value.current.items);
        setPlans(value.plans);
        initial.current.setQuery({
          width: initial.current.query.width ?? value.current.width,
          height: initial.current.query.height ?? value.current.height,
        });
      }
    } catch {
      canSave.current = false;
      setError(t('roomPlanner.restoreError'));
    }
    setLoaded(true);
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!loaded || !canSave.current) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          current: { width, height, items },
          plans,
        }),
      );
    } catch {
      setError(t('creativeCommon.localSaveError'));
    }
  }, [width, height, items, plans, loaded, t]);
  const update = (id: string, patch: Partial<Furniture>) =>
    setItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  const add = (kind: Furniture['kind']) => {
    const dimensions = {
      bed: [150, 200],
      desk: [120, 60],
      wardrobe: [120, 60],
    }[kind];
    const id = crypto.randomUUID();
    setItems((previous) => [
      ...previous,
      {
        id,
        name: t(`roomPlanner.${kind}`),
        kind,
        x: 20,
        y: 20,
        width: dimensions[0],
        depth: dimensions[1],
        rotated: false,
        color: { bed: '#bfdbfe', desk: '#fde68a', wardrobe: '#bbf7d0' }[kind],
      },
    ]);
    setSelected(id);
  };
  const exportPng = async () => {
    setSaving(true);
    try {
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(roomSvg(layout))}`;
      await image.decode();
      if (!alive.current) return;
      const canvas = document.createElement('canvas');
      const ratio = Math.min(2, 2400 / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      const context = canvas.getContext('2d');
      if (!context) throw new Error();
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await canvasPng(canvas);
      if (alive.current) downloadBlob(blob, 'room-plan.png');
    } catch {
      if (alive.current) setError(t('creativeCommon.saveError'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };
  const selectedRect = current ? furnitureRect(current) : null;
  return (
    <CreativePage title={t('roomPlanner.title')}>
      <fieldset disabled={!loaded} className="grid gap-3 md:grid-cols-3">
        <NumberField
          label={t('roomPlanner.roomWidth')}
          value={width}
          min={100}
          onChange={(value) =>
            setQuery({ width: boundedNumber(value, 500, 100, 3000) })
          }
        />
        <NumberField
          label={t('roomPlanner.roomHeight')}
          value={height}
          min={100}
          onChange={(value) =>
            setQuery({ height: boundedNumber(value, 400, 100, 3000) })
          }
        />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={snap}
            onCheckedChange={(checked) =>
              setQuery({ snap: checked === true ? 'on' : 'off' })
            }
          />
          {t('roomPlanner.snap')}
        </label>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        {(['bed', 'desk', 'wardrobe'] as const).map((kind) => (
          <Button
            key={kind}
            variant="outline"
            disabled={!loaded || items.length >= 50}
            onClick={() => add(kind)}
          >
            {t('roomPlanner.add', { name: t(`roomPlanner.${kind}`) })}
          </Button>
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-[2fr_1fr]">
        <svg
          ref={svg}
          viewBox={`-${scale * 4} -${scale * 4} ${width + scale * 8} ${height + scale * 8}`}
          aria-label={t('roomPlanner.canvas')}
          className="max-h-[70vh] w-full touch-none rounded border bg-muted/20"
          onPointerMove={(event) => {
            const drag = dragging.current,
              matrix = svg.current?.getScreenCTM();
            if (!drag || !matrix) return;
            const point = new DOMPoint(
                event.clientX,
                event.clientY,
              ).matrixTransform(matrix.inverse()),
              item = items.find((entry) => entry.id === drag.id);
            if (!item) return;
            const rect = furnitureRect(item),
              x = point.x - drag.dx,
              y = point.y - drag.dy;
            update(drag.id, {
              x: Math.max(
                0,
                Math.min(
                  width - rect.width,
                  snap ? Math.round(x / 10) * 10 : Math.round(x),
                ),
              ),
              y: Math.max(
                0,
                Math.min(
                  height - rect.height,
                  snap ? Math.round(y / 10) * 10 : Math.round(y),
                ),
              ),
            });
          }}
          onPointerUp={() => {
            dragging.current = null;
          }}
          onPointerCancel={() => {
            dragging.current = null;
          }}
        >
          <defs>
            <pattern
              id="room-planner-grid"
              width={50}
              height={50}
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 50 0 L 0 0 0 50"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={scale / 12}
              />
            </pattern>
          </defs>
          <rect width={width} height={height} fill="#ffffff" />
          <rect
            width={width}
            height={height}
            fill="url(#room-planner-grid)"
            stroke="#334155"
            strokeWidth={scale / 3}
          />
          {items.map((item) => {
            const rect = furnitureRect(item);
            return (
              <g
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`${item.name} ${rect.x}, ${rect.y}`}
                onFocus={() => setSelected(item.id)}
                onClick={() => setSelected(item.id)}
                onPointerDown={(event) => {
                  const matrix = svg.current?.getScreenCTM();
                  if (!matrix) return;
                  event.preventDefault();
                  const point = new DOMPoint(
                    event.clientX,
                    event.clientY,
                  ).matrixTransform(matrix.inverse());
                  dragging.current = {
                    id: item.id,
                    dx: point.x - item.x,
                    dy: point.y - item.y,
                  };
                  setSelected(item.id);
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onKeyDown={(event) => {
                  const delta: Record<string, [number, number]> = {
                    ArrowLeft: [-1, 0],
                    ArrowRight: [1, 0],
                    ArrowUp: [0, -1],
                    ArrowDown: [0, 1],
                  };
                  const direction = delta[event.key];
                  if (direction) {
                    event.preventDefault();
                    const step = event.shiftKey || snap ? 10 : 1;
                    update(item.id, {
                      x: Math.max(
                        0,
                        Math.min(
                          Math.max(0, width - rect.width),
                          item.x + direction[0] * step,
                        ),
                      ),
                      y: Math.max(
                        0,
                        Math.min(
                          Math.max(0, height - rect.height),
                          item.y + direction[1] * step,
                        ),
                      ),
                    });
                  }
                }}
                className="cursor-move focus:outline-none"
              >
                <rect
                  {...rect}
                  fill={item.color}
                  stroke={
                    invalid.includes(item.id)
                      ? '#dc2626'
                      : item.id === selected
                        ? '#2563eb'
                        : '#475569'
                  }
                  strokeWidth={item.id === selected ? scale / 2 : scale / 4}
                />
                <text
                  x={rect.x + rect.width / 2}
                  y={rect.y + rect.height / 2}
                  textAnchor="middle"
                  fontSize={Math.min(
                    scale * 2,
                    rect.width / Math.max(item.name.length, 4),
                    rect.height / 4,
                  )}
                  fill="#0f172a"
                >
                  {item.name}
                </text>
              </g>
            );
          })}
          {selectedRect && (
            <g
              stroke="#2563eb"
              strokeWidth={scale / 6}
              fill="#2563eb"
              fontSize={scale * 1.5}
              pointerEvents="none"
            >
              <line
                x1={0}
                y1={selectedRect.y + selectedRect.height / 2}
                x2={selectedRect.x}
                y2={selectedRect.y + selectedRect.height / 2}
                strokeDasharray={`${scale} ${scale / 2}`}
              />
              <text
                x={selectedRect.x / 2}
                y={selectedRect.y + selectedRect.height / 2 - scale}
                textAnchor="middle"
                stroke="none"
              >
                {Math.round(selectedRect.x)}
              </text>
              <line
                x1={selectedRect.x + selectedRect.width / 2}
                y1={0}
                x2={selectedRect.x + selectedRect.width / 2}
                y2={selectedRect.y}
                strokeDasharray={`${scale} ${scale / 2}`}
              />
              <text
                x={selectedRect.x + selectedRect.width / 2 + scale}
                y={selectedRect.y / 2}
                stroke="none"
              >
                {Math.round(selectedRect.y)}
              </text>
              <line
                x1={selectedRect.x + selectedRect.width}
                y1={selectedRect.y + selectedRect.height / 2}
                x2={width}
                y2={selectedRect.y + selectedRect.height / 2}
                strokeDasharray={`${scale} ${scale / 2}`}
              />
              <text
                x={(width + selectedRect.x + selectedRect.width) / 2}
                y={selectedRect.y + selectedRect.height / 2 - scale}
                textAnchor="middle"
                stroke="none"
              >
                {Math.round(width - selectedRect.x - selectedRect.width)}
              </text>
              <line
                x1={selectedRect.x + selectedRect.width / 2}
                y1={selectedRect.y + selectedRect.height}
                x2={selectedRect.x + selectedRect.width / 2}
                y2={height}
                strokeDasharray={`${scale} ${scale / 2}`}
              />
              <text
                x={selectedRect.x + selectedRect.width / 2 + scale}
                y={(height + selectedRect.y + selectedRect.height) / 2}
                stroke="none"
              >
                {Math.round(height - selectedRect.y - selectedRect.height)}
              </text>
            </g>
          )}
        </svg>
        <div className="space-y-3">
          {items.length > 0 && (
            <ChoiceField
              label={t('roomPlanner.selected')}
              value={selected ?? ''}
              onChange={setSelected}
              options={items.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
          )}
          {current && (
            <>
              <CreativeTextField
                label={t('roomPlanner.name')}
                value={current.name}
                maxLength={80}
                onChange={(value) => update(current.id, { name: value })}
              />
              <div className="grid grid-cols-2 gap-3">
                {(['x', 'y', 'width', 'depth'] as const).map((key) => (
                  <NumberField
                    key={key}
                    label={t(`roomPlanner.${key}`)}
                    value={current[key]}
                    onChange={(value) =>
                      update(current.id, {
                        [key]: boundedNumber(
                          value,
                          0,
                          key === 'width' || key === 'depth' ? 10 : 0,
                          key === 'width' || key === 'depth' ? 1000 : 3000,
                        ),
                      })
                    }
                  />
                ))}
              </div>
              <CreativeTextField
                label={t('creativeCommon.color')}
                type="color"
                value={current.color}
                onChange={(value) => update(current.id, { color: value })}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    update(current.id, { rotated: !current.rotated })
                  }
                >
                  {t('roomPlanner.rotate')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setItems((previous) =>
                      previous.filter((item) => item.id !== current.id),
                    );
                    setSelected(null);
                  }}
                >
                  {t('creativeCommon.remove')}
                </Button>
              </div>
              <p className="text-sm font-medium">
                {t('roomPlanner.distances')}
              </p>
              {items
                .filter((item) => item.id !== current.id)
                .map((item) => (
                  <p key={item.id} className="text-sm">
                    {item.name}: {furnitureDistance(current, item).toFixed(1)}{' '}
                    cm
                  </p>
                ))}
            </>
          )}
          {invalid.length > 0 && (
            <p role="alert" className="text-sm text-destructive">
              {t('roomPlanner.collision')}:{' '}
              {items
                .filter((item) => invalid.includes(item.id))
                .map((item) => item.name)
                .join(', ')}
            </p>
          )}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Metric
          label={t('roomPlanner.area')}
          value={`${((width * height) / 10000).toFixed(2)} m²`}
        />
        <Metric
          label={t('roomPlanner.furnitureArea')}
          value={`${(items.reduce((sum, item) => sum + item.width * item.depth, 0) / 10000).toFixed(2)} m²`}
        />
        <Metric
          label={t('roomPlanner.itemCount')}
          value={String(items.length)}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <CreativeTextField
          label={t('roomPlanner.planName')}
          value={name}
          maxLength={80}
          onChange={setName}
        />
        <Button
          disabled={!loaded || !name.trim() || plans.length >= 12}
          onClick={() => {
            const id = crypto.randomUUID();
            setPlans((previous) => [
              ...previous,
              {
                ...layout,
                id,
                name: name.trim(),
                items: items.map((item) => ({ ...item })),
              },
            ]);
            setCompare((previous) => [...previous.slice(-1), id]);
            setName('');
          }}
        >
          {t('roomPlanner.savePlan')}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            downloadBlob(
              new Blob([roomSvg(layout)], { type: 'image/svg+xml' }),
              'room-plan.svg',
            )
          }
        >
          {t('creativeCommon.svg')}
        </Button>
        <Button
          variant="outline"
          disabled={saving}
          onClick={() => void exportPng()}
        >
          {t('creativeCommon.png')}
        </Button>
      </div>
      {plans.length > 0 && (
        <>
          <p className="text-sm">{t('roomPlanner.compareHint')}</p>
          <div className="flex flex-wrap gap-2">
            {plans.map((plan) => (
              <label
                key={plan.id}
                className="flex items-center gap-2 rounded border p-2 text-sm"
              >
                <Checkbox
                  checked={compare.includes(plan.id)}
                  onCheckedChange={(checked) =>
                    setCompare((previous) =>
                      checked === true
                        ? [...previous.slice(-1), plan.id]
                        : previous.filter((id) => id !== plan.id),
                    )
                  }
                />
                {plan.name}
              </label>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {plans
              .filter((plan) => compare.includes(plan.id))
              .map((plan) => (
                <div key={plan.id} className="space-y-3 rounded border p-3">
                  <h2 className="font-semibold">{plan.name}</h2>
                  <img
                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(roomSvg(plan))}`}
                    alt={plan.name}
                    className="max-h-80 w-full object-contain"
                  />
                  <p className="text-sm">
                    {plan.width} × {plan.height} cm · {plan.items.length}{' '}
                    {t('roomPlanner.itemUnit')}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setItems(plan.items.map((item) => ({ ...item })));
                        setQuery({ width: plan.width, height: plan.height });
                        setSelected(null);
                      }}
                    >
                      {t('roomPlanner.loadPlan')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPlans((previous) =>
                          previous.filter((item) => item.id !== plan.id),
                        );
                        setCompare((previous) =>
                          previous.filter((id) => id !== plan.id),
                        );
                      }}
                    >
                      {t('creativeCommon.remove')}
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
      <CreativeProjectActions
        name="room-project"
        value={{ version: 1, current: layout, plans }}
        disabled={!loaded}
        onImport={(value) => {
          if (!validateRoomProject(value))
            throw new Error('creativeCommon.invalidProject');
          canSave.current = true;
          setItems(value.current.items);
          setPlans(value.plans);
          setQuery({
            width: value.current.width,
            height: value.current.height,
          });
          setSelected(null);
          setCompare(value.plans.slice(0, 2).map((plan) => plan.id));
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
