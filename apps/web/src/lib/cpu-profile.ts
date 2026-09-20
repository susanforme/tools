export const CPU_PROFILE_MAX_BYTES = 20 * 1024 * 1024;

export type CpuFunction = {
  key: string;
  name: string;
  url: string;
  line: number;
  column: number;
  self: number;
  total: number;
  nodeIds: number[];
};
export type CpuNode = {
  id: number;
  functionIndex: number;
  parent: number | null;
  children: number[];
  self: number;
  total: number;
};
export type CpuProfile = {
  nodes: CpuNode[];
  functions: CpuFunction[];
  rootId: number;
  duration: number;
  sampled: number;
  uncovered: number;
  sampleCount: number;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalidFormat');
  return value as Record<string, unknown>;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function analyzeCpuProfile(text: string): CpuProfile {
  if (new TextEncoder().encode(text).byteLength > CPU_PROFILE_MAX_BYTES)
    throw new Error('sizeLimit');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('invalidJson');
  }
  const input = record(parsed);
  if (
    !Array.isArray(input.nodes) ||
    !Array.isArray(input.samples) ||
    !Array.isArray(input.timeDeltas)
  )
    throw new Error('invalidFormat');
  if (input.nodes.length === 0 || input.samples.length < 2)
    throw new Error('noSamples');
  if (input.nodes.length > 20_000 || input.samples.length > 1_000_000)
    throw new Error('countLimit');
  if (input.samples.length !== input.timeDeltas.length)
    throw new Error('invalidTiming');
  if (
    !finite(input.startTime) ||
    !finite(input.endTime) ||
    input.endTime <= input.startTime
  )
    throw new Error('invalidTiming');
  const duration = input.endTime - input.startTime;
  if (
    input.startTime < 0 ||
    !Number.isFinite(duration) ||
    duration > Number.MAX_SAFE_INTEGER
  )
    throw new Error('invalidTiming');
  const nodes: CpuNode[] = [];
  const functions: CpuFunction[] = [];
  const byId = new Map<number, CpuNode>();
  const functionIndices = new Map<string, number>();

  for (const raw of input.nodes) {
    const node = record(raw);
    const frame = record(node.callFrame);
    if (
      !Number.isSafeInteger(node.id) ||
      (node.id as number) < 0 ||
      byId.has(node.id as number)
    )
      throw new Error('invalidTree');
    if (
      typeof frame.functionName !== 'string' ||
      typeof frame.url !== 'string' ||
      typeof frame.scriptId !== 'string' ||
      !Number.isInteger(frame.lineNumber) ||
      !Number.isInteger(frame.columnNumber)
    )
      throw new Error('invalidFormat');
    if (
      node.children !== undefined &&
      (!Array.isArray(node.children) ||
        node.children.some((id: unknown) => !Number.isSafeInteger(id)))
    )
      throw new Error('invalidTree');
    const key = JSON.stringify([
      frame.scriptId,
      frame.functionName,
      frame.url,
      frame.lineNumber,
      frame.columnNumber,
    ]);
    let functionIndex = functionIndices.get(key);
    if (functionIndex === undefined) {
      functionIndex = functions.length;
      functionIndices.set(key, functionIndex);
      functions.push({
        key,
        name: frame.functionName || '(anonymous)',
        url: frame.url,
        line: (frame.lineNumber as number) + 1,
        column: (frame.columnNumber as number) + 1,
        self: 0,
        total: 0,
        nodeIds: [],
      });
    }
    const item: CpuNode = {
      id: node.id as number,
      functionIndex,
      parent: null,
      children: (node.children ?? []) as number[],
      self: 0,
      total: 0,
    };
    functions[functionIndex]!.nodeIds.push(item.id);
    nodes.push(item);
    byId.set(item.id, item);
  }
  for (const node of nodes) {
    for (const id of node.children) {
      const child = byId.get(id);
      if (!child || child.parent !== null || child === node)
        throw new Error('invalidTree');
      child.parent = node.id;
    }
  }
  const roots = nodes.filter((node) => node.parent === null);
  if (roots.length !== 1) throw new Error('invalidTree');
  const root = roots[0]!;
  const order: CpuNode[] = [];
  const pending = [{ node: root, depth: 0 }];
  const visited = new Set<number>();
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (visited.has(node.id)) throw new Error('invalidTree');
    if (depth > 256) throw new Error('depthLimit');
    visited.add(node.id);
    order.push(node);
    for (const id of node.children)
      pending.push({ node: byId.get(id)!, depth: depth + 1 });
  }
  if (visited.size !== nodes.length) throw new Error('invalidTree');

  let elapsed = 0;
  for (let index = 0; index < input.samples.length; index += 1) {
    const delta: unknown = input.timeDeltas[index];
    const id: unknown = input.samples[index];
    if (
      !finite(delta) ||
      delta < 0 ||
      !Number.isSafeInteger(id) ||
      !byId.has(id as number)
    )
      throw new Error('invalidTiming');
    elapsed += delta;
    if (!Number.isFinite(elapsed) || elapsed > duration + 0.000001)
      throw new Error('invalidTiming');
    // CDP 的 delta 是当前采样点到前一点的距离，应计入前一个样本。
    // 首样本前与末样本后的时间未被区间覆盖，不推断或分摊。
    if (index > 0) byId.get(input.samples[index - 1] as number)!.self += delta;
  }
  const sampled = elapsed - (input.timeDeltas[0] as number);
  if (sampled <= 0) throw new Error('noSamples');
  for (let index = order.length - 1; index >= 0; index -= 1) {
    const node = order[index]!;
    node.total += node.self;
    functions[node.functionIndex]!.self += node.self;
    if (node.parent !== null) byId.get(node.parent)!.total += node.total;
  }
  // 同一函数的递归节点只让最外层贡献 inclusive time，避免重复累计。
  const active = new Map<number, number>();
  const walk = [{ node: root, exit: false }];
  while (walk.length) {
    const { node, exit } = walk.pop()!;
    const count = active.get(node.functionIndex) ?? 0;
    if (exit) {
      active.set(node.functionIndex, count - 1);
      continue;
    }
    if (count === 0) functions[node.functionIndex]!.total += node.total;
    active.set(node.functionIndex, count + 1);
    walk.push({ node, exit: true });
    for (const id of node.children)
      walk.push({ node: byId.get(id)!, exit: false });
  }
  return {
    nodes,
    functions,
    rootId: root.id,
    duration,
    sampled,
    uncovered: Math.max(0, duration - sampled),
    sampleCount: input.samples.length,
  };
}
