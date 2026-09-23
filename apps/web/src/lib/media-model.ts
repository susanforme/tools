export type ModelMeasurement = {
  dimensions: [number, number, number];
  area: number;
  volume: number | null;
  closed: boolean;
};
export function measureTriangles(triangles: number[]): ModelMeasurement {
  if (
    !triangles.length ||
    triangles.length % 9 ||
    triangles.length > 2_700_000 ||
    !triangles.every(Number.isFinite)
  )
    throw new Error('invalid');
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < triangles.length; i++) {
    const axis = i % 3;
    min[axis] = Math.min(min[axis], triangles[i]);
    max[axis] = Math.max(max[axis], triangles[i]);
  }
  const count = triangles.length / 9,
    parents = Array.from({ length: count }, (_, i) => i),
    volumes: number[] = [],
    edges = new Map<
      string,
      { count: number; direction: number; triangle: number }
    >();
  const root = (i: number): number => {
    while (parents[i] !== i) {
      parents[i] = parents[parents[i]];
      i = parents[i];
    }
    return i;
  };
  let area = 0,
    degenerate = false;
  for (let i = 0; i < count; i++) {
    const points = [0, 3, 6].map((offset) =>
      triangles.slice(i * 9 + offset, i * 9 + offset + 3),
    );
    const [a, b, c] = points.map((p) => p.map((v, j) => v - min[j])),
      ab = b.map((v, j) => v - a[j]),
      ac = c.map((v, j) => v - a[j]);
    const cross = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const triangleArea = Math.hypot(...cross) / 2;
    area += triangleArea;
    if (triangleArea === 0) degenerate = true;
    volumes.push(
      (a[0] * (b[1] * c[2] - b[2] * c[1]) +
        a[1] * (b[2] * c[0] - b[0] * c[2]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) /
        6,
    );
    const vertices = points.map((p) => p.join(','));
    for (let j = 0; j < 3; j++) {
      const from = vertices[j],
        to = vertices[(j + 1) % 3],
        direction = from < to ? 1 : -1,
        key = from < to ? `${from}|${to}` : `${to}|${from}`,
        existing = edges.get(key);
      if (existing) {
        existing.count++;
        existing.direction += direction;
        parents[root(i)] = root(existing.triangle);
      } else edges.set(key, { count: 1, direction, triangle: i });
    }
  }
  const closed =
      !degenerate &&
      [...edges.values()].every((e) => e.count === 2 && e.direction === 0),
    components = new Map<number, number>();
  for (let i = 0; i < count; i++) {
    const component = root(i);
    components.set(component, (components.get(component) ?? 0) + volumes[i]);
  }
  return {
    dimensions: max.map((v, j) => v - min[j]) as [number, number, number],
    area,
    closed,
    volume: closed
      ? [...components.values()].reduce((sum, v) => sum + Math.abs(v), 0)
      : null,
  };
}
