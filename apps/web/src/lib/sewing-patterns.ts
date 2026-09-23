import type { PackagePlan } from './analysis-packaging';
type Point = [number, number];
export function sewingPattern(
  kind: string,
  waist: number,
  hip: number,
  length: number,
  width: number,
  bust: number,
  ease: number,
  seam: number,
  strap: number,
): PackagePlan {
  if (
    ![waist, hip, length, width, bust, ease, seam, strap].every(
      Number.isFinite,
    ) ||
    (kind !== 'bag' && (waist < 40 || waist > 180)) ||
    (kind === 'skirt' && (hip < waist || hip > 200 || ease < 0 || ease > 30)) ||
    (kind === 'apron' && (bust < 40 || bust > 200)) ||
    length < 20 ||
    length > 120 ||
    (kind !== 'skirt' &&
      (width < 15 || width > 100 || strap < 20 || strap > 150)) ||
    seam < 0.3 ||
    seam > 3 ||
    !['skirt', 'apron', 'bag'].includes(kind)
  )
    throw new Error('patternInvalid');
  const plan: PackagePlan = { width: 0, height: 0, lines: [], labels: [] };
  const s = seam * 10,
    margin = 10 + s;
  const line = (a: Point, b: Point, fold = false) =>
    plan.lines.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1], fold });
  // 顺时针轮廓逐边外移，布折边不加缝份。
  const piece = (
    points: Point[],
    x: number,
    y: number,
    name: string,
    foldEdge = -1,
  ) => {
    const edges = points.map((p, i) => {
      const q = points[(i + 1) % points.length],
        dx = q[0] - p[0],
        dy = q[1] - p[1],
        d = Math.hypot(dx, dy),
        offset = i === foldEdge ? 0 : s;
      return {
        p: [p[0] + (dy / d) * offset, p[1] - (dx / d) * offset] as Point,
        v: [dx, dy] as Point,
      };
    });
    const cut = edges.map((current, i): Point => {
      const prev = edges[(i + edges.length - 1) % edges.length],
        [a, b] = prev.v,
        [c, d] = current.v;
      const denominator = a * d - b * c;
      if (Math.abs(denominator) < 1e-9) return current.p;
      const t =
        ((current.p[0] - prev.p[0]) * d - (current.p[1] - prev.p[1]) * c) /
        denominator;
      return [prev.p[0] + t * a, prev.p[1] + t * b];
    });
    const at = (p: Point): Point => [p[0] + x, p[1] + y];
    points.forEach((p, i) =>
      line(at(p), at(points[(i + 1) % points.length]), true),
    );
    cut.forEach((p, i) => line(at(p), at(cut[(i + 1) % cut.length])));
    for (const p of cut) {
      plan.width = Math.max(plan.width, p[0] + x + 10);
      plan.height = Math.max(plan.height, p[1] + y + 10);
    }
    plan.labels.push({
      x: x + Math.max(...points.map((p) => p[0])) / 2,
      y: y + Math.max(...points.map((p) => p[1])) / 2,
      text: name,
    });
    if (foldEdge >= 0) plan.labels.push({ x: x + 12, y: y + 40, text: '||' });
    // 双向布纹线与对位记号。
    const grainX = x + Math.max(...points.map((p) => p[0])) * 0.55,
      grainY = y + 70;
    line([grainX, grainY], [grainX, grainY + 60], true);
    line([grainX - 3, grainY + 5], [grainX, grainY], true);
    line([grainX + 3, grainY + 5], [grainX, grainY], true);
  };
  const rect = (w: number, h: number): Point[] => [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  if (kind === 'skirt') {
    // ponytail: 松紧腰抽褶裙使用直线版；合体省道裙需独立量体和曲线制版。
    const w = ((hip + ease) * 1.5 * 10) / 4,
      h = length * 10 + 30;
    piece(rect(w, h), margin, margin, '1', 3);
    line([margin, margin + 30], [margin + w, margin + 30], true);
    plan.labels.push({
      x: margin + w / 2,
      y: margin + 20,
      text: `${waist} cm`,
    });
  } else if (kind === 'apron') {
    const w = (width * 10) / 2,
      top = Math.min((bust * 10) / 8, w * 0.7),
      h = length * 10,
      arm = Math.min(220, h * 0.35);
    piece(
      [
        [0, 0],
        [top, 0],
        [w, arm],
        [w, h],
        [0, h],
      ],
      margin,
      margin,
      '1',
      4,
    );
    line([margin + w - 5, margin + arm], [margin + w + 5, margin + arm]);
    const nextX = margin + w + s * 2 + 20;
    piece(rect(40, strap * 10), nextX, margin, '2');
    piece(
      rect(40, Math.max(waist * 5, 300)),
      nextX + 40 + s * 2 + 20,
      margin,
      '3',
    );
  } else {
    const w = width * 10,
      h = length * 10 + 30;
    piece(rect(w, h), margin, margin, '1');
    line([margin, margin + 15], [margin + w, margin + 15], true);
    line([margin, margin + 30], [margin + w, margin + 30], true);
    piece(rect(80, strap * 10), margin + w + s * 2 + 20, margin, '2');
    line(
      [margin + w + s * 2 + 60, margin],
      [margin + w + s * 2 + 60, margin + strap * 10],
      true,
    );
    for (const at of [w * 0.25, w * 0.75])
      line([margin + at, margin + 25], [margin + at, margin + 35]);
  }
  const y = plan.height + 5;
  line([10, y], [60, y]);
  line([10, y - 3], [10, y + 3]);
  line([60, y - 3], [60, y + 3]);
  plan.labels.push({ x: 35, y: y + 10, text: '50 mm' });
  plan.height += 30;
  if (Math.ceil(plan.width / 190) * Math.ceil(plan.height / 277) > 40)
    throw new Error('sizeLimit');
  return plan;
}
