import { reportObject, reportText } from './observability-report';
import {
  nonnegativeInteger,
  performanceJson,
  requiredArray,
} from './performance-reports';
export type HeapNode = {
  id: number;
  name: string;
  type: string;
  size: number;
  group: string;
};
export type HeapGroup = {
  key: string;
  name: string;
  type: string;
  count: number;
  size: number;
};
export type HeapReport = {
  nodes: HeapNode[];
  groups: HeapGroup[];
  totalSize: number;
  edgeCount: number;
  strings: string[];
  edgeTypes: string[];
  edges: Uint32Array;
  outgoing: Uint32Array;
  incoming: Uint32Array;
  incomingEdges: Uint32Array;
};
export function parseHeapSnapshot(source: string): HeapReport {
  const root = reportObject(performanceJson(source));
  const snapshot = reportObject(root.snapshot);
  const meta = reportObject(snapshot.meta);
  const fields = requiredArray(meta.node_fields).map((value) =>
    reportText(value),
  );
  const edgeFields = requiredArray(meta.edge_fields).map((value) =>
    reportText(value),
  );
  const nodes = requiredArray(root.nodes);
  const edges = requiredArray(root.edges);
  const strings = requiredArray(root.strings).map((value) => reportText(value));
  const f = (name: string) => {
    const index = fields.indexOf(name);
    if (index < 0) throw new Error('invalidFormat');
    return index;
  };
  const e = (name: string) => {
    const index = edgeFields.indexOf(name);
    if (index < 0) throw new Error('invalidFormat');
    return index;
  };
  const typeIndex = f('type'),
    nameIndex = f('name'),
    idIndex = f('id'),
    sizeIndex = f('self_size'),
    countIndex = f('edge_count');
  const edgeTypeIndex = e('type'),
    edgeNameIndex = e('name_or_index'),
    targetIndex = e('to_node');
  const types = requiredArray(requiredArray(meta.node_types)[typeIndex]).map(
    (value) => reportText(value),
  );
  const edgeTypes = requiredArray(
    requiredArray(meta.edge_types)[edgeTypeIndex],
  ).map((value) => reportText(value));
  if (
    !fields.length ||
    !edgeFields.length ||
    nodes.length % fields.length ||
    edges.length % edgeFields.length
  )
    throw new Error('invalidFormat');
  const count = nodes.length / fields.length;
  const edgeCount = edges.length / edgeFields.length;
  if (
    !count ||
    count > 250_000 ||
    edgeCount > 1_000_000 ||
    strings.length > 1_000_000
  )
    throw new Error('limit');
  if (
    (snapshot.node_count !== undefined && snapshot.node_count !== count) ||
    (snapshot.edge_count !== undefined && snapshot.edge_count !== edgeCount)
  )
    throw new Error('invalidFormat');
  const result: HeapReport = {
    nodes: [],
    groups: [],
    totalSize: 0,
    edgeCount,
    strings,
    edgeTypes,
    edges: new Uint32Array(edgeCount * 4),
    outgoing: new Uint32Array(count + 1),
    incoming: new Uint32Array(count + 1),
    incomingEdges: new Uint32Array(edgeCount),
  };
  const groups = new Map<string, HeapGroup>();
  const ids = new Set<number>();
  let edgeOffset = 0;
  for (let index = 0; index < count; index++) {
    const offset = index * fields.length;
    const type = types[nonnegativeInteger(nodes[offset + typeIndex])];
    const name = strings[nonnegativeInteger(nodes[offset + nameIndex])];
    if (type === undefined || name === undefined)
      throw new Error('invalidFormat');
    const id = nonnegativeInteger(nodes[offset + idIndex]);
    if (ids.has(id)) throw new Error('invalidFormat');
    ids.add(id);
    const size = nonnegativeInteger(nodes[offset + sizeIndex]);
    const outgoingCount = nonnegativeInteger(nodes[offset + countIndex]);
    const groupName = ['object', 'closure', 'native'].includes(type)
      ? name
      : `(${type})`;
    const group = JSON.stringify([type, groupName]);
    result.nodes.push({ id, name, type, size, group });
    result.totalSize += size;
    if (!Number.isSafeInteger(result.totalSize))
      throw new Error('invalidFormat');
    const summary = groups.get(group) ?? {
      key: group,
      name: groupName,
      type,
      count: 0,
      size: 0,
    };
    summary.count++;
    summary.size += size;
    groups.set(group, summary);
    result.outgoing[index] = edgeOffset;
    if (edgeOffset + outgoingCount > edgeCount)
      throw new Error('invalidFormat');
    for (let j = 0; j < outgoingCount; j++, edgeOffset++) {
      const start = edgeOffset * edgeFields.length;
      const edgeType = nonnegativeInteger(edges[start + edgeTypeIndex]);
      const edgeName = nonnegativeInteger(edges[start + edgeNameIndex]);
      const target = nonnegativeInteger(edges[start + targetIndex]);
      if (
        !edgeTypes[edgeType] ||
        target % fields.length ||
        target / fields.length >= count ||
        (!['element', 'hidden'].includes(edgeTypes[edgeType]) &&
          strings[edgeName] === undefined)
      )
        throw new Error('invalidFormat');
      result.edges.set(
        [index, target / fields.length, edgeType, edgeName],
        edgeOffset * 4,
      );
      result.incoming[target / fields.length + 1]++;
    }
  }
  if (edgeOffset !== edgeCount) throw new Error('invalidFormat');
  result.outgoing[count] = edgeCount;
  for (let i = 1; i <= count; i++) result.incoming[i] += result.incoming[i - 1];
  const cursor = result.incoming.slice();
  for (let i = 0; i < edgeCount; i++)
    result.incomingEdges[cursor[result.edges[i * 4 + 1]]++] = i;
  result.groups = [...groups.values()].sort((a, b) => b.size - a.size);
  return result;
}
export function heapReferences(
  report: HeapReport,
  index: number,
  direction: 'outgoing' | 'incoming',
  page: number,
) {
  if (!report.nodes[index]) return { total: 0, rows: [] };
  const offsets = report[direction];
  const start = offsets[index],
    end = offsets[index + 1];
  const rows = [];
  for (
    let i = start + page * 100;
    i < Math.min(end, start + (page + 1) * 100);
    i++
  ) {
    const edge = direction === 'incoming' ? report.incomingEdges[i] : i;
    const offset = edge * 4;
    const type = report.edgeTypes[report.edges[offset + 2]];
    rows.push({
      node: report.edges[offset + (direction === 'incoming' ? 0 : 1)],
      type,
      name: ['element', 'hidden'].includes(type)
        ? String(report.edges[offset + 3])
        : report.strings[report.edges[offset + 3]],
    });
  }
  return { total: end - start, rows };
}
export function compareHeapGroups(
  before: HeapReport | null,
  after: HeapReport | null,
) {
  const left = new Map(before?.groups.map((group) => [group.key, group]) ?? []);
  const right = new Map(after?.groups.map((group) => [group.key, group]) ?? []);
  return [...new Set([...left.keys(), ...right.keys()])]
    .map((key) => {
      const a = left.get(key),
        b = right.get(key);
      return {
        key,
        name: (b ?? a)!.name,
        type: (b ?? a)!.type,
        beforeCount: a?.count ?? 0,
        afterCount: b?.count ?? 0,
        beforeSize: a?.size ?? 0,
        afterSize: b?.size ?? 0,
        deltaCount: (b?.count ?? 0) - (a?.count ?? 0),
        deltaSize: (b?.size ?? 0) - (a?.size ?? 0),
      };
    })
    .sort((a, b) =>
      after && before
        ? b.deltaSize - a.deltaSize
        : (b.afterSize || b.beforeSize) - (a.afterSize || a.beforeSize),
    );
}
