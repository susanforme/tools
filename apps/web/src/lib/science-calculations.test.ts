import { expect, test } from 'vitest';
import {
  balanceEquation,
  molarMass,
  parseFormula,
  solutionCalculation,
} from './chemistry-calculations';
import { ELEMENTS } from './chemistry-elements';
import { photoCalculation, photoSun, physics } from './science-calculations';
import { sewingPattern } from './sewing-patterns';
import { packagingPdf } from './analysis-packaging';
test('elements and neutral formula conservation, bounded exact balancing', () => {
  expect(ELEMENTS).toHaveLength(118);
  expect(new Set(ELEMENTS.map((e) => e.symbol)).size).toBe(118);
  expect(molarMass('H2O').mass).toBeCloseTo(18.015, 3);
  expect(parseFormula('CuSO4·5H2O')).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
  expect(parseFormula('K4[Fe(CN)6]')).toEqual({ K: 4, Fe: 1, C: 6, N: 6 });
  expect(balanceEquation('Fe + O2 = Fe2O3').coefficients).toEqual([4, 3, 2]);
  expect(balanceEquation('C2H6 + O2 = CO2 + H2O').coefficients).toEqual([
    2, 7, 4, 6,
  ]);
  expect(() => balanceEquation('C + O2 = CO + CO2')).toThrow(
    'balanceAmbiguous',
  );
  for (const bad of ['', 'H0', '(H2', 'Xx', 'H2O+', 'CuSO4..5H2O', 'H1001'])
    expect(() => parseFormula(bad)).toThrow();
  expect(() => molarMass('Tc')).toThrow('noAtomicWeight');
  expect(solutionCalculation('dilution', 2, 100, 0.5)).toEqual({
    finalVolume: 400,
    water: 300,
  });
  expect(() => solutionCalculation('dilution', 1, 100, 2)).toThrow();
  expect(() => solutionCalculation('dilution', 1, 100, 1e-320)).toThrow(
    'invalid',
  );
  expect(() => solutionCalculation('solution', 1, 58.44, 1e-320)).toThrow(
    'invalid',
  );
});
test('scientific models return physical values and reject invalid domains', async () => {
  expect(physics('motion', [0, 9.81, 2])).toEqual({
    velocity: 19.62,
    distance: 19.62,
  });
  expect(physics('lens', [0.1, 0.3]).imageDistance).toBeCloseTo(0.15);
  expect(physics('lens', [-0.1, 0.3]).imageDistance).toBeCloseTo(-0.075);
  expect(physics('gas', [1, 273.15, 0.022414]).pressure).toBeCloseTo(
    101324.57,
    0,
  );
  expect(() => physics('gas', [1, -1, 1])).toThrow();
  expect(photoCalculation('dof', [50, 2.8, 3, 0.03]).hyperfocal).toBeCloseTo(
    29.8119,
    4,
  );
  expect(photoCalculation('dof', [50, 2.8, 30, 0.03]).far).toBe(Infinity);
  expect(photoCalculation('nd', [0.01, 10]).exposure).toBe(10.24);
  expect(photoCalculation('exposure', [4, 0.008, 100, 8]).newShutter).toBe(
    0.032,
  );
  expect(photoCalculation('focal', [35, 1.5]).equivalent).toBe(52.5);
  const summer = await photoSun('2026-06-21', 78, 15, 2);
  expect(summer.alwaysUp).toBe(true);
  expect(summer.times.find((t) => t.key === 'sunrise')?.value).toBeNull();
  await expect(photoSun('2026-99-99', 31, 121, 8)).rejects.toThrow('invalid');
});
test('pattern cut geometry contains seam allowance, scale calibration and A4 tiling', async () => {
  const bag = sewingPattern('bag', 72, 96, 40, 30, 90, 4, 1, 65);
  expect(
    bag.lines.some(
      (l) => !l.fold && Math.abs(Math.abs(l.x2 - l.x1) - 320) < 1e-8,
    ),
  ).toBe(true);
  expect(bag.lines.some((l) => !l.fold && l.x1 === 10 && l.x2 === 60)).toBe(
    true,
  );
  for (const kind of ['bag', 'skirt', 'apron']) {
    const plan = sewingPattern(kind, 72, 96, 60, 60, 90, 4, 1, 65);
    expect(
      plan.lines.every((l) => [l.x1, l.y1, l.x2, l.y2].every(Number.isFinite)),
    ).toBe(true);
    expect(plan.lines.every((l) => Math.min(l.x1, l.y1, l.x2, l.y2) >= 0)).toBe(
      true,
    );
  }
  expect(() =>
    sewingPattern('apron', 120, 96, 60, 60, 90, 4, 1, 65),
  ).not.toThrow();
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.load(await packagingPdf(bag, true));
  expect(pdf.getPageCount()).toBe(
    Math.ceil(bag.width / 190) * Math.ceil(bag.height / 277),
  );
  expect(pdf.getPage(0).getWidth()).toBeCloseTo((210 * 72) / 25.4);
  expect(() => sewingPattern('skirt', 100, 80, 60, 60, 90, 4, 1, 65)).toThrow(
    'patternInvalid',
  );
});
