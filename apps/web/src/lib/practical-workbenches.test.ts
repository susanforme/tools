import { describe, expect, it } from 'vitest';
import {
  BUSINESS_MODES,
  CALCULATOR_FIELDS,
  HOME_MODES,
  OFFICE_MODES,
  STUDY_MODES,
  buildOfficeDocument,
  calculateWorkbench,
} from './practical-workbenches';

const modes = [...HOME_MODES, ...BUSINESS_MODES, ...STUDY_MODES];
const defaults = (mode: (typeof modes)[number]) =>
  Object.fromEntries(
    CALCULATOR_FIELDS[mode].map(({ id, initial }) => [id, initial]),
  );

describe('practical workbenches', () => {
  it('calculates all fifteen modes with finite results', () => {
    expect(modes).toHaveLength(15);
    for (const mode of modes) {
      const result = calculateWorkbench(mode, defaults(mode));
      expect(result.length, mode).toBeGreaterThan(0);
      expect(
        result.every(({ value }) => Number.isFinite(value)),
        mode,
      ).toBe(true);
    }
  });

  it('rounds material purchases and computes business and study targets', () => {
    const read = (mode: (typeof modes)[number], id: string) =>
      calculateWorkbench(mode, defaults(mode)).find((value) => value.id === id)
        ?.value;
    expect(read('paint', 'paintLiters')).toBeCloseTo(7.128);
    expect(read('wallpaper', 'rolls')).toBe(9);
    expect(read('flooring', 'packs')).toBe(6);
    expect(read('tile', 'boxes')).toBe(7);
    expect(read('soil', 'bags')).toBe(11);
    expect(read('breakEven', 'breakEvenUnits')).toBe(250);
    expect(read('margin', 'targetPrice')).toBe(100);
    expect(read('discounts', 'finalPrice')).toBe(72);
    expect(read('dimensionalWeight', 'billableWeight')).toBe(4.8);
    expect(read('reorder', 'reorderPoint')).toBe(70);
    expect(read('weightedGrade', 'weightedAverage')).toBe(88);
    expect(read('finalTarget', 'requiredExamScore')).toBe(92);
    expect(read('gpa', 'newGpa')).toBeCloseTo(3.3);
    expect(read('studyHours', 'subject1Hours')).toBe(10);
    expect(read('readingPlan', 'pagesPerSession')).toBe(14);
  });

  it('rejects invalid divisors and nonviable inputs', () => {
    expect(() =>
      calculateWorkbench('breakEven', {
        ...defaults('breakEven'),
        variableCost: 100,
      }),
    ).toThrow('noContribution');
    expect(() =>
      calculateWorkbench('wallpaper', {
        ...defaults('wallpaper'),
        rollLength: 1,
      }),
    ).toThrow('rollTooShort');
    expect(() =>
      calculateWorkbench('margin', {
        ...defaults('margin'),
        targetMargin: 100,
      }),
    ).toThrow('invalid');
    expect(() =>
      calculateWorkbench('paint', {
        ...defaults('paint'),
        openingsArea: 100,
      }),
    ).toThrow('openingsTooLarge');
  });

  it('generates five exportable office outputs and protects CSV cells', () => {
    expect(OFFICE_MODES).toHaveLength(5);
    expect(
      buildOfficeDocument('agenda', 'Opening | 10\nReview | 20', '09:00')
        .content,
    ).toContain('09:10–09:30');
    expect(
      buildOfficeDocument(
        'raci',
        '=SUM(1) | Alice | Bob | Carol | Dan',
        '09:00',
      ).content,
    ).toContain("'=SUM(1)");
    expect(
      buildOfficeDocument(
        'decisions',
        '2026-09-23 | Approve | Alice | Within budget',
        '09:00',
      ).content,
    ).toContain('Approve');
    expect(
      buildOfficeDocument('stockCount', 'SKU-1 | 20 | 18 | 12.5', '09:00')
        .summary,
    ).toBe('-25.00');
    expect(
      buildOfficeDocument('checklist', 'Inspect | Alice', '09:00').content,
    ).toContain('- [ ] 1. Inspect');
  });

  it('rejects malformed office rows and impossible dates', () => {
    expect(() =>
      buildOfficeDocument(
        'decisions',
        '2026-02-31 | Approve | Alice | Why',
        '09:00',
      ),
    ).toThrow('date');
    expect(() =>
      buildOfficeDocument('stockCount', 'SKU-1 | 20 | -1 | 12.5', '09:00'),
    ).toThrow('number');
    expect(() => buildOfficeDocument('agenda', 'Opening | 0', '09:00')).toThrow(
      'duration',
    );
  });
});
