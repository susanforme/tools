export type StatisticsRequest = {
  mode: string;
  text: string;
  mu: number;
  confidence: number;
};
export type StatisticsResult = {
  metrics: Record<string, number>;
  expected?: number[][];
  residuals?: Array<{ x: number; y: number; fitted: number; residual: number }>;
  smallExpected?: boolean;
};
export function numericRows(text: string): number[][] {
  if (!text.trim() || text.length > 100000) throw new Error('dataInvalid');
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      if (/[,;]\s*[,;]/.test(line) || /[,;]\s*$/.test(line))
        throw new Error('dataInvalid');
      return line
        .trim()
        .split(/[\s,;]+/)
        .map((token) => {
          if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(token))
            throw new Error('dataInvalid');
          const n = Number(token);
          if (!Number.isFinite(n) || Math.abs(n) > 1e9)
            throw new Error('dataInvalid');
          return n;
        });
    });
  if (rows.flat().length > 5000) throw new Error('dataInvalid');
  return rows;
}
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const variance = (a: number[]) => {
  const m = mean(a);
  return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1);
};
export async function statistics(
  request: StatisticsRequest,
): Promise<StatisticsResult> {
  const { mode, text, mu, confidence } = request;
  if (
    ![0.9, 0.95, 0.99].includes(confidence) ||
    !Number.isFinite(mu) ||
    Math.abs(mu) > 1e9
  )
    throw new Error('dataInvalid');
  const rows = numericRows(text),
    module = await import('jstat'),
    jStat = module.jStat ?? module.default;
  const tail = (t: number, df: number) =>
    Math.max(0, Math.min(1, 2 * jStat.studentt.cdf(-Math.abs(t), df)));
  if (['welch', 'paired', 'one'].includes(mode)) {
    if (
      rows.length !== (mode === 'one' ? 1 : 2) ||
      rows.some((r) => r.length < 2)
    )
      throw new Error('dataInvalid');
    let a = rows[0],
      b = rows[1];
    if (mode === 'paired') {
      if (a.length !== b.length) throw new Error('pairedLength');
      a = a.map((v, i) => v - b[i]);
    }
    const difference = mean(a) - (mode === 'welch' ? mean(b) : 0);
    const va = variance(a) / a.length,
      vb = mode === 'welch' ? variance(b) / b.length : 0;
    const se = Math.sqrt(va + vb);
    if (!(se > 0)) throw new Error('zeroVariance');
    const df =
      mode === 'welch'
        ? (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1))
        : a.length - 1;
    const t = (difference - (mode === 'welch' ? 0 : mu)) / se,
      margin = jStat.studentt.inv((1 + confidence) / 2, df) * se;
    return {
      metrics: {
        n: a.length,
        ...(mode === 'welch' ? { nB: b.length } : {}),
        difference,
        t,
        df,
        p: tail(t, df),
        ciLow: difference - margin,
        ciHigh: difference + margin,
      },
    };
  }
  if (mode === 'chi') {
    const r = rows.length,
      c = rows[0].length;
    if (
      r < 2 ||
      r > 20 ||
      c < 2 ||
      c > 20 ||
      rows.some(
        (row) =>
          row.length !== c || row.some((n) => n < 0 || !Number.isInteger(n)),
      )
    )
      throw new Error('dataInvalid');
    const sums = rows.map((row) => row.reduce((s, v) => s + v, 0)),
      cols = rows[0].map((_, i) => rows.reduce((s, row) => s + row[i], 0)),
      total = sums.reduce((s, v) => s + v, 0);
    if ([...sums, ...cols].some((n) => n === 0)) throw new Error('dataInvalid');
    const expected = rows.map((row, i) =>
      row.map((_, j) => (sums[i] * cols[j]) / total),
    );
    const chi = rows.reduce(
        (sum, row, i) =>
          sum +
          row.reduce(
            (s, v, j) => s + (v - expected[i][j]) ** 2 / expected[i][j],
            0,
          ),
        0,
      ),
      df = (r - 1) * (c - 1);
    return {
      metrics: {
        n: total,
        chi,
        df,
        p: Math.max(0, 1 - jStat.chisquare.cdf(chi, df)),
      },
      expected,
      smallExpected: expected.some((row) => row.some((v) => v < 5)),
    };
  }
  if (mode === 'anova') {
    if (rows.length < 2 || rows.length > 20 || rows.some((r) => r.length < 2))
      throw new Error('dataInvalid');
    const all = rows.flat(),
      grand = mean(all),
      between = rows.reduce((s, r) => s + r.length * (mean(r) - grand) ** 2, 0),
      within = rows.reduce((s, r) => s + (r.length - 1) * variance(r), 0),
      df1 = rows.length - 1,
      df2 = all.length - rows.length;
    if (!(within > 0)) throw new Error('zeroVariance');
    const f = between / df1 / (within / df2);
    return {
      metrics: {
        n: all.length,
        f,
        df1,
        df2,
        p: Math.max(0, 1 - jStat.centralF.cdf(f, df1, df2)),
        eta: between / (between + within),
      },
    };
  }
  if (mode === 'regression') {
    if (rows.length < 3 || rows.some((r) => r.length !== 2))
      throw new Error('dataInvalid');
    const xs = rows.map((r) => r[0]),
      ys = rows.map((r) => r[1]),
      mx = mean(xs),
      my = mean(ys),
      xx = xs.reduce((s, v) => s + (v - mx) ** 2, 0),
      yy = ys.reduce((s, v) => s + (v - my) ** 2, 0),
      xy = xs.reduce((s, v, i) => s + (v - mx) * (ys[i] - my), 0);
    if (!(xx > 0 && yy > 0)) throw new Error('zeroVariance');
    const slope = xy / xx,
      intercept = my - slope * mx,
      r = Math.max(-1, Math.min(1, xy / Math.sqrt(xx * yy))),
      r2 = r * r;
    const residuals = rows.map(([x, y]) => ({
      x,
      y,
      fitted: intercept + slope * x,
      residual: y - intercept - slope * x,
    }));
    const rmse = Math.sqrt(
      residuals.reduce((s, p) => s + p.residual ** 2, 0) / (rows.length - 2),
    );
    const margin =
      (jStat.studentt.inv((1 + confidence) / 2, rows.length - 2) * rmse) /
      Math.sqrt(xx);
    return {
      metrics: {
        n: rows.length,
        slope,
        intercept,
        r,
        r2,
        rmse,
        p:
          r2 >= 1
            ? 0
            : tail(
                r * Math.sqrt((rows.length - 2) / (1 - r2)),
                rows.length - 2,
              ),
        slopeLow: slope - margin,
        slopeHigh: slope + margin,
      },
      residuals,
    };
  }
  throw new Error('dataInvalid');
}
