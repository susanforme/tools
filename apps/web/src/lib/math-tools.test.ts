import { describe, expect, it } from 'vitest';
import { MATH_TOOLS, type MathToolId } from './math-tool-catalog';
import { calculateMath, type MathInput } from './math-tools';
import { mathToolsEn, mathToolsZh } from '../i18n/locales/math-tools';

const run = (
  tool: MathToolId,
  input: MathInput,
  mode = '',
): Record<string, string | number> =>
  Object.fromEntries(
    calculateMath(tool, input, mode).map(({ key, value }) => [key, value]),
  );

describe('community math tools', () => {
  it('has 20 distinct tools with runnable examples and bilingual fields/results for every mode', () => {
    expect(new Set(MATH_TOOLS.map(({ id }) => id)).size).toBe(20);
    for (const tool of MATH_TOOLS) {
      for (const language of [mathToolsZh.mathTools, mathToolsEn.mathTools]) {
        const translations = language.tools[tool.id];
        expect(translations.title).toBeTruthy();
        for (const field of tool.fields)
          expect(translations.fields).toHaveProperty(field.key);
        for (const mode of tool.modes)
          expect(translations.modes).toHaveProperty(mode);
        for (const mode of tool.modes.length ? tool.modes : ['']) {
          const results = calculateMath(
            tool.id,
            Object.fromEntries(
              tool.fields.map(({ key, value }) => [key, value]),
            ),
            mode,
          );
          expect(results.length).toBeGreaterThan(0);
          for (const result of results)
            expect(language.results).toHaveProperty(result.key);
        }
      }
    }
  });

  it('calculates exact signed fractions and all four operations', () => {
    expect(
      run('fraction-calculator', { a: '1/3', b: '1/6' }, 'add').fraction,
    ).toBe('1/2');
    expect(
      run('fraction-calculator', { a: '1/-3', b: '1/6' }, 'subtract').fraction,
    ).toBe('-1/2');
    expect(
      run('fraction-calculator', { a: '-2/3', b: '-3/4' }, 'multiply').fraction,
    ).toBe('1/2');
    expect(
      run(
        'fraction-calculator',
        { a: '9007199254740993/2', b: '3/2' },
        'divide',
      ).fraction,
    ).toBe('3002399751580331');
    expect(
      run('fraction-calculator', { a: '1/2', b: '-1/2' }, 'add').fraction,
    ).toBe('0');
  });

  it('calculates percentages with an explicit absolute baseline for negative values', () => {
    expect(run('percentage-calculator', { a: '20', b: '80' }, 'of').value).toBe(
      16,
    );
    expect(
      run('percentage-calculator', { a: '20', b: '80' }, 'ratio').percent,
    ).toBe(25);
    expect(
      run('percentage-calculator', { a: '-100', b: '-50' }, 'change').percent,
    ).toBe(50);
  });

  it('calculates exact GCD/LCM and prime factorization within the work limit', () => {
    expect(run('gcd-lcm', { values: '-12, 18, 30' })).toEqual({
      gcd: '6',
      lcm: '180',
    });
    expect(run('gcd-lcm', { values: '0 0' })).toEqual({ gcd: '0', lcm: '0' });
    expect(run('gcd-lcm', { values: '9007199254740993 3' }).gcd).toBe('3');
    expect(run('prime-factorization', { n: '360' })).toEqual({
      factorization: '2^3 × 3^2 × 5',
      prime: 'no',
    });
    expect(run('prime-factorization', { n: '999983' }).prime).toBe('yes');
    expect(
      run('prime-factorization', { n: '1000000000000' }).factorization,
    ).toBe('2^12 × 5^12');
  });

  it('normalizes scientific/engineering notation after rounding across an exponent boundary', () => {
    expect(
      run('scientific-notation', { x: '999999', digits: '3' }),
    ).toMatchObject({ scientific: '1.00e+6', engineering: '1 × 10^6' });
    expect(
      run('scientific-notation', { x: '0.0000123', digits: '3' }).engineering,
    ).toBe('12.3 × 10^-6');
    expect(
      run('scientific-notation', { x: '0', digits: '3' }).engineering,
    ).toBe('0 × 10^0');
  });

  it('keeps decimal and scientific displays consistent at a binary rounding tie', () => {
    const output = run('scientific-notation', { x: '1.005', digits: '3' });
    expect(Number(output.decimal)).toBe(Number(output.scientific));
  });

  it('rounds decimal ties exactly with negative places and direction', () => {
    expect(
      run('rounding-calculator', { x: '1.005', places: '2' }, 'nearest').value,
    ).toBe('1.01');
    expect(
      run('rounding-calculator', { x: '-1.255', places: '2' }, 'nearest').value,
    ).toBe('-1.26');
    expect(
      run('rounding-calculator', { x: '-1.251', places: '2' }, 'floor').value,
    ).toBe('-1.26');
    expect(
      run('rounding-calculator', { x: '-1.251', places: '2' }, 'ceil').value,
    ).toBe('-1.25');
    expect(
      run('rounding-calculator', { x: '-150', places: '-2' }, 'truncate').value,
    ).toBe('-100');
    expect(
      run('rounding-calculator', { x: '12', places: '2' }, 'nearest').value,
    ).toBe('12.00');
    expect(
      run('rounding-calculator', { x: '1', places: '-2' }, 'nearest').value,
    ).toBe('0');
  });

  it('calculates real powers, odd negative roots and logarithms', () => {
    expect(run('power-root', { x: '2', n: '-3' }, 'power').value).toBe(0.125);
    expect(run('power-root', { x: '-27', n: '3' }, 'root').value).toBe(-3);
    expect(() => run('power-root', { x: '-2', n: '0.5' }, 'power')).toThrow(
      'domain',
    );
    expect(() => run('power-root', { x: '0', n: '-1' }, 'power')).toThrow(
      'zero',
    );
    expect(run('logarithm-calculator', { x: '8', base: '2' }).log).toBe(3);
  });

  it('solves quadratic, complex, repeated and linear roots without cancellation', () => {
    const roots = run('quadratic-equation', { a: '1', b: '-3', c: '2' });
    expect(roots.x1).toBeCloseTo(2, 12);
    expect(roots.x2).toBeCloseTo(1, 12);
    expect(run('quadratic-equation', { a: '1', b: '0', c: '1' })).toEqual({
      x1: '0 + 1i',
      x2: '0 − 1i',
    });
    expect(run('quadratic-equation', { a: '0', b: '2', c: '-6' }).x).toBe(3);
    expect(
      run('quadratic-equation', { a: '1', b: '1e16', c: '1' }).x2,
    ).toBeCloseTo(-1e-16, 25);
    expect(run('quadratic-equation', { a: '1', b: '-2', c: '1' })).toEqual({
      x1: 1,
      x2: 1,
    });
  });

  it('solves augmented matrices with pivoting and rejects singular systems', () => {
    expect(run('linear-system', { matrix: '0 1 2\n1 1 5' }).solution).toBe(
      'x1 = 3\nx2 = 2',
    );
    expect(
      run('linear-system', { matrix: '1e-20 0 2e-20\n0 1e20 3e20' }).solution,
    ).toBe('x1 = 2\nx2 = 3');
    expect(() => run('linear-system', { matrix: '1 1 2\n2 2 5' })).toThrow(
      'singular',
    );
  });

  it('supports all matrix operations including zero determinant and rectangular multiplication', () => {
    const inputs = { a: '1 2\n3 4', b: '5 6\n7 8' };
    expect(run('matrix-calculator', inputs, 'add').matrix).toBe('6\t8\n10\t12');
    expect(run('matrix-calculator', inputs, 'subtract').matrix).toBe(
      '-4\t-4\n-4\t-4',
    );
    expect(run('matrix-calculator', inputs, 'multiply').matrix).toBe(
      '19\t22\n43\t50',
    );
    expect(
      run('matrix-calculator', { a: '1 2 3\n4 5 6', b: '1\n2\n3' }, 'multiply')
        .matrix,
    ).toBe('14\n32');
    expect(run('matrix-calculator', inputs, 'transpose').matrix).toBe(
      '1\t3\n2\t4',
    );
    expect(
      run('matrix-calculator', inputs, 'determinant').determinant,
    ).toBeCloseTo(-2);
    expect(run('matrix-calculator', inputs, 'inverse').matrix).toBe(
      '-2\t1\n1.5\t-0.5',
    );
    expect(
      run('matrix-calculator', { a: '1 2\n2 4' }, 'determinant').determinant,
    ).toBe(0);
    expect(() =>
      run('matrix-calculator', { a: '1 2\n2 4' }, 'inverse'),
    ).toThrow('singular');
  });

  it('distinguishes sample/population statistics and multimodal data', () => {
    expect(
      run('statistics-calculator', { values: '2 4 4 4 5 5 7 9' }, 'population'),
    ).toMatchObject({
      count: 8,
      sum: 40,
      mean: 5,
      median: 4.5,
      mode: '4',
      variance: 4,
      sd: 2,
    });
    expect(
      run('statistics-calculator', { values: '1 2 3' }, 'sample').variance,
    ).toBe(1);
    expect(
      run('statistics-calculator', { values: '1 1 2 2' }, 'sample').mode,
    ).toBe('1, 2');
    expect(
      run('statistics-calculator', { values: '9' }, 'population'),
    ).toMatchObject({ variance: 0, mode: 'none' });
  });

  it('computes exact combinations including empty selections and large results', () => {
    expect(run('combinatorics', { n: '10', r: '3' })).toEqual({
      factorial: '3628800',
      permutation: '720',
      combination: '120',
    });
    expect(run('combinatorics', { n: '0', r: '0' })).toEqual({
      factorial: '1',
      permutation: '1',
      combination: '1',
    });
    expect(run('combinatorics', { n: '100', r: '50' }).combination).toBe(
      '100891344545564193334812497256',
    );
  });

  it('computes independent-event and binomial probabilities, including endpoint probabilities', () => {
    expect(
      run('probability-calculator', { a: '0.5', b: '0.3' }).intersection,
    ).toBe(0.15);
    const distribution = run('binomial-distribution', {
      n: '10',
      k: '5',
      p: '0.5',
    });
    expect(distribution.exact).toBeCloseTo(252 / 1024, 12);
    expect(distribution.atMost).toBeCloseTo(638 / 1024, 12);
    expect(distribution.atLeast).toBeCloseTo(638 / 1024, 12);
    expect(
      run('binomial-distribution', { n: '1000', k: '500', p: '0.5' }).exact,
    ).toBeCloseTo(0.025225018178, 10);
    expect(
      run('binomial-distribution', { n: '10', k: '0', p: '0' }),
    ).toMatchObject({ exact: 1, atMost: 1, atLeast: 1 });
    expect(run('binomial-distribution', { n: '0', k: '0', p: '1' }).exact).toBe(
      1,
    );
  });

  it('converts Z scores and calculates known-sigma confidence intervals and finite-population sample size', () => {
    expect(
      run('z-score', { x: '85', mean: '70', sd: '10' }, 'standardize').z,
    ).toBe(1.5);
    expect(
      run('z-score', { x: '1.5', mean: '70', sd: '10' }, 'restore').value,
    ).toBe(85);
    const confidence = run(
      'confidence-interval',
      { mean: '100', sd: '15', n: '100' },
      '95',
    );
    expect(confidence.lower).toBeCloseTo(97.060054, 5);
    expect(confidence.upper).toBeCloseTo(102.939946, 5);
    expect(
      run('sample-size', { p: '0.5', margin: '5', population: '0' }, '95')
        .sampleSize,
    ).toBe(385);
    expect(
      run('sample-size', { p: '0.5', margin: '5', population: '1000' }, '95')
        .sampleSize,
    ).toBe(278);
  });

  it('calculates triangle geometry and sequence sums', () => {
    const triangle = run('triangle-calculator', { a: '3', b: '4', c: '5' });
    expect(triangle.area).toBeCloseTo(6);
    expect(triangle.angleC).toBeCloseTo(90);
    expect(triangle.heightC).toBeCloseTo(2.4);
    expect(
      run('sequence-calculator', { a: '2', d: '3', n: '10' }, 'arithmetic'),
    ).toMatchObject({ nth: 29, sum: 155 });
    expect(
      run('sequence-calculator', { a: '2', d: '-2', n: '4' }, 'geometric'),
    ).toEqual({ nth: -16, sum: -10, sequence: '2, -4, 8, -16' });
  });

  it.each<[MathToolId, MathInput, string]>([
    ['fraction-calculator', { a: '1/0', b: '2' }, 'add'],
    ['fraction-calculator', { a: '2', b: '0' }, 'divide'],
    ['percentage-calculator', { a: '0', b: '10' }, 'change'],
    ['prime-factorization', { n: '1000000000001' }, ''],
    ['gcd-lcm', { values: '1.5 3' }, ''],
    ['scientific-notation', { x: '1e-400', digits: '3' }, ''],
    ['rounding-calculator', { x: '1e3', places: '2' }, 'nearest'],
    ['power-root', { x: '-2', n: '2' }, 'root'],
    ['power-root', { x: '0', n: '0' }, 'power'],
    ['logarithm-calculator', { x: '0', base: '10' }, ''],
    ['quadratic-equation', { a: '0', b: '0', c: '0' }, ''],
    ['linear-system', { matrix: '1 2\n3 4' }, ''],
    ['matrix-calculator', { a: '1 2\n3', b: '1' }, 'add'],
    ['matrix-calculator', { a: '1 2', b: '1 2' }, 'multiply'],
    ['statistics-calculator', { values: '' }, 'population'],
    ['statistics-calculator', { values: '1' }, 'sample'],
    ['combinatorics', { n: '5', r: '6' }, ''],
    ['probability-calculator', { a: '1.1', b: '0.5' }, ''],
    ['binomial-distribution', { n: '1001', k: '1', p: '0.5' }, ''],
    ['z-score', { x: '1', mean: '0', sd: '0' }, 'standardize'],
    ['confidence-interval', { mean: '0', sd: '1', n: '1' }, 'invalid'],
    ['sample-size', { p: '0.5', margin: '0', population: '0' }, '95'],
    ['triangle-calculator', { a: '1', b: '2', c: '3' }, ''],
    ['sequence-calculator', { a: '1e100', d: '100', n: '1000' }, 'geometric'],
  ])('rejects invalid/domain/oversized inputs in %s', (tool, input, mode) => {
    expect(() => calculateMath(tool, input, mode)).toThrow();
  });
});
