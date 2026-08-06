export type ContributionRate = {
  employer: number;
  personal: number;
};

export type SocialRates = {
  housing: ContributionRate;
  injury: ContributionRate;
  maternity: ContributionRate;
  medical: ContributionRate;
  medicalPersonalFixed: number;
  pension: ContributionRate;
  unemployment: ContributionRate;
};

export type SocialContributionKey = Exclude<
  keyof SocialRates,
  'medicalPersonalFixed'
>;

export const SOCIAL_CONTRIBUTION_KEYS = [
  'pension',
  'medical',
  'unemployment',
  'injury',
  'maternity',
  'housing',
] as const satisfies readonly SocialContributionKey[];

export function calculateSocialInsurance(
  socialBase: number,
  housingBase: number,
  rates: SocialRates,
) {
  const rows = SOCIAL_CONTRIBUTION_KEYS.map((key) => {
    const base = key === 'housing' ? housingBase : socialBase;
    const personal =
      (base * rates[key].personal) / 100 +
      (key === 'medical' ? rates.medicalPersonalFixed : 0);
    return {
      key,
      employer: (base * rates[key].employer) / 100,
      personal,
    };
  });
  return {
    rows,
    employerTotal: rows.reduce((sum, row) => sum + row.employer, 0),
    personalTotal: rows.reduce((sum, row) => sum + row.personal, 0),
  };
}

export type MortgageMethod = 'equal-payment' | 'equal-principal';

export function calculateMortgage(
  principal: number,
  years: number,
  annualRate: number,
  method: MortgageMethod,
) {
  const months = Math.max(1, Math.round(years * 12));
  const rate = annualRate / 1200;
  if (method === 'equal-principal') {
    const principalPerMonth = principal / months;
    const firstPayment = principalPerMonth + principal * rate;
    const monthlyDecrease = principalPerMonth * rate;
    const totalInterest = (principal * rate * (months + 1)) / 2;
    return {
      firstPayment,
      monthlyDecrease,
      months,
      totalInterest,
      totalPayment: principal + totalInterest,
    };
  }

  const factor = (1 + rate) ** months;
  const firstPayment =
    rate === 0
      ? principal / months
      : (principal * rate * factor) / (factor - 1);
  const totalPayment = firstPayment * months;
  return {
    firstPayment,
    monthlyDecrease: 0,
    months,
    totalInterest: totalPayment - principal,
    totalPayment,
  };
}

export function calculateBmi(weightKg: number, heightCm: number): number {
  return weightKg / (heightCm / 100) ** 2;
}

export function calculateWhtr(waistCm: number, heightCm: number): number {
  return waistCm / heightCm;
}

export type TemperatureUnit = 'celsius' | 'fahrenheit' | 'kelvin';

export function convertTemperature(
  value: number,
  from: TemperatureUnit,
  to: TemperatureUnit,
): number {
  const celsius =
    from === 'celsius'
      ? value
      : from === 'fahrenheit'
        ? ((value - 32) * 5) / 9
        : value - 273.15;
  return to === 'celsius'
    ? celsius
    : to === 'fahrenheit'
      ? (celsius * 9) / 5 + 32
      : celsius + 273.15;
}

export function isValidTemperature(
  value: number,
  unit: TemperatureUnit,
): boolean {
  return convertTemperature(value, unit, 'kelvin') >= 0;
}
