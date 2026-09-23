import type { MathToolId } from './math-tool-catalog';

export interface MathResult {
  key: string;
  value: string | number;
}
export type MathInput = Record<string, string>;

function requireValue(condition: boolean, error = 'domain'): asserts condition {
  if (!condition) throw new Error(error);
}

function numeric(value: string): number {
  requireValue(
    /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()),
    'number',
  );
  const result = Number(value);
  requireValue(Number.isFinite(result) && Math.abs(result) <= 1e100, 'range');
  requireValue(result !== 0 || !/[1-9]/.test(value.split(/e/i)[0]), 'range');
  return result;
}

function integer(value: string, min: number, max: number): number {
  const result = numeric(value);
  requireValue(
    Number.isSafeInteger(result) && result >= min && result <= max,
    'integer',
  );
  return result;
}

function bigInteger(value: string): bigint {
  requireValue(/^[+-]?\d{1,100}$/.test(value.trim()), 'bigInteger');
  return BigInt(value.trim());
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

function fraction(source: string): [bigint, bigint] {
  const parts = source.trim().split('/');
  requireValue(parts.length <= 2, 'fraction');
  const a = bigInteger(parts[0]);
  const b = parts.length === 1 ? 1n : bigInteger(parts[1]);
  requireValue(b !== 0n, 'zero');
  return [a, b];
}

function tokens(source: string, max: number): string[] {
  const values = source.trim().split(/[\s,，]+/);
  requireValue(source.trim().length > 0 && values.length <= max, 'size');
  return values;
}

function matrix(source: string, maxColumns = 8): number[][] {
  const rows = source
    .trim()
    .split(/\r?\n/)
    .map((line) => tokens(line, maxColumns).map(numeric));
  requireValue(
    rows.length <= 8 && rows.every((row) => row.length === rows[0].length),
    'matrix',
  );
  return rows;
}

// 复用消元过程求解方程、逆矩阵与行列式；缩放行以降低量纲差异。
function eliminate(
  a: number[][],
  b: number[][],
  determinantOnly = false,
): { solution: number[][]; determinant: number } {
  const n = a.length;
  requireValue(
    a.every((row) => row.length === n),
    'square',
  );
  const scales = a.map((row) => Math.max(...row.map(Math.abs)));
  const rows = a.map((row, i) =>
    [...row, ...b[i]].map((v) => v / (scales[i] || 1)),
  );
  let determinant = 1;
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column]))
        pivot = row;
    }
    if (determinantOnly && rows[pivot][column] === 0)
      return { solution: [], determinant: 0 };
    requireValue(Math.abs(rows[pivot][column]) > 1e-12, 'singular');
    if (pivot !== column) {
      [rows[pivot], rows[column]] = [rows[column], rows[pivot]];
      determinant *= -1;
    }
    const divisor = rows[column][column];
    determinant *= divisor;
    rows[column] = rows[column].map((v) => v / divisor);
    for (let row = 0; row < n; row++) {
      if (row === column) continue;
      const factor = rows[row][column];
      rows[row] = rows[row].map((v, j) => v - factor * rows[column][j]);
    }
  }
  determinant *= scales.reduce((product, scale) => product * scale, 1);
  return { solution: rows.map((row) => row.slice(n)), determinant };
}

export function formatMathNumber(value: number): string {
  requireValue(Number.isFinite(value), 'overflow');
  return Number(value.toPrecision(12)).toString();
}

function matrixText(rows: number[][]): string {
  return rows.map((row) => row.map(formatMathNumber).join('\t')).join('\n');
}

