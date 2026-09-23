function positive(...values: number[]): void {
  if (values.some((n) => !Number.isFinite(n) || n <= 0 || n > 1e12))
    throw new Error('invalid');
}
export function electrical(mode: string, values: number[], network: string) {
  const [a, b, c] = values;
  if (!values.length || values.length > 100) throw new Error('invalid');
  if (mode === 'ohm' || mode === 'divider') {
    if (!Number.isFinite(a) || Math.abs(a) > 1e12) throw new Error('invalid');
    positive(...values.slice(1));
  } else positive(...values);
  if (mode === 'ohm') return { voltage: a, current: a / b, power: (a * a) / b };
  if (mode === 'network') {
    const resistance =
      network === 'parallel'
        ? 1 / values.reduce((s, n) => s + 1 / n, 0)
        : values.reduce((s, n) => s + n, 0);
    return { resistance };
  }
  if (mode === 'divider')
    return {
      voltage: (a * c) / (b + c),
      current: a / (b + c),
      power: (a * a) / (b + c),
    };
  if (mode === 'led') {
    if (a <= b) throw new Error('voltage');
    const current = c / 1000;
    return { resistance: (a - b) / current, power: (a - b) * current };
  }
  if (mode === 'rc')
    return { tau: (a * b) / 1e6, cutoff: 1 / ((2 * Math.PI * a * b) / 1e6) };
  throw new Error('invalid');
}
export type Ingredient = {
  name: string;
  grams: number;
  kind: 'flour' | 'water' | 'other';
};
export function recipeBatch(rows: Ingredient[], factor: number) {
  positive(factor);
  if (
    !rows.length ||
    rows.length > 100 ||
    rows.some(
      (r) =>
        !r.name.trim() ||
        !Number.isFinite(r.grams) ||
        r.grams < 0 ||
        r.grams > 1e9 ||
        !['flour', 'water', 'other'].includes(r.kind),
    )
  )
    throw new Error('invalid');
  const flour = rows
      .filter((r) => r.kind === 'flour')
      .reduce((s, r) => s + r.grams, 0),
    water = rows
      .filter((r) => r.kind === 'water')
      .reduce((s, r) => s + r.grams, 0);
  return {
    rows: rows.map((r) => ({
      ...r,
      scaled: r.grams * factor,
      percent: flour ? (r.grams / flour) * 100 : null,
    })),
    total: rows.reduce((s, r) => s + r.grams, 0) * factor,
    hydration: flour ? (water / flour) * 100 : null,
  };
}
export function moldVolume(
  shape: string,
  width: number,
  height: number,
  length: number,
): number {
  positive(width, height);
  if (shape === 'round') return Math.PI * (width / 2) ** 2 * height;
  positive(length);
  return width * length * height;
}
export type IntervalStage = { name: string; seconds: number };
export function intervalPosition(
  stages: IntervalStage[],
  rounds: number,
  elapsed: number,
) {
  if (
    !stages.length ||
    stages.length > 20 ||
    !Number.isInteger(rounds) ||
    rounds < 1 ||
    rounds > 100 ||
    !Number.isFinite(elapsed) ||
    elapsed < 0 ||
    stages.some(
      (s) =>
        !s.name.trim() ||
        !Number.isFinite(s.seconds) ||
        s.seconds < 1 ||
        s.seconds > 86400,
    )
  )
    throw new Error('invalid');
  const cycle = stages.reduce((s, p) => s + p.seconds, 0),
    total = cycle * rounds;
  if (elapsed >= total)
    return {
      done: true,
      round: rounds,
      index: stages.length - 1,
      remaining: 0,
      total,
    };
  const round = Math.floor(elapsed / cycle) + 1;
  let within = elapsed % cycle,
    index = 0;
  while (within >= stages[index].seconds) {
    within -= stages[index].seconds;
    index++;
  }
  return {
    done: false,
    round,
    index,
    remaining: stages[index].seconds - within,
    total,
  };
}
