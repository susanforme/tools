export type MeasurePoint = { x: number; y: number };
export const pointDistance = (a: MeasurePoint, b: MeasurePoint) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export function calibratedPoint(
  point: MeasurePoint,
  anchors: MeasurePoint[],
  range: [number, number, number, number],
  logX: boolean,
  logY: boolean,
): MeasurePoint {
  if (
    anchors.length !== 3 ||
    [...anchors, point].some(
      (p) => !Number.isFinite(p.x) || !Number.isFinite(p.y),
    ) ||
    range.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e12) ||
    range[0] === range[1] ||
    range[2] === range[3] ||
    (logX && (range[0] <= 0 || range[1] <= 0)) ||
    (logY && (range[2] <= 0 || range[3] <= 0))
  )
    throw new Error('calibrationInvalid');
  const [o, a, b] = anchors,
    ax = a.x - o.x,
    ay = a.y - o.y,
    bx = b.x - o.x,
    by = b.y - o.y,
    det = ax * by - ay * bx;
  if (Math.abs(det) < 1e-6) throw new Error('calibrationInvalid');
  const x = ((point.x - o.x) * by - (point.y - o.y) * bx) / det,
    y = (ax * (point.y - o.y) - ay * (point.x - o.x)) / det;
  const convert = (t: number, a: number, b: number, log: boolean) =>
    log
      ? 10 ** (Math.log10(a) + t * (Math.log10(b) - Math.log10(a)))
      : a + t * (b - a);
  const result = {
    x: convert(x, range[0], range[1], logX),
    y: convert(y, range[2], range[3], logY),
  };
  if (!Number.isFinite(result.x) || !Number.isFinite(result.y))
    throw new Error('calibrationInvalid');
  return result;
}
export function measurement(
  kind: string,
  points: MeasurePoint[],
  anchors: MeasurePoint[],
  known: number,
): number {
  if (
    anchors.length !== 2 ||
    !Number.isFinite(known) ||
    known <= 0 ||
    known > 1e9 ||
    pointDistance(anchors[0], anchors[1]) < 1 ||
    [...anchors, ...points].some(
      (p) => !Number.isFinite(p.x) || !Number.isFinite(p.y),
    )
  )
    throw new Error('calibrationInvalid');
  const scale = known / pointDistance(anchors[0], anchors[1]);
  if (kind === 'distance' && points.length === 2)
    return pointDistance(points[0], points[1]) * scale;
  if (kind === 'angle' && points.length === 3) {
    const [a, b, c] = points,
      u = pointDistance(a, b),
      v = pointDistance(c, b);
    if (u < 1e-9 || v < 1e-9) throw new Error('measurementInvalid');
    return (
      (Math.acos(
        Math.max(
          -1,
          Math.min(
            1,
            ((a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y)) / (u * v),
          ),
        ),
      ) *
        180) /
      Math.PI
    );
  }
  if (kind === 'area' && points.length >= 3) {
    // 拒绝自交多边形，避免鞋带公式把交叉区域抵消成错误面积。
    const cross = (a: MeasurePoint, b: MeasurePoint, c: MeasurePoint) =>
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    for (let i = 0; i < points.length; i++)
      for (let j = i + 2; j < points.length; j++) {
        if (i === 0 && j === points.length - 1) continue;
        const a = points[i],
          b = points[(i + 1) % points.length],
          c = points[j],
          d = points[(j + 1) % points.length];
        if (
          cross(a, b, c) * cross(a, b, d) <= 0 &&
          cross(c, d, a) * cross(c, d, b) <= 0 &&
          Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <=
            Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) &&
          Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <=
            Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y))
        )
          throw new Error('measurementInvalid');
      }
    const area =
      (Math.abs(
        points.reduce((s, p, i) => {
          const q = points[(i + 1) % points.length];
          return s + p.x * q.y - q.x * p.y;
        }, 0),
      ) /
        2) *
      scale ** 2;
    if (area <= 0) throw new Error('measurementInvalid');
    return area;
  }
  throw new Error('measurementInvalid');
}
