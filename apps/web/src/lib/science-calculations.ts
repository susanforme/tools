export function finiteValues(values: number[], positive: number[] = []) {
  if (
    values.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e12) ||
    positive.some((i) => !Number.isFinite(values[i]) || values[i] < 1e-12)
  )
    throw new Error('invalid');
}
export function physics(mode: string, v: number[]) {
  finiteValues(v);
  const [a, b, c] = v;
  let result: Record<string, number>;
  switch (mode) {
    case 'motion':
      if (c < 0) throw new Error('invalid');
      result = { velocity: a + b * c, distance: a * c + (b * c * c) / 2 };
      break;
    case 'force':
      if (a <= 0) throw new Error('invalid');
      result = { force: a * b };
      break;
    case 'work':
      result = { work: a * b * Math.cos((c * Math.PI) / 180) };
      break;
    case 'kinetic':
      if (a <= 0) throw new Error('invalid');
      result = { energy: (a * b * b) / 2, momentum: a * b };
      break;
    case 'potential':
      if (a <= 0 || c <= 0) throw new Error('invalid');
      result = { energy: a * b * c };
      break;
    case 'heat':
      if (a <= 0 || b <= 0) throw new Error('invalid');
      result = { heat: a * b * c };
      break;
    case 'gas':
      finiteValues(v, [0, 1, 2]);
      result = { pressure: (a * 8.31446261815324 * b) / c };
      break;
    case 'lens':
      if (a === 0 || b <= 0 || Math.abs(1 / a - 1 / b) < 1e-14)
        throw new Error('lensInfinity');
      {
        const imageDistance = 1 / (1 / a - 1 / b);
        result = { imageDistance, magnification: -imageDistance / b };
      }
      break;
    default:
      throw new Error('invalid');
  }
  if (Object.values(result).some((n) => !Number.isFinite(n)))
    throw new Error('invalid');
  return result;
}
export function photoCalculation(
  mode: string,
  v: number[],
): Record<string, number> {
  finiteValues(v);
  const [a, b, c, d] = v;
  if (mode === 'dof') {
    finiteValues(v, [0, 1, 2, 3]);
    const distance = c * 1000;
    if (distance <= a) throw new Error('invalid');
    const hyper = (a * a) / (b * d) + a;
    return {
      hyperfocal: hyper / 1000,
      near: (distance * (hyper - a)) / (hyper + distance - 2 * a) / 1000,
      far:
        distance >= hyper
          ? Infinity
          : (distance * (hyper - a)) / (hyper - distance) / 1000,
    };
  }
  if (mode === 'focal') {
    finiteValues(v, [0, 1]);
    return {
      equivalent: a * b,
      angle: (2 * Math.atan(36 / (2 * a * b)) * 180) / Math.PI,
    };
  }
  if (mode === 'nd') {
    finiteValues(v, [0]);
    if (b < 0 || b > 30) throw new Error('invalid');
    return { exposure: a * 2 ** b };
  }
  if (mode === 'exposure') {
    finiteValues(v, [0, 1, 2, 3]);
    return {
      ev: Math.log2((a * a) / b) - Math.log2(c / 100),
      newShutter: b * (d / a) ** 2,
    };
  }
  throw new Error('invalid');
}
export async function photoSun(
  date: string,
  latitude: number,
  longitude: number,
  offset: number,
) {
  finiteValues([latitude, longitude, offset]);
  if (
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    offset < -12 ||
    offset > 14 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date < '1900-01-01' ||
    date > '2100-12-31' ||
    !Number.isFinite(Date.parse(`${date}T00:00Z`)) ||
    new Date(`${date}T00:00Z`).toISOString().slice(0, 10) !== date
  )
    throw new Error('invalid');
  const sun = await import('suncalc');
  const times = sun.getTimes(
    new Date(Date.parse(`${date}T12:00Z`) - offset * 3600000),
    latitude,
    longitude,
  );
  const keys = [
    'dawn',
    'sunrise',
    'goldenHourEnd',
    'solarNoon',
    'goldenHour',
    'sunset',
    'dusk',
  ] as const;
  return {
    times: keys.map((key) => ({
      key,
      value: times[key]?.toISOString() ?? null,
    })),
    alwaysUp: times.alwaysUp,
    alwaysDown: times.alwaysDown,
  };
}
