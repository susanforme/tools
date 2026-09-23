import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  circuitStep,
  EXAMPLE_CIRCUIT,
  GATE_KINDS,
  gatePorts,
  initialCircuitState,
  validCircuit,
  type Bit,
  type CircuitState,
  type GateKind,
} from '@/lib/digital-circuit';
import { ChoiceField, NumberField } from './calculator-ui';
import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from './organizer-store';
import { Button } from './ui/button';

export default function DigitalCircuit() {
  const { t } = useTranslation(),
    l = (key: string) => t(`scienceExpansion.${key}`),
    c = (key: string) => l(`circuit.${key}`);
  const store = useOrganizerStore(
      'digital-circuit-v1',
      EXAMPLE_CIRCUIT,
      validCircuit,
    ),
    graph = store.data;
  const [kind, setKind] = useState<GateKind>('AND'),
    [label, setLabel] = useState(''),
    [selected, setSelected] = useState('input');
  const [source, setSource] = useState('input'),
    [target, setTarget] = useState('register'),
    [port, setPort] = useState('0');
  const [running, setRunning] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, Bit>[]>([]);
  const simulation = useRef<CircuitState>(initialCircuitState());
  const [rate, setRate] = useQueryParam<number>('interval', NumberParam, 500);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const advance = useCallback(
    (tick: boolean, input?: string) => {
      try {
        const previous = simulation.current;
        const next = input
          ? {
              ...previous,
              inputs: {
                ...previous.inputs,
                [input]:
                  previous.inputs[input] === 1 ? (0 as const) : (1 as const),
              },
            }
          : previous;
        const result = circuitStep(graph, next, tick);
        simulation.current = result.state;
        setHistory((rows) => [...rows.slice(-99), result.values]);
        setError(null);
      } catch (cause) {
        setError((cause as Error).message);
        setRunning(false);
      }
    },
    [graph],
  );
  const reset = useCallback(() => {
    setRunning(false);
    simulation.current = initialCircuitState();
    setHistory([]);
    advance(false);
  }, [advance]);
  useEffect(reset, [reset]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(
      () => advance(true),
      Number.isFinite(rate) ? Math.min(5000, Math.max(100, rate)) : 500,
    );
    return () => clearInterval(timer);
  }, [running, rate, advance]);
  const values = history.at(-1) ?? {},
    node = graph.nodes.find((n) => n.id === selected);
  const nodes = graph.nodes.map((n) =>
    n.id === drag?.id ? { ...n, x: drag.x, y: drag.y } : n,
  );
  const options = graph.nodes.map((n) => ({
    value: n.id,
    label: `${n.label || n.kind} · ${n.kind}`,
  }));
  const drawBit = (bit: Bit | undefined) =>
    bit === 0 ? '0' : bit === 1 ? '1' : 'X';
  return (
    <OrganizerFrame title={c('title')} store={store}>
      <p className="text-sm text-muted-foreground">{c('hint')}</p>
      {error && (
        <p role="alert" className="text-destructive">
          {l(error)}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <ChoiceField
          label={c('kind')}
          value={kind}
          options={GATE_KINDS.map((value) => ({ value, label: c(value) }))}
          onChange={(value) => setKind(value as GateKind)}
        />
        <OrganizerInput
          label={c('label')}
          value={label}
          maxLength={40}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Button
          className="self-end"
          disabled={graph.nodes.length >= 80}
          onClick={() => {
            const id = crypto.randomUUID();
            if (
              store.setData({
                ...graph,
                nodes: [
                  ...graph.nodes,
                  {
                    id,
                    kind,
                    label: label || kind,
                    x: 100 + (graph.nodes.length % 5) * 130,
                    y: 80 + (Math.floor(graph.nodes.length / 5) % 5) * 90,
                  },
                ],
              })
            )
              setSelected(id);
          }}
        >
          {l('add')}
        </Button>
      </div>
      <div className="overflow-auto rounded border">
        <svg
          viewBox="0 0 1020 620"
          className="min-w-[700px] w-full touch-none"
          aria-label={c('title')}
          onPointerMove={(e) => {
            if (!drag) return;
            const matrix = e.currentTarget.getScreenCTM();
            if (!matrix) return;
            const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(
              matrix.inverse(),
            );
            setDrag({
              ...drag,
              x: Math.max(0, Math.min(900, point.x - 50)),
              y: Math.max(0, Math.min(540, point.y - 30)),
            });
          }}
          onPointerUp={() => {
            if (drag)
              store.setData({
                ...graph,
                nodes: graph.nodes.map((n) =>
                  n.id === drag.id ? { ...n, x: drag.x, y: drag.y } : n,
                ),
              });
            setDrag(null);
          }}
          onPointerCancel={() => setDrag(null)}
        >
          {graph.wires.map((wire, i) => {
            const a = nodes.find((n) => n.id === wire.from)!,
              b = nodes.find((n) => n.id === wire.to)!;
            return (
              <path
                key={i}
                d={`M ${a.x + 110} ${a.y + 30} H ${(a.x + b.x + 110) / 2} V ${b.y + 20 + wire.port * 20} H ${b.x}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={
                  values[a.id] === 1
                    ? 'text-emerald-500'
                    : values[a.id] === 0
                      ? 'text-muted-foreground'
                      : 'text-amber-500'
                }
              />
            );
          })}
          {nodes.map((n) => (
            <g
              key={n.id}
              transform={`translate(${n.x} ${n.y})`}
              role="button"
              tabIndex={0}
              aria-label={`${n.label} ${n.kind}: ${drawBit(values[n.id])}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected(n.id);
                }
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setSelected(n.id);
                setDrag({ id: n.id, x: n.x, y: n.y });
              }}
              className="cursor-move"
            >
              <rect
                width="110"
                height="60"
                rx="8"
                className="fill-background"
                stroke="currentColor"
                strokeWidth={selected === n.id ? 3 : 1}
              />
              <text
                x="55"
                y="20"
                textAnchor="middle"
                className="fill-foreground text-xs"
              >
                {n.label.slice(0, 14)}
              </text>
              <text
                x="55"
                y="43"
                textAnchor="middle"
                className="fill-foreground text-sm"
              >
                {n.kind} · {drawBit(values[n.id])}
              </text>
              {Array.from({ length: gatePorts(n.kind) }, (_, i) => (
                <circle
                  key={i}
                  cx="0"
                  cy={20 + i * 20}
                  r="4"
                  className="fill-primary"
                />
              ))}
              {n.kind !== 'OUTPUT' && (
                <circle cx="110" cy="30" r="4" className="fill-primary" />
              )}
            </g>
          ))}
        </svg>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <ChoiceField
          label={c('select')}
          value={node?.id ?? ''}
          options={options}
          onChange={setSelected}
        />
        {node && (
          <>
            <OrganizerInput
              label={c('label')}
              value={node.label}
              maxLength={40}
              onChange={(e) =>
                store.setData({
                  ...graph,
                  nodes: graph.nodes.map((n) =>
                    n.id === node.id ? { ...n, label: e.target.value } : n,
                  ),
                })
              }
            />
            <NumberField
              label={c('x')}
              value={node.x}
              max={900}
              onChange={(x) =>
                store.setData({
                  ...graph,
                  nodes: graph.nodes.map((n) =>
                    n.id === node.id ? { ...n, x } : n,
                  ),
                })
              }
            />
            <NumberField
              label={c('y')}
              value={node.y}
              max={540}
              onChange={(y) =>
                store.setData({
                  ...graph,
                  nodes: graph.nodes.map((n) =>
                    n.id === node.id ? { ...n, y } : n,
                  ),
                })
              }
            />
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={node?.kind !== 'INPUT'}
          onClick={() => advance(false, selected)}
        >
          {c('toggle')}
        </Button>
        <Button
          variant="outline"
          disabled={!node}
          onClick={() =>
            store.setData({
              nodes: graph.nodes.filter((n) => n.id !== selected),
              wires: graph.wires.filter(
                (w) => w.from !== selected && w.to !== selected,
              ),
            })
          }
        >
          {l('remove')}
        </Button>
        <Button
          variant="outline"
          onClick={() => store.setData(EXAMPLE_CIRCUIT)}
        >
          {c('example')}
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <ChoiceField
          label={c('source')}
          value={source}
          options={options.filter(
            (o) => graph.nodes.find((n) => n.id === o.value)?.kind !== 'OUTPUT',
          )}
          onChange={setSource}
        />
        <ChoiceField
          label={c('target')}
          value={target}
          options={options.filter(
            (o) =>
              gatePorts(graph.nodes.find((n) => n.id === o.value)!.kind) > 0,
          )}
          onChange={(value) => {
            setTarget(value);
            setPort('0');
          }}
        />
        <ChoiceField
          label={c('port')}
          value={port}
          options={Array.from(
            {
              length: gatePorts(
                graph.nodes.find((n) => n.id === target)?.kind ?? 'INPUT',
              ),
            },
            (_, i) => ({
              value: String(i),
              label:
                graph.nodes.find((n) => n.id === target)?.kind === 'DFF'
                  ? i
                    ? 'CLK'
                    : 'D'
                  : String(i + 1),
            }),
          )}
          onChange={setPort}
        />
        <Button
          className="self-end"
          onClick={() => {
            const wires = graph.wires.filter(
              (w) => w.to !== target || w.port !== +port,
            );
            store.setData({
              ...graph,
              wires: [...wires, { from: source, to: target, port: +port }],
            });
          }}
        >
          {c('connect')}
        </Button>
      </div>
      <details>
        <summary>
          {c('wires')} ({graph.wires.length})
        </summary>
        <div className="grid gap-2 md:grid-cols-3">
          {graph.wires.map((w, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 rounded border p-2 text-sm"
            >
              <span>
                {graph.nodes.find((n) => n.id === w.from)?.label} →{' '}
                {graph.nodes.find((n) => n.id === w.to)?.label} [{w.port + 1}]
              </span>
              <Button
                size="sm"
                variant="outline"
                aria-label={`${l('remove')} ${i + 1}`}
                onClick={() =>
                  store.setData({
                    ...graph,
                    wires: graph.wires.filter((_, index) => index !== i),
                  })
                }
              >
                {l('remove')}
              </Button>
            </div>
          ))}
        </div>
      </details>
      <div className="flex flex-wrap items-end gap-2">
        <NumberField
          label={c('rate')}
          value={rate}
          min={100}
          max={5000}
          step={100}
          onChange={setRate}
        />
        <Button onClick={() => advance(true)}>{c('tick')}</Button>
        <Button onClick={() => setRunning((v) => !v)}>
          {c(running ? 'pause' : 'play')}
        </Button>
        <Button variant="outline" onClick={reset}>
          {c('reset')}
        </Button>
      </div>
      <div className="overflow-auto rounded border p-3">
        <h2 className="font-semibold">{c('wave')}</h2>
        <svg
          width={Math.max(700, history.length * 14 + 140)}
          height={graph.nodes.length * 36 + 10}
          aria-label={c('wave')}
        >
          {graph.nodes.map((n, row) => (
            <g key={n.id} transform={`translate(0 ${row * 36})`}>
              <text x="0" y="23" className="fill-foreground text-xs">
                {n.label.slice(0, 12)}
              </text>
              {history.map((v, i) => {
                const bit = v[n.id];
                return (
                  <g key={i}>
                    <path
                      d={`M ${130 + i * 14} ${i ? (history[i - 1][n.id] === 1 ? 8 : 28) : bit === 1 ? 8 : 28} V ${bit === 1 ? 8 : 28} h 14`}
                      fill="none"
                      stroke="currentColor"
                      className={
                        bit === null ? 'text-amber-500' : 'text-emerald-500'
                      }
                    />
                    {bit === null && (
                      <text
                        x={132 + i * 14}
                        y="20"
                        className="fill-foreground text-[9px]"
                      >
                        X
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </OrganizerFrame>
  );
}
