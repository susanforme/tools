import { ELEMENTS } from './batch4-elements';
const BY_SYMBOL = new Map(ELEMENTS.map((element) => [element.symbol, element]));
export function parseFormula(source: string): Record<string, number> {
  if (!source.trim() || source.length > 300) throw new Error('formulaInvalid');
  const total: Record<string, number> = {};
  const merge = (
    target: Record<string, number>,
    part: Record<string, number>,
    factor: number,
  ) => {
    for (const [symbol, n] of Object.entries(part)) {
      target[symbol] = (target[symbol] ?? 0) + n * factor;
      if (target[symbol] > 1e6) throw new Error('formulaLimit');
    }
  };
  for (const segment of source.replace(/\s/g, '').split(/[·.]/)) {
    const tokens = segment.match(/[A-Z][a-z]?|\d+|./g) ?? [];
    let at = 0;
    const number = () => {
      if (!/^\d+$/.test(tokens[at] ?? '')) return 1;
      const n = Number(tokens[at++]);
      if (!Number.isInteger(n) || n < 1 || n > 1000)
        throw new Error('formulaLimit');
      return n;
    };
    const multiplier = number();
    const parse = (end: string, depth: number): Record<string, number> => {
      if (depth > 10) throw new Error('formulaLimit');
      const part: Record<string, number> = {};
      while (at < tokens.length && tokens[at] !== end) {
        const token = tokens[at++];
        if (token === '(' || token === '[') {
          const close = token === '(' ? ')' : ']';
          const group = parse(close, depth + 1);
          if (tokens[at++] !== close) throw new Error('formulaInvalid');
          merge(part, group, number());
        } else {
          if (!BY_SYMBOL.has(token)) throw new Error('formulaInvalid');
          merge(part, { [token]: 1 }, number());
        }
      }
      if (!Object.keys(part).length) throw new Error('formulaInvalid');
      return part;
    };
    merge(total, parse('', 0), multiplier);
    if (at !== tokens.length) throw new Error('formulaInvalid');
  }
  return total;
}
export function molarMass(source: string) {
  const atoms = parseFormula(source);
  const parts = Object.entries(atoms).map(([symbol, count]) => {
    const element = BY_SYMBOL.get(symbol)!;
    if (element.mass === null) throw new Error('noAtomicWeight');
    return { symbol, count, mass: element.mass * count };
  });
  const mass = parts.reduce((s, p) => s + p.mass, 0);
  return {
    atoms,
    parts: parts.map((p) => ({ ...p, percent: (p.mass / mass) * 100 })),
    mass,
  };
}
type Fraction = { n: bigint; d: bigint };
function gcd(a: bigint, b: bigint): bigint {
  while (b) {
    [a, b] = [b, a % b];
  }
  return a < 0n ? -a : a;
}
function fraction(n: bigint, d = 1n): Fraction {
  if (!d) throw new Error('balanceInvalid');
  const g = gcd(n, d) * (d < 0n ? -1n : 1n);
  const result = { n: n / g, d: d / g };
  if (result.n.toString().length > 100 || result.d.toString().length > 100)
    throw new Error('formulaLimit');
  return result;
}
const sub = (a: Fraction, b: Fraction) =>
  fraction(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Fraction, b: Fraction) => fraction(a.n * b.n, a.d * b.d);
const div = (a: Fraction, b: Fraction) => fraction(a.n * b.d, a.d * b.n);
export function balanceEquation(source: string) {
  if (source.length > 1500) throw new Error('formulaLimit');
  const sides = source.replace(/→|=>/g, '=').split('=');
  if (sides.length !== 2) throw new Error('balanceInvalid');
  const left = sides[0].split('+').map((s) => s.trim()),
    right = sides[1].split('+').map((s) => s.trim()),
    species = [...left, ...right];
  if (species.length > 12 || species.some((s) => !s || /^\d/.test(s)))
    throw new Error('balanceInvalid');
  const formulas = species.map(parseFormula),
    elements = [...new Set(formulas.flatMap((f) => Object.keys(f)))];
  const matrix = elements.map((element) =>
    formulas.map((f, i) =>
      fraction(BigInt((f[element] ?? 0) * (i < left.length ? 1 : -1))),
    ),
  );
  let row = 0;
  const pivots: number[] = [];
  for (
    let column = 0;
    column < species.length && row < matrix.length;
    column++
  ) {
    const found = matrix.findIndex((r, i) => i >= row && r[column].n !== 0n);
    if (found === -1) continue;
    [matrix[row], matrix[found]] = [matrix[found], matrix[row]];
    const pivot = matrix[row][column];
    matrix[row] = matrix[row].map((v) => div(v, pivot));
    for (let i = 0; i < matrix.length; i++) {
      if (i === row) continue;
      const factor = matrix[i][column];
      matrix[i] = matrix[i].map((v, j) => sub(v, mul(factor, matrix[row][j])));
    }
    pivots.push(column);
    row++;
  }
  const free = species.map((_, i) => i).filter((i) => !pivots.includes(i));
  if (free.length !== 1) throw new Error('balanceAmbiguous');
  const solution = species.map(() => fraction(0n));
  solution[free[0]] = fraction(1n);
  pivots.forEach((col, i) => {
    solution[col] = fraction(-matrix[i][free[0]].n, matrix[i][free[0]].d);
  });
  const lcm = solution.reduce(
    (value, f) => (value / gcd(value, f.d)) * f.d,
    1n,
  );
  let coefficients = solution.map((f) => f.n * (lcm / f.d));
  if (coefficients.every((n) => n < 0n))
    coefficients = coefficients.map((n) => -n);
  if (coefficients.some((n) => n <= 0n)) throw new Error('balanceInvalid');
  const divisor = coefficients.reduce(gcd);
  coefficients = coefficients.map((n) => n / divisor);
  if (coefficients.some((n) => n > 1000000000n))
    throw new Error('formulaLimit');
  const terms = species.map(
    (s, i) => `${coefficients[i] === 1n ? '' : coefficients[i]}${s}`,
  );
  return {
    equation: `${terms.slice(0, left.length).join(' + ')} → ${terms.slice(left.length).join(' + ')}`,
    coefficients: coefficients.map(Number),
    elements,
  };
}
export function solutionCalculation(
  mode: string,
  a: number,
  b: number,
  c: number,
) {
  if ([a, b, c].some((n) => !Number.isFinite(n) || n <= 0 || n > 1e9))
    throw new Error('invalid');
  let result: Record<string, number>;
  if (mode === 'dilution') {
    if (c > a) throw new Error('dilutionInvalid');
    result = { finalVolume: (a * b) / c, water: (a * b) / c - b };
  } else {
    result = {
      moles: a / b,
      molarity: a / b / (c / 1000),
      massConcentration: a / (c / 1000),
    };
  }
  if (Object.values(result).some((value) => !Number.isFinite(value)))
    throw new Error('invalid');
  return result;
}
