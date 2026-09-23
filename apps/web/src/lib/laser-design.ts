import type { PackagePlan } from './analysis-packaging';
export type LaserPoint = { x: number; y: number };
export type LaserShape = { points: LaserPoint[]; hole: boolean };
export type LaserPart = { name: string; shapes: LaserShape[] };
export type LaserOptions = {
  kind: string;
  width: number;
  depth: number;
  height: number;
  thickness: number;
  kerf: number;
  clearance: number;
  rows: number;
  columns: number;
};
export type LaserPlan = PackagePlan & { parts: LaserPart[] };
const rect = (x: number, y: number, w: number, h: number): LaserPoint[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];
export function offsetOrthogonal(
  points: LaserPoint[],
  distance: number,
): LaserPoint[] {
  if (points.length < 4 || points.length > 500 || !Number.isFinite(distance))
    throw new Error('invalid');
  return points.map((point, i) => {
    const previous = points[(i + points.length - 1) % points.length],
      next = points[(i + 1) % points.length];
    const dx1 = point.x - previous.x,
      dy1 = point.y - previous.y,
      dx2 = next.x - point.x,
      dy2 = next.y - point.y;
    if (
      (dx1 !== 0 && dy1 !== 0) ||
      (dx2 !== 0 && dy2 !== 0) ||
      Math.hypot(dx1, dy1) === 0 ||
      Math.hypot(dx2, dy2) === 0
    )
      throw new Error('invalid');
    return {
      x: point.x + distance * (Math.sign(dy1) + Math.sign(dy2)),
      y: point.y - distance * (Math.sign(dx1) + Math.sign(dx2)),
    };
  });
}
function tabs(length: number, t: number) {
  const width = Math.min(12, (length - 4 * t) / 5);
  if (width <= t) throw new Error('dimensions');
  return [0.25, 0.75].map((p) => ({ start: length * p - width / 2, width }));
}
function wall(width: number, height: number, t: number): LaserPoint[] {
  const points = rect(0, 0, width, height).slice(0, 3);
  for (const tab of tabs(width, t).reverse()) {
    points.push(
      { x: tab.start + tab.width, y: height },
      { x: tab.start + tab.width, y: height + t },
      { x: tab.start, y: height + t },
      { x: tab.start, y: height },
    );
  }
  points.push({ x: 0, y: height });
  return points;
}
function divider(
  width: number,
  height: number,
  positions: number[],
  slot: number,
  fromTop: boolean,
): LaserPoint[] {
  let points: LaserPoint[] = [{ x: 0, y: 0 }];
  for (const x of positions) {
    points.push(
      { x: x - slot / 2, y: 0 },
      { x: x - slot / 2, y: height / 2 },
      { x: x + slot / 2, y: height / 2 },
      { x: x + slot / 2, y: 0 },
    );
  }
  points.push({ x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height });
  if (!fromTop)
    points = points.map((p) => ({ x: width - p.x, y: height - p.y }));
  return points;
}
export function laserPlan(options: LaserOptions): LaserPlan {
  const {
    kind,
    width: w,
    depth: d,
    height: h,
    thickness: t,
    kerf: k,
    clearance,
    rows,
    columns,
  } = options;
  if (
    !['box', 'dividers', 'card'].includes(kind) ||
    ![w, d, h, t, k, clearance, rows, columns].every(Number.isFinite) ||
    (kind !== 'card' &&
      (w < 30 ||
        w > 600 ||
        d < 30 ||
        d > 600 ||
        h < 10 ||
        h > 400 ||
        Math.min(w, d) < 8 * t)) ||
    t < 1 ||
    t > 15 ||
    k < 0 ||
    k > 1 ||
    k >= t ||
    clearance < -0.5 ||
    clearance > 2 ||
    !Number.isInteger(rows) ||
    !Number.isInteger(columns) ||
    rows < 1 ||
    rows > 8 ||
    columns < 1 ||
    columns > 8
  )
    throw new Error('dimensions');
  const slot = t + clearance;
  if (slot <= k + 0.1) throw new Error('dimensions');
  const parts: LaserPart[] = [];
  if (kind === 'box') {
    const base: LaserPart = {
      name: 'BASE',
      shapes: [{ points: rect(0, 0, w + 4 * t, d + 4 * t), hole: false }],
    };
    for (const tab of tabs(w, t))
      for (const y of [t, d + 2 * t])
        base.shapes.push({
          points: rect(
            2 * t + tab.start - clearance / 2,
            y - clearance / 2,
            tab.width + clearance,
            slot,
          ),
          hole: true,
        });
    for (const tab of tabs(d + 2 * t, t))
      for (const x of [t, w + 2 * t])
        base.shapes.push({
          points: rect(
            x - clearance / 2,
            t + tab.start - clearance / 2,
            slot,
            tab.width + clearance,
          ),
          hole: true,
        });
    parts.push(base);
    for (const name of ['FRONT', 'BACK'])
      parts.push({ name, shapes: [{ points: wall(w, h, t), hole: false }] });
    for (const name of ['LEFT', 'RIGHT'])
      parts.push({
        name,
        shapes: [{ points: wall(d + 2 * t, h, t), hole: false }],
      });
  } else if (kind === 'dividers') {
    const xp = Array.from(
        { length: columns },
        (_, i) => ((i + 1) * w) / (columns + 1),
      ),
      yp = Array.from({ length: rows }, (_, i) => ((i + 1) * d) / (rows + 1));
    if (Math.min(w / (columns + 1), d / (rows + 1)) < slot * 2)
      throw new Error('dimensions');
    for (let i = 0; i < rows; i++)
      parts.push({
        name: `X${i + 1}`,
        shapes: [{ points: divider(w, h, xp, slot, true), hole: false }],
      });
    for (let i = 0; i < columns; i++)
      parts.push({
        name: `Y${i + 1}`,
        shapes: [{ points: divider(d, h, yp, slot, false), hole: false }],
      });
  } else {
    const pitch = Math.max(12, t + clearance + 2);
    const positions = Array.from({ length: 9 }, (_, i) => 10 + i * pitch);
    const points: LaserPoint[] = [{ x: 0, y: 0 }];
    for (let i = 0; i < positions.length; i++) {
      const fit = t + clearance + (i - 4) * 0.1;
      if (fit <= k + 0.1 || fit >= pitch - 1) throw new Error('dimensions');
      const x = positions[i];
      points.push(
        { x: x - fit / 2, y: 0 },
        { x: x - fit / 2, y: 20 },
        { x: x + fit / 2, y: 20 },
        { x: x + fit / 2, y: 0 },
      );
    }
    points.push(
      { x: 20 + 8 * pitch, y: 0 },
      { x: 20 + 8 * pitch, y: 40 },
      { x: 0, y: 40 },
    );
    parts.push({ name: 'FIT TEST', shapes: [{ points, hole: false }] });
  }
  const plan: LaserPlan = {
    width: 0,
    height: 0,
    parts: [],
    lines: [],
    labels: [],
  };
  let x = 5,
    y = 5,
    rowHeight = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i],
      points = part.shapes.flatMap((s) => s.points);
    const width = Math.max(...points.map((p) => p.x)),
      height = Math.max(...points.map((p) => p.y));
    if (i && i % 2 === 0) {
      x = 5;
      y += rowHeight + 15;
      rowHeight = 0;
    }
    const shifted: LaserPart = {
      name: part.name,
      shapes: part.shapes.map((shape) => ({
        hole: shape.hole,
        points: offsetOrthogonal(
          shape.points,
          ((shape.hole ? -1 : 1) * k) / 2,
        ).map((p) => ({ x: p.x + x, y: p.y + y })),
      })),
    };
    plan.parts.push(shifted);
    for (const shape of shifted.shapes)
      shape.points.forEach((p, j) => {
        const next = shape.points[(j + 1) % shape.points.length];
        plan.lines.push({
          x1: p.x,
          y1: p.y,
          x2: next.x,
          y2: next.y,
          fold: false,
        });
      });
    plan.labels.push({ x: x + width / 2, y: y + height + 5, text: part.name });
    if (kind === 'card')
      for (let n = 0; n < 9; n++)
        plan.labels.push({
          x: x + 10 + n * Math.max(12, t + clearance + 2),
          y: y + 29,
          text: (t + clearance + (n - 4) * 0.1).toFixed(2),
        });
    x += width + 15;
    rowHeight = Math.max(rowHeight, height);
    plan.width = Math.max(plan.width, x);
    plan.height = Math.max(plan.height, y + height + 12);
  }
  return plan;
}
export function laserSvg(plan: LaserPlan): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${plan.width}mm" height="${plan.height}mm" viewBox="0 0 ${plan.width} ${plan.height}"><g id="CUT" fill="none" stroke="#dc2626" stroke-width="0.1">${plan.parts.flatMap((part) => part.shapes.map((shape) => `<polygon points="${shape.points.map((p) => `${p.x},${p.y}`).join(' ')}"/>`)).join('')}</g><g id="ENGRAVE" fill="#2563eb" font-size="3" text-anchor="middle">${plan.labels.map((label) => `<text x="${label.x}" y="${label.y}">${label.text}</text>`).join('')}</g></svg>`;
}
export function laserDxf(plan: LaserPlan): string {
  const lines = [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$ACADVER',
    '1',
    'AC1015',
    '9',
    '$INSUNITS',
    '70',
    '4',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
  ];
  for (const part of plan.parts)
    for (const shape of part.shapes) {
      lines.push(
        '0',
        'LWPOLYLINE',
        '100',
        'AcDbEntity',
        '8',
        'CUT',
        '100',
        'AcDbPolyline',
        '90',
        String(shape.points.length),
        '70',
        '1',
      );
      for (const p of shape.points)
        lines.push('10', p.x.toFixed(4), '20', (plan.height - p.y).toFixed(4));
    }
  for (const label of plan.labels)
    lines.push(
      '0',
      'TEXT',
      '100',
      'AcDbEntity',
      '8',
      'ENGRAVE',
      '100',
      'AcDbText',
      '10',
      label.x.toFixed(4),
      '20',
      (plan.height - label.y).toFixed(4),
      '40',
      '3',
      '1',
      label.text,
    );
  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\r\n');
}
