import { describe, expect, it } from 'vitest';
import {
  calculateBmi,
  calculateMortgage,
  calculateWhtr,
  convertTemperature,
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
  });
});
