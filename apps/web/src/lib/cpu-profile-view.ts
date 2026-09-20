import type { CpuNode } from './cpu-profile';

export type CpuFlameFrame = {
  nodeId: number;
  x: number;
  width: number;
  depth: number;
};

export function layoutCpuFlame(
  nodes: CpuNode[],
  rootId: number,
): { frames: CpuFlameFrame[]; clipped: boolean } {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const root = byId.get(rootId);
  if (!root || root.total <= 0) return { frames: [], clipped: false };
  const stack = [{ node: root, offset: 0, depth: 0 }];
  const frames: CpuFlameFrame[] = [];
  let clipped = false;
  while (stack.length) {
    const { node, offset, depth } = stack.pop()!;
    const width = (node.total / root.total) * 1000;
    // ponytail: bounded SVG DOM; zoom into a branch to inspect narrow/deep frames.
    if (depth >= 40 || frames.length >= 5000 || width < 0.75) {
      clipped = true;
      continue;
    }
    frames.push({
      nodeId: node.id,
      x: (offset / root.total) * 1000,
      width,
      depth,
    });
    let childOffset = offset;
    for (const id of node.children) {
      const child = byId.get(id)!;
      if (child.total > 0)
        stack.push({ node: child, offset: childOffset, depth: depth + 1 });
      childOffset += child.total;
    }
  }
  return { frames, clipped };
}
