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

export const COMMON_CITIES = [
  ['shanghai', 'Asia/Shanghai'],
  ['tokyo', 'Asia/Tokyo'],
  ['singapore', 'Asia/Singapore'],
  ['dubai', 'Asia/Dubai'],
  ['london', 'Europe/London'],
  ['paris', 'Europe/Paris'],
  ['moscow', 'Europe/Moscow'],
  ['newYork', 'America/New_York'],
  ['losAngeles', 'America/Los_Angeles'],
  ['saoPaulo', 'America/Sao_Paulo'],
  ['sydney', 'Australia/Sydney'],
  ['auckland', 'Pacific/Auckland'],
] as const;

export function calculateAge(birthDate: Date, referenceDate: Date) {
  let years = referenceDate.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    referenceDate.getMonth() < birthDate.getMonth() ||
    (referenceDate.getMonth() === birthDate.getMonth() &&
      referenceDate.getDate() < birthDate.getDate());
  if (beforeBirthday) years -= 1;
  const nextBirthday = new Date(
    referenceDate.getFullYear() + (beforeBirthday ? 0 : 1),
    birthDate.getMonth(),
    birthDate.getDate(),
  );
  return {
    years: Math.max(0, years),
    daysToBirthday: Math.max(
      0,
      Math.ceil(
        (nextBirthday.getTime() - referenceDate.getTime()) / 86_400_000,
      ),
    ),
  };
}

export function dateInterval(start: Date, end: Date) {
  const milliseconds =
    Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
    Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  return {
    milliseconds,
    days: Math.floor(Math.abs(milliseconds) / 86_400_000),
    hours: Math.floor(Math.abs(milliseconds) / 3_600_000),
  };
}

