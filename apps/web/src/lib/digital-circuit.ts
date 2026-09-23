export const GATE_KINDS = [
  'INPUT',
  'CLOCK',
  'NOT',
  'AND',
  'OR',
  'XOR',
  'NAND',
  'NOR',
  'XNOR',
  'DFF',
  'OUTPUT',
] as const;
export type GateKind = (typeof GATE_KINDS)[number];
export type Bit = 0 | 1 | null;
export type Gate = {
  id: string;
  kind: GateKind;
  label: string;
  x: number;
  y: number;
};
export type Circuit = {
  nodes: Gate[];
  wires: Array<{ from: string; to: string; port: number }>;
};
export type CircuitState = {
  inputs: Record<string, Bit>;
  registers: Record<string, Bit>;
  clocks: Record<string, Bit>;
  clock: 0 | 1;
};
export const gatePorts = (kind: GateKind) =>
  ['INPUT', 'CLOCK'].includes(kind)
    ? 0
    : ['NOT', 'OUTPUT'].includes(kind)
      ? 1
      : 2;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export function validCircuit(value: unknown): value is Circuit {
  if (
    !object(value) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.wires) ||
    value.nodes.length > 80 ||
    value.wires.length > 160
  )
    return false;
  if (
    !value.nodes.every(
      (n) =>
        object(n) &&
        typeof n.id === 'string' &&
        !['__proto__', 'constructor', 'prototype'].includes(n.id) &&
        /^[\w-]{1,80}$/.test(n.id) &&
        GATE_KINDS.includes(n.kind as GateKind) &&
        typeof n.label === 'string' &&
        n.label.length <= 40 &&
        typeof n.x === 'number' &&
        Number.isFinite(n.x) &&
        n.x >= 0 &&
        n.x <= 900 &&
        typeof n.y === 'number' &&
        Number.isFinite(n.y) &&
        n.y >= 0 &&
        n.y <= 540,
    )
  )
    return false;
  const nodes = value.nodes as Gate[],
    ids = new Map(nodes.map((n) => [n.id, n]));
  if (ids.size !== nodes.length) return false;
  if (
    !value.wires.every(
      (w) =>
        object(w) &&
        typeof w.from === 'string' &&
        typeof w.to === 'string' &&
        ids.has(w.from) &&
        ids.has(w.to) &&
        ids.get(w.from)!.kind !== 'OUTPUT' &&
        Number.isInteger(w.port) &&
        Number(w.port) >= 0 &&
        Number(w.port) < gatePorts(ids.get(w.to)!.kind) &&
        (ids.get(w.to)!.kind !== 'DFF' ||
          w.port !== 1 ||
          ['CLOCK', 'INPUT'].includes(ids.get(w.from)!.kind)),
    )
  )
    return false;
  return (
    new Set(value.wires.map((w) => `${w.to}:${w.port}`)).size ===
    value.wires.length
  );
}
const invert = (v: Bit): Bit => (v === null ? null : v === 0 ? 1 : 0);
export function gateValue(kind: GateKind, a: Bit, b: Bit): Bit {
  if (kind === 'NOT') return invert(a);
  if (kind === 'OUTPUT') return a;
  let v: Bit;
  if (kind === 'AND' || kind === 'NAND')
    v = a === 0 || b === 0 ? 0 : a === null || b === null ? null : 1;
  else if (kind === 'OR' || kind === 'NOR')
    v = a === 1 || b === 1 ? 1 : a === null || b === null ? null : 0;
  else v = a === null || b === null ? null : a === b ? 0 : 1;
  return ['NAND', 'NOR', 'XNOR'].includes(kind) ? invert(v) : v;
}
export const initialCircuitState = (): CircuitState => ({
  inputs: {},
  registers: {},
  clocks: {},
  clock: 0,
});
export function circuitStep(
  graph: Circuit,
  previous: CircuitState,
  tick: boolean,
): { state: CircuitState; values: Record<string, Bit> } {
  if (!validCircuit(graph)) throw new Error('circuitInvalid');
  const nodes = new Map(graph.nodes.map((n) => [n.id, n])),
    wires = new Map(graph.wires.map((w) => [`${w.to}:${w.port}`, w.from]));
  const state: CircuitState = {
    inputs: { ...previous.inputs },
    registers: { ...previous.registers },
    clocks: { ...previous.clocks },
    clock: tick ? (previous.clock === 0 ? 1 : 0) : previous.clock,
  };
  const evaluate = () => {
    const values: Record<string, Bit> = {},
      visiting = new Set<string>();
    const input = (id: string, port: number): Bit => {
      const source = wires.get(`${id}:${port}`);
      return source ? get(source) : null;
    };
    const get = (id: string): Bit => {
      if (Object.hasOwn(values, id)) return values[id];
      if (visiting.has(id)) throw new Error('circuitCycle');
      visiting.add(id);
      const n = nodes.get(id)!;
      const value =
        n.kind === 'INPUT'
          ? Object.hasOwn(state.inputs, id)
            ? state.inputs[id]
            : 0
          : n.kind === 'CLOCK'
            ? state.clock
            : n.kind === 'DFF'
              ? Object.hasOwn(state.registers, id)
                ? state.registers[id]
                : 0
              : gateValue(n.kind, input(id, 0), input(id, 1));
      visiting.delete(id);
      values[id] = value;
      return value;
    };
    graph.nodes.forEach((n) => get(n.id));
    return { values, input };
  };
  const before = evaluate(),
    updates: Record<string, Bit> = {};
  for (const n of graph.nodes.filter((n) => n.kind === 'DFF')) {
    const clk = before.input(n.id, 1),
      old = Object.hasOwn(previous.clocks, n.id) ? previous.clocks[n.id] : 0;
    if (old === 0 && clk === 1) updates[n.id] = before.input(n.id, 0);
    state.clocks[n.id] = clk;
  }
  Object.assign(state.registers, updates);
  return { state, values: evaluate().values };
}
export const EXAMPLE_CIRCUIT: Circuit = {
  nodes: [
    { id: 'input', kind: 'INPUT', label: 'D', x: 60, y: 90 },
    { id: 'clock', kind: 'CLOCK', label: 'CLK', x: 60, y: 240 },
    { id: 'register', kind: 'DFF', label: 'Q', x: 370, y: 160 },
    { id: 'output', kind: 'OUTPUT', label: 'OUT', x: 690, y: 160 },
  ],
  wires: [
    { from: 'input', to: 'register', port: 0 },
    { from: 'clock', to: 'register', port: 1 },
    { from: 'register', to: 'output', port: 0 },
  ],
};
