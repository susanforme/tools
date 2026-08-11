import { describe, expect, it } from 'vitest';
import {
  applianceEnergy,
  calculateBmi,
  calculateAge,
  calculateAnnualSalaryTax,
  calculateHomeBudget,
  calculateMortgage,
  calculatePace,
  calculatePrepayment,
  calculateTravelCost,
  calculateWhtr,
  countWorkdays,
  createIcsEvent,
  dateInterval,
  futureValue,
  materialEstimate,
  purchasingPower,
  requiredMonthlySavings,
  searchWorldCities,
  slopeMetrics,
  splitBill,
  convertTemperature,
  convertShoeSize,
} from './life-calculators';

describe('life calculators', () => {
  it('calculates mortgage, BMI and temperature conversions', () => {
    expect(
      calculateMortgage(1_000_000, 30, 3, 'equal-payment').firstPayment,
    ).toBeCloseTo(4216.04, 1);
    expect(calculateBmi(65, 170)).toBeCloseTo(22.49, 1);
    expect(calculateWhtr(85, 170)).toBe(0.5);
    expect(convertTemperature(0, 'celsius', 'fahrenheit')).toBe(32);
    expect(convertTemperature(0, 'celsius', 'kelvin')).toBe(273.15);
    expect(
      calculateAge(new Date('2000-08-08'), new Date('2026-08-07')),
    ).toEqual({ years: 25, daysToBirthday: 1 });
    expect(countWorkdays(new Date('2026-08-03'), new Date('2026-08-09'))).toBe(
      5,
    );
    expect(
      dateInterval(
        new Date('2026-03-08T00:00:00-05:00'),
        new Date('2026-03-09T00:00:00-04:00'),
      ).days,
    ).toBe(1);
    expect(calculateAnnualSalaryTax(10_000, 2_000, 0).annualTax).toBe(1_080);
    expect(calculateTravelCost(500, 8, 8, 200, 2).perPerson).toBe(260);
    expect(calculatePace(10, 3_000).paceSeconds).toBe(300);
    expect(convertShoeSize(25)).toMatchObject({ cn: 250, eu: 40 });
    expect(convertShoeSize(25).us).toBeCloseTo(7.53, 1);
    expect(splitBill(100, 10, 2).perPerson).toBeCloseTo(55);
    expect(calculateHomeBudget(100, 20, 1_000, 20_000).total).toBe(100_000);
    expect(
      createIcsEvent({
        title: 'A,B',
        description: '',
        location: '',
        start: new Date('2026-08-07T00:00:00Z'),
        end: new Date('2026-08-07T01:00:00Z'),
      }),
    ).toContain('SUMMARY:A\\,B');
    expect(futureValue(0, 100, 0, 1)).toBe(1_200);
    expect(requiredMonthlySavings(1_200, 0, 0, 1)).toBe(100);
    expect(calculatePrepayment(100_000, 0, 12, 10_000).interestSaved).toBe(0);
    expect(purchasingPower(110, 10, 1)).toBeCloseTo(100);
    expect(applianceEnergy(1_000, 2, 30, 1)).toBe(60);
    expect(slopeMetrics(1, 1)).toMatchObject({ percent: 100, angle: 45 });
    expect(materialEstimate(10, 10, 3, 5)).toMatchObject({
      units: 4,
      cost: 20,
    });
    expect(searchWorldCities('美国').map(([id]) => id)).toContain('newYork');
    expect(searchWorldCities('kuala')[0]?.[0]).toBe('kualaLumpur');
    expect(searchWorldCities('阿拉斯加').map(([id]) => id)).toContain('alaska');
  });
});