export function countWorkdays(start: Date, end: Date): number {
  const from = new Date(Math.min(start.getTime(), end.getTime()));
  const to = new Date(Math.max(start.getTime(), end.getTime()));
  from.setHours(12, 0, 0, 0);
  to.setHours(12, 0, 0, 0);
  let count = 0;
  for (
    const cursor = from;
    cursor <= to;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

const TAX_BRACKETS = [
  [36_000, 0.03, 0],
  [144_000, 0.1, 2_520],
  [300_000, 0.2, 16_920],
  [420_000, 0.25, 31_920],
  [660_000, 0.3, 52_920],
  [960_000, 0.35, 85_920],
  [Number.POSITIVE_INFINITY, 0.45, 181_920],
] as const;

export function calculateAnnualSalaryTax(
  monthlyGross: number,
  monthlySocial: number,
  monthlySpecialDeduction: number,
) {
  const annualGross = monthlyGross * 12;
  const taxable = Math.max(
    0,
    annualGross - 60_000 - (monthlySocial + monthlySpecialDeduction) * 12,
  );
  const bracket =
    TAX_BRACKETS.find(([limit]) => taxable <= limit) ?? TAX_BRACKETS.at(-1)!;
  const annualTax = Math.max(0, taxable * bracket[1] - bracket[2]);
  return {
    annualGross,
    taxable,
    annualTax,
    monthlyTax: annualTax / 12,
    monthlyNet: monthlyGross - monthlySocial - annualTax / 12,
  };
}

export function calculateTravelCost(
  distanceKm: number,
  consumptionPer100Km: number,
  unitPrice: number,
  fixedCosts: number,
  people: number,
) {
  const energyCost = (distanceKm / 100) * consumptionPer100Km * unitPrice;
  const total = energyCost + fixedCosts;
  return { energyCost, total, perPerson: total / Math.max(1, people) };
}

export function calculatePace(distanceKm: number, seconds: number) {
  const safeSeconds = Math.max(seconds, 1);
  const paceSeconds = safeSeconds / Math.max(distanceKm, 0.001);
  return {
    paceSeconds,
    speedKmh: distanceKm / (safeSeconds / 3600),
  };
}

export function scaleRecipe(
  value: number,
  originalServings: number,
  targetServings: number,
) {
  return (value * targetServings) / Math.max(1, originalServings);
}

export function convertShoeSize(footLengthCm: number) {
  const inches = footLengthCm / 2.54;
  return {
    cn: Math.round(footLengthCm * 10),
    eu: Math.round((footLengthCm + 1.5) * 1.5),
    us: 3 * inches - 22,
    uk: 3 * inches - 23,
  };
}

export function splitBill(amount: number, tipPercent: number, people: number) {
  const tip = (amount * tipPercent) / 100;
  const total = amount + tip;
  return { tip, total, perPerson: total / Math.max(1, people) };
}

export function calculateHomeBudget(
  grossArea: number,
  sharedRate: number,
  renovationPerSquareMeter: number,
  fixedCosts: number,
) {
  const sharedArea = (grossArea * Math.min(100, Math.max(0, sharedRate))) / 100;
  const usableArea = grossArea - sharedArea;
  const renovation = usableArea * renovationPerSquareMeter;
  return { sharedArea, usableArea, renovation, total: renovation + fixedCosts };
}

function escapeIcs(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;');
}

function icsDate(value: Date): string {
  return value
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

export function createIcsEvent(input: {
  title: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
}): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Breeze Tools//ICS Event//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@breeze-tools`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(input.start)}`,
    `DTEND:${icsDate(input.end)}`,
    `SUMMARY:${escapeIcs(input.title)}`,
    `DESCRIPTION:${escapeIcs(input.description)}`,
    `LOCATION:${escapeIcs(input.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function futureValue(
  initial: number,
  monthlyContribution: number,
  annualRate: number,
  years: number,
): number {
  const months = Math.max(0, Math.round(years * 12));
  const rate = annualRate / 1200;
  if (rate === 0) return initial + monthlyContribution * months;
  const factor = (1 + rate) ** months;
  return initial * factor + monthlyContribution * ((factor - 1) / rate);
}

export function requiredMonthlySavings(
  target: number,
  current: number,
  annualRate: number,
  years: number,
): number {
  const months = Math.max(1, Math.round(years * 12));
  const rate = annualRate / 1200;
  const remaining = Math.max(
    0,
    target - current * (rate === 0 ? 1 : (1 + rate) ** months),
  );
  return rate === 0
    ? remaining / months
    : (remaining * rate) / ((1 + rate) ** months - 1);
}

export function calculatePrepayment(
  principal: number,
  annualRate: number,
  months: number,
  prepayment: number,
) {
  const count = Math.max(1, Math.round(months));
  const rate = annualRate / 1200;
  const payment = (amount: number) => {
    if (rate === 0) return amount / count;
    const factor = (1 + rate) ** count;
    return (amount * rate * factor) / (factor - 1);
  };
  const remaining = Math.max(0, principal - prepayment);
  const before = payment(principal);
  const after = payment(remaining);
  return {
    before,
    after,
    interestSaved: Math.max(
      0,
      before * count - principal - (after * count - remaining),
    ),
  };
}

export function purchasingPower(
  amount: number,
  annualInflation: number,
  years: number,
): number {
  return amount / (1 + annualInflation / 100) ** Math.max(0, years);
}

export function applianceEnergy(
  watts: number,
  hoursPerDay: number,
  days: number,
  count: number,
): number {
  return (watts * hoursPerDay * days * count) / 1000;
}

export function slopeMetrics(rise: number, run: number) {
  const ratio = rise / Math.max(run, 0.0001);
  return { percent: ratio * 100, angle: (Math.atan(ratio) * 180) / Math.PI };
}

export function materialEstimate(
  area: number,
  lossPercent: number,
  coveragePerUnit: number,
  unitPrice: number,
) {
  const requiredArea = area * (1 + lossPercent / 100);
  const units = Math.ceil(requiredArea / Math.max(coveragePerUnit, 0.0001));
  return { requiredArea, units, cost: units * unitPrice };
}
