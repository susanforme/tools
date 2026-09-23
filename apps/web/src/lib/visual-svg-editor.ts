export type SvgNode = {
  command: 'M' | 'L' | 'C' | 'Q' | 'Z';
  values: number[];
};
export type SvgObject = {
  id: string;
  name: string;
  kind: 'rect' | 'ellipse' | 'text' | 'path';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text: string;
  nodes: SvgNode[];
  group: string | null;
  hidden: boolean;
};
export type SvgScene = { width: number; height: number; objects: SvgObject[] };
export function validScene(value: unknown): value is SvgScene {
  if (!value || typeof value !== 'object') return false;
  const scene = value as SvgScene;
  if (
    !Number.isFinite(scene.width) ||
    !Number.isFinite(scene.height) ||
    scene.width < 10 ||
    scene.height < 10 ||
    scene.width > 4000 ||
    scene.height > 4000 ||
    !Array.isArray(scene.objects) ||
    scene.objects.length > 100
  )
    return false;
  const ids = new Set<string>();
  return scene.objects.every((o) => {
    if (!o || typeof o.id !== 'string' || ids.has(o.id)) return false;
    ids.add(o.id);
    return (
      typeof o.name === 'string' &&
      o.name.length <= 100 &&
      ['rect', 'ellipse', 'text', 'path'].includes(o.kind) &&
      [o.x, o.y, o.width, o.height, o.rotation, o.strokeWidth].every(
        Number.isFinite,
      ) &&
      Math.abs(o.x) <= 10000 &&
      Math.abs(o.y) <= 10000 &&
      o.width >= 1 &&
      o.height >= 1 &&
      o.width <= 4000 &&
      o.height <= 4000 &&
      Math.abs(o.rotation) <= 360 &&
      o.strokeWidth >= 0 &&
      o.strokeWidth <= 100 &&
      ['fill', 'stroke'].every((field) =>
        /^(none|#[\da-f]{6})$/i.test(o[field as 'fill' | 'stroke']),
      ) &&
      typeof o.text === 'string' &&
      o.text.length <= 500 &&
      (o.group === null || typeof o.group === 'string') &&
      typeof o.hidden === 'boolean' &&
      Array.isArray(o.nodes) &&
      o.nodes.length <= 100 &&
      o.nodes.every(
        (node, i) =>
          !!node &&
          ['M', 'L', 'C', 'Q', 'Z'].includes(node.command) &&
          Array.isArray(node.values) &&
          node.values.length ===
            { M: 2, L: 2, C: 6, Q: 4, Z: 0 }[node.command] &&
          node.values.every((n) => Number.isFinite(n) && n >= 0 && n <= 100) &&
          (i !== 0 || node.command === 'M'),
      ) &&
      (o.kind !== 'path' || o.nodes.length >= 2)
    );
  });
}
export function objectBounds(o: SvgObject) {
  const a = (o.rotation * Math.PI) / 180,
    cx = o.x + o.width / 2,
    cy = o.y + o.height / 2;
  const corners = [
    [-o.width / 2, -o.height / 2],
    [o.width / 2, -o.height / 2],
    [o.width / 2, o.height / 2],
    [-o.width / 2, o.height / 2],
  ].map(([x, y]) => ({
    x: cx + x * Math.cos(a) - y * Math.sin(a),
    y: cy + x * Math.sin(a) + y * Math.cos(a),
  }));
  const x = Math.min(...corners.map((p) => p.x)),
    y = Math.min(...corners.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...corners.map((p) => p.x)) - x,
    height: Math.max(...corners.map((p) => p.y)) - y,
  };
}
export function selectedObjects(
  objects: SvgObject[],
  ids: string[],
): SvgObject[] {
  const groups = new Set(
    objects.filter((o) => ids.includes(o.id) && o.group).map((o) => o.group),
  );
  return objects.filter(
    (o) => ids.includes(o.id) || (o.group && groups.has(o.group)),
  );
}
export function arrangeObjects(
  objects: SvgObject[],
  ids: string[],
  action: string,
): SvgObject[] {
  const selected = selectedObjects(objects, ids);
  const units = new Map<string, SvgObject[]>();
  selected.forEach((o) => {
    const key = o.group ?? o.id;
    units.set(key, [...(units.get(key) ?? []), o]);
  });
  const bounds = Array.from(units.entries(), ([key, items]) => {
    const boxes = items.map(objectBounds),
      x = Math.min(...boxes.map((b) => b.x)),
      y = Math.min(...boxes.map((b) => b.y));
    return {
      key,
      items,
      x,
      y,
      width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
      height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
    };
  });
  if (bounds.length < 2) throw new Error('selection');
  const horizontal = ['left', 'center', 'right', 'distributeX'].includes(
      action,
    ),
    axis = horizontal ? 'x' : 'y',
    extent = horizontal ? 'width' : 'height';
  const min = Math.min(...bounds.map((b) => b[axis])),
    max = Math.max(...bounds.map((b) => b[axis] + b[extent]));
  const shifts = new Map<string, number>();
  if (action.startsWith('distribute')) {
    if (bounds.length < 3) throw new Error('selection');
    bounds.sort((a, b) => a[axis] - b[axis]);
    const gap =
      (max - min - bounds.reduce((sum, b) => sum + b[extent], 0)) /
      (bounds.length - 1);
    let position = min;
    for (const b of bounds) {
      shifts.set(b.key, position - b[axis]);
      position += b[extent] + gap;
    }
  } else
    for (const b of bounds) {
      const target = ['left', 'top'].includes(action)
        ? min
        : ['right', 'bottom'].includes(action)
          ? max - b[extent]
          : (min + max - b[extent]) / 2;
      shifts.set(b.key, target - b[axis]);
    }
  return objects.map((o) => {
    const delta = shifts.get(o.group ?? o.id);
    return delta === undefined ? o : { ...o, [axis]: o[axis] + delta };
  });
}
export function svgPath(nodes: SvgNode[]): string {
  return nodes.map((node) => node.command + node.values.join(' ')).join(' ');
}
export function objectTransform(o: SvgObject): string {
  return `translate(${o.x} ${o.y}) rotate(${o.rotation} ${o.width / 2} ${o.height / 2}) scale(${o.width / 100} ${o.height / 100})`;
}
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  );
export function sceneSvg(scene: SvgScene): string {
  if (!validScene(scene)) throw new Error('svg');
  const emit = (o: SvgObject) =>
    `<g transform="${objectTransform(o)}" fill="${o.fill}" stroke="${o.stroke}" stroke-width="${o.strokeWidth}" vector-effect="non-scaling-stroke"><title>${escape(o.name)}</title>${o.kind === 'rect' ? '<rect width="100" height="100" vector-effect="non-scaling-stroke"/>' : o.kind === 'ellipse' ? '<ellipse cx="50" cy="50" rx="50" ry="50" vector-effect="non-scaling-stroke"/>' : o.kind === 'text' ? `<text x="0" y="75" font-family="sans-serif" font-size="75" textLength="100" lengthAdjust="spacingAndGlyphs" vector-effect="non-scaling-stroke">${escape(o.text)}</text>` : `<path d="${svgPath(o.nodes)}" vector-effect="non-scaling-stroke"/>`}</g>`;
  const emitted = new Set<string>();
  const content = scene.objects
    .filter((o) => !o.hidden)
    .map((o) => {
      if (!o.group) return emit(o);
      if (emitted.has(o.group)) return '';
      emitted.add(o.group);
      return `<g id="group-${escape(o.group)}">${scene.objects
        .filter((item) => item.group === o.group && !item.hidden)
        .map(emit)
        .join('')}</g>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">${content}</svg>`;
}
export function newSvgObject(kind: SvgObject['kind'], id: string): SvgObject {
  return {
    id,
    name: kind,
    kind,
    x: 40,
    y: 40,
    width: 160,
    height: 100,
    rotation: 0,
    fill: '#2563eb',
    stroke: '#111827',
    strokeWidth: 1,
    text: 'Text',
    nodes:
      kind === 'path'
        ? [
            { command: 'M', values: [10, 80] },
            { command: 'C', values: [20, 10, 80, 10, 90, 80] },
            { command: 'L', values: [10, 80] },
            { command: 'Z', values: [] },
          ]
        : [],
    group: null,
    hidden: false,
  };
}
