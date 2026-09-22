export type AxRow = {
  id: string;
  parent: string | null;
  children: string[];
  role: string;
  name: string;
  ignored: boolean;
  properties: string;
  description: string;
  depth: number;
};
export function parseAxTree(text: string): AxRow[] {
  if (text.length > 20 * 1024 * 1024) throw new Error('sizeLimit');
  const raw: unknown = JSON.parse(text);
  const data =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  const list: unknown = Array.isArray(raw)
    ? raw
    : (data?.nodes ??
      (data?.result as Record<string, unknown> | undefined)?.nodes);
  if (!Array.isArray(list) || !list.length || list.length > 50000)
    throw new Error('axFormat');
  const value = (rawValue: unknown): string => {
    if (!rawValue || typeof rawValue !== 'object') return '';
    const v = (rawValue as Record<string, unknown>).value;
    return v == null
      ? ''
      : typeof v === 'object'
        ? JSON.stringify(v)
        : String(v);
  };
  const rows = new Map<string, AxRow>();
  for (const item of list) {
    if (!item || typeof item !== 'object') throw new Error('axFormat');
    const node = item as Record<string, unknown>;
    if (
      typeof node.nodeId !== 'string' ||
      rows.has(node.nodeId) ||
      typeof node.ignored !== 'boolean' ||
      (node.childIds !== undefined &&
        (!Array.isArray(node.childIds) ||
          !node.childIds.every((id) => typeof id === 'string')))
    )
      throw new Error('axFormat');
    const props = [
      ...(Array.isArray(node.properties) ? node.properties : []),
      ...(Array.isArray(node.ignoredReasons) ? node.ignoredReasons : []),
    ];
    rows.set(node.nodeId, {
      id: node.nodeId,
      parent: typeof node.parentId === 'string' ? node.parentId : null,
      children: (node.childIds ?? []) as string[],
      role: value(node.role),
      name: value(node.name),
      ignored: node.ignored,
      description: value(node.description),
      properties: props
        .map(
          (p: Record<string, unknown>) =>
            `${String(p.name)}: ${value(p.value)}`,
        )
        .join('\n'),
      depth: 0,
    });
  }
  for (const node of rows.values())
    for (const childId of node.children) {
      const child = rows.get(childId);
      if (child) {
        if (child.parent !== null && child.parent !== node.id)
          throw new Error('axTree');
        child.parent = node.id;
      }
    }
  const result: AxRow[] = [],
    visited = new Set<string>();
  const stack = [...rows.values()]
    .filter((node) => !node.parent || !rows.has(node.parent))
    .reverse()
    .map((node) => ({ node, depth: 0 }));
  // parentId 可能存在但 childIds 缺失，统一反向建表。
  const children = new Map<string, AxRow[]>();
  for (const node of rows.values())
    if (node.parent)
      children.set(node.parent, [...(children.get(node.parent) ?? []), node]);
  while (stack.length) {
    const { node, depth } = stack.pop()!;
    if (visited.has(node.id) || depth > 256) throw new Error('axTree');
    visited.add(node.id);
    result.push({ ...node, depth });
    for (const child of [...(children.get(node.id) ?? [])].reverse())
      stack.push({ node: child, depth: depth + 1 });
  }
  if (visited.size !== rows.size) throw new Error('axTree');
  return result;
}