function roundedDecimal(source: string, places: number, mode: string): string {
  requireValue(
    /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(source.trim()) && source.length <= 120,
    'decimal',
  );
  const negative = source.trim().startsWith('-');
  const [whole, decimals = ''] = source.trim().replace(/^[+-]/, '').split('.');
  const coefficient = BigInt((whole || '0') + decimals);
  const shift = decimals.length - places;
  let units: bigint;
  if (shift <= 0) units = coefficient * 10n ** BigInt(-shift);
  else {
    const divisor = 10n ** BigInt(shift);
    units = coefficient / divisor;
    const remainder = coefficient % divisor;
    if (
      (mode === 'nearest' && remainder * 2n >= divisor) ||
      (mode === 'floor' && negative && remainder > 0n) ||
      (mode === 'ceil' && !negative && remainder > 0n)
    )
      units++;
  }
  if (units === 0n && places <= 0) return '0';
  const digits = units.toString().padStart(Math.max(1, places + 1), '0');
  const result =
    places > 0
      ? `${digits.slice(0, -places)}.${digits.slice(-places)}`
      : digits + '0'.repeat(-places);
  return (negative && units !== 0n ? '-' : '') + result;
}

const Z_VALUES: Record<string, number> = {
  '90': 1.6448536269514722,
  '95': 1.959963984540054,
  '99': 2.5758293035489004,
};

