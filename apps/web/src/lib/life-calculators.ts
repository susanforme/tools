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

export type WorldCity = readonly [
  id: string,
  timeZone: string,
  zh: string,
  en: string,
  flag: string,
  keywords: string,
];

export const WORLD_CITIES = [
  ['shanghai', 'Asia/Shanghai', '上海', 'Shanghai', '🇨🇳', '中国 China'],
  ['beijing', 'Asia/Shanghai', '北京', 'Beijing', '🇨🇳', '中国 China'],
  ['hongKong', 'Asia/Hong_Kong', '香港', 'Hong Kong', '🇭🇰', '中国 China'],
  ['taipei', 'Asia/Taipei', '台北', 'Taipei', '🏙️', '中国 Taiwan'],
  ['tokyo', 'Asia/Tokyo', '东京', 'Tokyo', '🇯🇵', '日本 Japan'],
  ['seoul', 'Asia/Seoul', '首尔', 'Seoul', '🇰🇷', '韩国 South Korea'],
  [
    'singapore',
    'Asia/Singapore',
    '新加坡',
    'Singapore',
    '🇸🇬',
    '新加坡 Singapore',
  ],
  ['bangkok', 'Asia/Bangkok', '曼谷', 'Bangkok', '🇹🇭', '泰国 Thailand'],
  ['jakarta', 'Asia/Jakarta', '雅加达', 'Jakarta', '🇮🇩', '印尼 Indonesia'],
  [
    'kualaLumpur',
    'Asia/Kuala_Lumpur',
    '吉隆坡',
    'Kuala Lumpur',
    '🇲🇾',
    '马来西亚 Malaysia',
  ],
  ['manila', 'Asia/Manila', '马尼拉', 'Manila', '🇵🇭', '菲律宾 Philippines'],
  [
    'hoChiMinh',
    'Asia/Ho_Chi_Minh',
    '胡志明市',
    'Ho Chi Minh City',
    '🇻🇳',
    '越南 Vietnam 西贡 Saigon',
  ],
  ['newDelhi', 'Asia/Kolkata', '新德里', 'New Delhi', '🇮🇳', '印度 India'],
  ['mumbai', 'Asia/Kolkata', '孟买', 'Mumbai', '🇮🇳', '印度 India Bombay'],
  ['karachi', 'Asia/Karachi', '卡拉奇', 'Karachi', '🇵🇰', '巴基斯坦 Pakistan'],
  ['dhaka', 'Asia/Dhaka', '达卡', 'Dhaka', '🇧🇩', '孟加拉 Bangladesh'],
  [
    'kathmandu',
    'Asia/Kathmandu',
    '加德满都',
    'Kathmandu',
    '🇳🇵',
    '尼泊尔 Nepal',
  ],
  ['dubai', 'Asia/Dubai', '迪拜', 'Dubai', '🇦🇪', '阿联酋 UAE Emirates'],
  ['riyadh', 'Asia/Riyadh', '利雅得', 'Riyadh', '🇸🇦', '沙特 Saudi Arabia'],
  ['doha', 'Asia/Qatar', '多哈', 'Doha', '🇶🇦', '卡塔尔 Qatar'],
  [
    'jerusalem',
    'Asia/Jerusalem',
    '耶路撒冷',
    'Jerusalem',
    '🇮🇱',
    '以色列 Israel',
  ],
  [
    'istanbul',
    'Europe/Istanbul',
    '伊斯坦布尔',
    'Istanbul',
    '🇹🇷',
    '土耳其 Turkey',
  ],
  ['london', 'Europe/London', '伦敦', 'London', '🇬🇧', '英国 UK Britain'],
  ['dublin', 'Europe/Dublin', '都柏林', 'Dublin', '🇮🇪', '爱尔兰 Ireland'],
  ['lisbon', 'Europe/Lisbon', '里斯本', 'Lisbon', '🇵🇹', '葡萄牙 Portugal'],
  ['paris', 'Europe/Paris', '巴黎', 'Paris', '🇫🇷', '法国 France'],
  ['berlin', 'Europe/Berlin', '柏林', 'Berlin', '🇩🇪', '德国 Germany'],
  ['madrid', 'Europe/Madrid', '马德里', 'Madrid', '🇪🇸', '西班牙 Spain'],
  ['rome', 'Europe/Rome', '罗马', 'Rome', '🇮🇹', '意大利 Italy'],
  [
    'amsterdam',
    'Europe/Amsterdam',
    '阿姆斯特丹',
    'Amsterdam',
    '🇳🇱',
    '荷兰 Netherlands Holland',
  ],
  [
    'brussels',
    'Europe/Brussels',
    '布鲁塞尔',
    'Brussels',
    '🇧🇪',
    '比利时 Belgium',
  ],
  ['zurich', 'Europe/Zurich', '苏黎世', 'Zurich', '🇨🇭', '瑞士 Switzerland'],
  ['vienna', 'Europe/Vienna', '维也纳', 'Vienna', '🇦🇹', '奥地利 Austria'],
  ['prague', 'Europe/Prague', '布拉格', 'Prague', '🇨🇿', '捷克 Czechia'],
  ['warsaw', 'Europe/Warsaw', '华沙', 'Warsaw', '🇵🇱', '波兰 Poland'],
  [
    'stockholm',
    'Europe/Stockholm',
    '斯德哥尔摩',
    'Stockholm',
    '🇸🇪',
    '瑞典 Sweden',
  ],
  ['oslo', 'Europe/Oslo', '奥斯陆', 'Oslo', '🇳🇴', '挪威 Norway'],
  [
    'copenhagen',
    'Europe/Copenhagen',
    '哥本哈根',
    'Copenhagen',
    '🇩🇰',
    '丹麦 Denmark',
  ],
  ['helsinki', 'Europe/Helsinki', '赫尔辛基', 'Helsinki', '🇫🇮', '芬兰 Finland'],
  ['athens', 'Europe/Athens', '雅典', 'Athens', '🇬🇷', '希腊 Greece'],
  ['moscow', 'Europe/Moscow', '莫斯科', 'Moscow', '🇷🇺', '俄罗斯 Russia'],
  ['kyiv', 'Europe/Kyiv', '基辅', 'Kyiv', '🇺🇦', '乌克兰 Ukraine Kiev'],
  ['newYork', 'America/New_York', '纽约', 'New York', '🇺🇸', '美国 USA US'],
  ['chicago', 'America/Chicago', '芝加哥', 'Chicago', '🇺🇸', '美国 USA US'],
  ['denver', 'America/Denver', '丹佛', 'Denver', '🇺🇸', '美国 USA US'],
  [
    'losAngeles',
    'America/Los_Angeles',
    '洛杉矶',
    'Los Angeles',
    '🇺🇸',
    '美国 USA US LA',
  ],
  ['seattle', 'America/Los_Angeles', '西雅图', 'Seattle', '🇺🇸', '美国 USA US'],
  [
    'honolulu',
    'Pacific/Honolulu',
    '檀香山',
    'Honolulu',
    '🇺🇸',
    '美国 夏威夷 Hawaii',
  ],
  [
    'anchorage',
    'America/Anchorage',
    '安克雷奇',
    'Anchorage',
    '🇺🇸',
    '美国 阿拉斯加 Alaska',
  ],
  [
    'alaska',
    'America/Anchorage',
    '阿拉斯加',
    'Alaska',
    '🇺🇸',
    '美国 USA US 安克雷奇 Anchorage',
  ],
  ['toronto', 'America/Toronto', '多伦多', 'Toronto', '🇨🇦', '加拿大 Canada'],
  [
    'vancouver',
    'America/Vancouver',
    '温哥华',
    'Vancouver',
    '🇨🇦',
    '加拿大 Canada',
  ],
  [
    'mexicoCity',
    'America/Mexico_City',
    '墨西哥城',
    'Mexico City',
    '🇲🇽',
    '墨西哥 Mexico',
  ],
  [
    'panamaCity',
    'America/Panama',
    '巴拿马城',
    'Panama City',
    '🇵🇦',
    '巴拿马 Panama',
  ],
  [
    'bogota',
    'America/Bogota',
    '波哥大',
    'Bogotá',
    '🇨🇴',
    '哥伦比亚 Colombia Bogota',
  ],
  ['lima', 'America/Lima', '利马', 'Lima', '🇵🇪', '秘鲁 Peru'],
  [
    'caracas',
    'America/Caracas',
    '加拉加斯',
    'Caracas',
    '🇻🇪',
    '委内瑞拉 Venezuela',
  ],
  ['santiago', 'America/Santiago', '圣地亚哥', 'Santiago', '🇨🇱', '智利 Chile'],
  [
    'buenosAires',
    'America/Argentina/Buenos_Aires',
    '布宜诺斯艾利斯',
    'Buenos Aires',
    '🇦🇷',
    '阿根廷 Argentina',
  ],
  [
    'saoPaulo',
    'America/Sao_Paulo',
    '圣保罗',
    'São Paulo',
    '🇧🇷',
    '巴西 Brazil Sao Paulo',
  ],
  ['cairo', 'Africa/Cairo', '开罗', 'Cairo', '🇪🇬', '埃及 Egypt'],
  [
    'casablanca',
    'Africa/Casablanca',
    '卡萨布兰卡',
    'Casablanca',
    '🇲🇦',
    '摩洛哥 Morocco',
  ],
  ['lagos', 'Africa/Lagos', '拉各斯', 'Lagos', '🇳🇬', '尼日利亚 Nigeria'],
  ['nairobi', 'Africa/Nairobi', '内罗毕', 'Nairobi', '🇰🇪', '肯尼亚 Kenya'],
  [
    'johannesburg',
    'Africa/Johannesburg',
    '约翰内斯堡',
    'Johannesburg',
    '🇿🇦',
    '南非 South Africa',
  ],
  ['sydney', 'Australia/Sydney', '悉尼', 'Sydney', '🇦🇺', '澳大利亚 Australia'],
  [
    'melbourne',
    'Australia/Melbourne',
    '墨尔本',
    'Melbourne',
    '🇦🇺',
    '澳大利亚 Australia',
  ],
  [
    'brisbane',
    'Australia/Brisbane',
    '布里斯班',
    'Brisbane',
    '🇦🇺',
    '澳大利亚 Australia',
  ],
  ['perth', 'Australia/Perth', '珀斯', 'Perth', '🇦🇺', '澳大利亚 Australia'],
  [
    'auckland',
    'Pacific/Auckland',
    '奥克兰',
    'Auckland',
    '🇳🇿',
    '新西兰 New Zealand',
  ],
  ['suva', 'Pacific/Fiji', '苏瓦', 'Suva', '🇫🇯', '斐济 Fiji'],
] as const satisfies readonly WorldCity[];

export const DEFAULT_WORLD_CITY_IDS = [
  'shanghai',
  'tokyo',
  'singapore',
  'dubai',
  'london',
  'paris',
  'moscow',
  'newYork',
];

export function searchWorldCities(query: string): readonly WorldCity[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return WORLD_CITIES;
  return WORLD_CITIES.filter((city) =>
    city.join(' ').toLocaleLowerCase().includes(normalized),
  );
}

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