export function calculateMath(
  tool: MathToolId,
  input: MathInput,
  mode: string,
): MathResult[] {
  requireValue(
    Object.values(input).every(
      (value) => typeof value === 'string' && value.length <= 200000,
    ),
    'size',
  );
  const n = (key: string): number => numeric(input[key] ?? '');
  const i = (key: string, min: number, max: number): number =>
    integer(input[key] ?? '', min, max);
  const probability = (key: string): number => {
    const value = n(key);
    requireValue(value >= 0 && value <= 1, 'probability');
    return value;
  };
  const positive = (key: string): number => {
    const value = n(key);
    requireValue(value > 0, 'positive');
    return value;
  };
  const result = (key: string, value: string | number): MathResult => {
    if (typeof value === 'number')
      requireValue(Number.isFinite(value), 'overflow');
    return { key, value };
  };
  switch (tool) {
    case 'fraction-calculator': {
      const [a, b] = fraction(input.a);
      const [c, d] = fraction(input.b);
      requireValue(
        ['add', 'subtract', 'multiply', 'divide'].includes(mode),
        'mode',
      );
      const numerator =
        mode === 'add'
          ? a * d + b * c
          : mode === 'subtract'
            ? a * d - b * c
            : mode === 'multiply'
              ? a * c
              : a * d;
      const denominator =
        mode === 'multiply' ? b * d : mode === 'divide' ? b * c : b * d;
      requireValue(denominator !== 0n, 'zero');
      const divisor =
        gcd(numerator, denominator) * (denominator < 0n ? -1n : 1n);
      const top = numerator / divisor;
      const bottom = denominator / divisor;
      return [
        result('fraction', bottom === 1n ? String(top) : `${top}/${bottom}`),
        result('decimal', Number(top) / Number(bottom)),
      ];
    }
    case 'percentage-calculator': {
      const a = n('a'),
        b = n('b');
      requireValue(['of', 'ratio', 'change'].includes(mode), 'mode');
      requireValue(
        mode === 'of' || (mode === 'ratio' ? b !== 0 : a !== 0),
        'zero',
      );
      return [
        result(
          mode === 'of' ? 'value' : 'percent',
          mode === 'of'
            ? (a / 100) * b
            : mode === 'ratio'
              ? (a / b) * 100
              : ((b - a) / Math.abs(a)) * 100,
        ),
      ];
    }
    case 'gcd-lcm': {
      const values = tokens(input.values, 100).map(bigInteger);
      const common = values.reduce(gcd);
      const multiple = values.reduce((a, b) =>
        a === 0n || b === 0n ? 0n : (a / gcd(a, b)) * b,
      );
      return [
        result('gcd', String(common < 0n ? -common : common)),
        result('lcm', String(multiple < 0n ? -multiple : multiple)),
      ];
    }
    case 'prime-factorization': {
      let value = i('n', 2, 1e12);
      const factors: string[] = [];
      for (
        let divisor = 2;
        divisor * divisor <= value;
        divisor += divisor === 2 ? 1 : 2
      ) {
        let count = 0;
        while (value % divisor === 0) {
          value /= divisor;
          count++;
        }
        if (count)
          factors.push(count === 1 ? String(divisor) : `${divisor}^${count}`);
      }
      if (value > 1) factors.push(String(value));
      return [
        result('factorization', factors.join(' × ')),
        result(
          'prime',
          factors.length === 1 && !factors[0].includes('^') ? 'yes' : 'no',
        ),
      ];
    }
    case 'scientific-notation': {
      const x = n('x'),
        digits = i('digits', 1, 15);
      const scientific = x.toExponential(digits - 1);
      const rounded = Number(scientific);
      const exponent =
        rounded === 0
          ? 0
          : Math.floor(Number(scientific.split('e')[1]) / 3) * 3;
      // 用字符串移动指数，避免极小数的 10**exponent 下溢。
      const coefficient = Number(
        `${scientific.split('e')[0]}e${Number(scientific.split('e')[1]) - exponent}`,
      );
      return [
        result(
          'decimal',
          rounded.toLocaleString('en-US', {
            useGrouping: false,
            maximumSignificantDigits: digits,
          }),
        ),
        result('scientific', scientific),
        result('engineering', `${coefficient} × 10^${exponent}`),
      ];
    }
    case 'rounding-calculator': {
      requireValue(
        ['nearest', 'floor', 'ceil', 'truncate'].includes(mode),
        'mode',
      );
      return [
        result('value', roundedDecimal(input.x, i('places', -20, 20), mode)),
      ];
    }
    case 'power-root': {
      const x = n('x'),
        exponent = n('n');
      requireValue(['power', 'root'].includes(mode), 'mode');
      if (mode === 'power') {
        requireValue(!(x === 0 && exponent === 0), 'domain');
        requireValue(x >= 0 || Number.isSafeInteger(exponent), 'domain');
        requireValue(x !== 0 || exponent >= 0, 'zero');
        return [result('value', x ** exponent)];
      }
      requireValue(Number.isSafeInteger(exponent) && exponent !== 0, 'root');
      requireValue(x >= 0 || Math.abs(exponent % 2) === 1, 'realRoot');
      return [
        result('value', (x < 0 ? -1 : 1) * Math.abs(x) ** (1 / exponent)),
      ];
    }
    case 'logarithm-calculator': {
      const x = positive('x'),
        base = positive('base');
      requireValue(base !== 1, 'domain');
      return [
        result('log', Math.log(x) / Math.log(base)),
        result('ln', Math.log(x)),
        result('log10', Math.log10(x)),
      ];
    }
    case 'quadratic-equation': {
      let a = n('a'),
        b = n('b'),
        c = n('c');
      requireValue(a !== 0 || b !== 0, c === 0 ? 'infinite' : 'inconsistent');
      if (a === 0) return [result('x', -c / b)];
      const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c));
      a /= scale;
      b /= scale;
      c /= scale;
      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0) {
        const real = -b / (2 * a),
          imaginary = Math.sqrt(-discriminant) / (2 * Math.abs(a));
        return [
          result(
            'x1',
            `${formatMathNumber(real)} + ${formatMathNumber(imaginary)}i`,
          ),
          result(
            'x2',
            `${formatMathNumber(real)} − ${formatMathNumber(imaginary)}i`,
          ),
        ];
      }
      // q 公式避免根相减造成有效位抵消。
      const q = -0.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant));
      return [result('x1', q / a), result('x2', q === 0 ? 0 : c / q)];
    }
    case 'linear-system': {
      const rows = matrix(input.matrix, 9);
      requireValue(
        rows.length >= 2 && rows[0].length === rows.length + 1,
        'augmented',
      );
      const { solution } = eliminate(
        rows.map((row) => row.slice(0, -1)),
        rows.map((row) => [row.at(-1)!]),
      );
      return [
        result(
          'solution',
          solution
            .map((row, index) => `x${index + 1} = ${formatMathNumber(row[0])}`)
            .join('\n'),
        ),
      ];
    }
    case 'matrix-calculator': {
      const a = matrix(input.a);
      if (mode === 'transpose')
        return [
          result(
            'matrix',
            matrixText(a[0].map((_, j) => a.map((row) => row[j]))),
          ),
        ];
      if (mode === 'determinant' || mode === 'inverse') {
        const identity = a.map((_, i) => a.map((_, j) => (i === j ? 1 : 0)));
        const calculated = eliminate(a, identity, mode === 'determinant');
        return [
          mode === 'inverse'
            ? result('matrix', matrixText(calculated.solution))
            : result('determinant', calculated.determinant),
        ];
      }
      requireValue(['add', 'subtract', 'multiply'].includes(mode), 'mode');
      const b = matrix(input.b);
      if (mode === 'multiply') {
        requireValue(a[0].length === b.length, 'dimensions');
        return [
          result(
            'matrix',
            matrixText(
              a.map((row) =>
                b[0].map((_, j) =>
                  row.reduce((sum, v, k) => sum + v * b[k][j], 0),
                ),
              ),
            ),
          ),
        ];
      }
      requireValue(
        a.length === b.length && a[0].length === b[0].length,
        'dimensions',
      );
      return [
        result(
          'matrix',
          matrixText(
            a.map((row, i) =>
              row.map((v, j) => v + (mode === 'add' ? 1 : -1) * b[i][j]),
            ),
          ),
        ),
      ];
    }
    case 'statistics-calculator': {
      const values = tokens(input.values, 10000)
        .map(numeric)
        .sort((a, b) => a - b);
      requireValue(['sample', 'population'].includes(mode), 'mode');
      requireValue(mode !== 'sample' || values.length >= 2, 'sample');
      let mean = 0,
        m2 = 0,
        sum = 0;
      const counts = new Map<number, number>();
      values.forEach((value, index) => {
        const delta = value - mean;
        mean += delta / (index + 1);
        m2 += delta * (value - mean);
        sum += value;
        counts.set(value, (counts.get(value) ?? 0) + 1);
      });
      const variance = Math.max(
        0,
        m2 / (values.length - (mode === 'sample' ? 1 : 0)),
      );
      const middle = Math.floor(values.length / 2);
      const maxCount = Math.max(...counts.values());
      return [
        result('count', values.length),
        result('sum', sum),
        result('mean', mean),
        result(
          'median',
          values.length % 2
            ? values[middle]
            : (values[middle - 1] + values[middle]) / 2,
        ),
        result(
          'mode',
          maxCount === 1
            ? 'none'
            : [...counts]
                .filter(([, count]) => count === maxCount)
                .map(([v]) => formatMathNumber(v))
                .join(', '),
        ),
        result('min', values[0]),
        result('max', values.at(-1)!),
        result('range', values.at(-1)! - values[0]),
        result('variance', variance),
        result('sd', Math.sqrt(variance)),
      ];
    }
    case 'combinatorics': {
      const total = i('n', 0, 1000),
        selection = i('r', 0, total);
      let factorial = 1n,
        permutation = 1n,
        combination = 1n;
      for (let k = 2; k <= total; k++) factorial *= BigInt(k);
      for (let k = 0; k < selection; k++) permutation *= BigInt(total - k);
      for (let k = 1; k <= Math.min(selection, total - selection); k++)
        combination = (combination * BigInt(total - k + 1)) / BigInt(k);
      return [
        result('permutation', String(permutation)),
        result('combination', String(combination)),
        result('factorial', String(factorial)),
      ];
    }
    case 'probability-calculator': {
      const a = probability('a'),
        b = probability('b');
      return [
        result('intersection', a * b),
        result('union', a + b - a * b),
        result('onlyA', a * (1 - b)),
        result('onlyB', b * (1 - a)),
        result('neither', (1 - a) * (1 - b)),
        result('notA', 1 - a),
        result('notB', 1 - b),
      ];
    }
    case 'binomial-distribution': {
      const total = i('n', 0, 1000),
        k = i('k', 0, total),
        p = probability('p');
      let logCombination = 0,
        exact = 0,
        atMost = 0,
        atLeast = 0;
      for (let j = 0; j <= total; j++) {
        if (j > 0) logCombination += Math.log(total - j + 1) - Math.log(j);
        const mass =
          p === 0
            ? Number(j === 0)
            : p === 1
              ? Number(j === total)
              : Math.exp(
                  logCombination +
                    j * Math.log(p) +
                    (total - j) * Math.log1p(-p),
                );
        if (j === k) exact = mass;
        if (j <= k) atMost += mass;
        if (j >= k) atLeast += mass;
      }
      return [
        result('exact', Math.min(1, exact)),
        result('atMost', Math.min(1, atMost)),
        result('atLeast', Math.min(1, atLeast)),
        result('mean', total * p),
        result('variance', total * p * (1 - p)),
      ];
    }
    case 'z-score': {
      const x = n('x'),
        mean = n('mean'),
        sd = positive('sd');
      requireValue(['standardize', 'restore'].includes(mode), 'mode');
      return [
        result(
          mode === 'restore' ? 'value' : 'z',
          mode === 'restore' ? mean + x * sd : (x - mean) / sd,
        ),
      ];
    }
    case 'confidence-interval': {
      const mean = n('mean'),
        sd = positive('sd'),
        count = i('n', 1, 1e12);
      requireValue(Object.hasOwn(Z_VALUES, mode), 'mode');
      const se = sd / Math.sqrt(count),
        margin = Z_VALUES[mode] * se;
      return [
        result('lower', mean - margin),
        result('upper', mean + margin),
        result('margin', margin),
        result('se', se),
        result('criticalZ', Z_VALUES[mode]),
      ];
    }
    case 'sample-size': {
      const p = probability('p'),
        margin = positive('margin') / 100,
        population = i('population', 0, 1e12);
      requireValue(p > 0 && p < 1 && margin < 1, 'sampleDomain');
      requireValue(Object.hasOwn(Z_VALUES, mode), 'mode');
      const raw = (Z_VALUES[mode] ** 2 * p * (1 - p)) / margin ** 2;
      const adjusted =
        population > 0 ? raw / (1 + (raw - 1) / population) : raw;
      requireValue(Number.isSafeInteger(Math.ceil(adjusted)), 'overflow');
      return [
        result('sampleSize', Math.max(1, Math.ceil(adjusted))),
        result('criticalZ', Z_VALUES[mode]),
      ];
    }
    case 'triangle-calculator': {
      const a = positive('a'),
        b = positive('b'),
        c = positive('c');
      const scale = Math.max(a, b, c);
      const [x, y, z] = [a / scale, b / scale, c / scale].sort((a, b) => b - a);
      requireValue(z > x - y, 'triangle');
      const normalizedArea =
        Math.sqrt(
          (x + (y + z)) * (z - (x - y)) * (z + (x - y)) * (x + (y - z)),
        ) / 4;
      const area = normalizedArea * scale ** 2;
      const angle = (
        opposite: number,
        adjacent: number,
        other: number,
      ): number =>
        (Math.atan2(
          4 * normalizedArea,
          (adjacent / scale) ** 2 +
            (other / scale) ** 2 -
            (opposite / scale) ** 2,
        ) *
          180) /
        Math.PI;
      return [
        result('area', area),
        result('perimeter', a + b + c),
        result('angleA', angle(a, b, c)),
        result('angleB', angle(b, a, c)),
        result('angleC', angle(c, a, b)),
        result('heightA', (2 * area) / a),
        result('heightB', (2 * area) / b),
        result('heightC', (2 * area) / c),
      ];
    }
    case 'sequence-calculator': {
      const a = n('a'),
        d = n('d'),
        count = i('n', 1, 1000);
      requireValue(['arithmetic', 'geometric'].includes(mode), 'mode');
      const values = Array.from({ length: count }, (_, index) =>
        mode === 'arithmetic' ? a + index * d : a * d ** index,
      );
      return [
        result('nth', values.at(-1)!),
        result(
          'sum',
          values.reduce((sum, value) => sum + value, 0),
        ),
        result('sequence', values.map(formatMathNumber).join(', ')),
      ];
    }
  }
}
