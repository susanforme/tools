export const RESISTOR_COLORS = [
  ['black', '#111827'],
  ['brown', '#92400e'],
  ['red', '#dc2626'],
  ['orange', '#f97316'],
  ['yellow', '#facc15'],
  ['green', '#16a34a'],
  ['blue', '#2563eb'],
  ['violet', '#9333ea'],
  ['gray', '#9ca3af'],
  ['white', '#fff'],
  ['gold', '#d4af37'],
  ['silver', '#c0c0c0'],
] as const;
export const TOLERANCE: Record<number, number> = {
  1: 1,
  2: 2,
  5: 0.5,
  6: 0.25,
  7: 0.1,
  8: 0.05,
  10: 5,
  11: 10,
};
export const TEMPERATURE: Record<number, number> = {
  0: 250,
  1: 100,
  2: 50,
  3: 15,
  4: 25,
  5: 20,
  6: 10,
  7: 5,
  8: 1,
};
export function decodeBands(bands: number[]) {
  if (![4, 5, 6].includes(bands.length)) throw new Error('invalid');
  const digits = bands.length === 4 ? 2 : 3;
  if (
    bands
      .slice(0, digits)
      .some(
        (n, i) =>
          !Number.isInteger(n) || n < 0 || n > 9 || (i === 0 && n === 0),
      ) ||
    !Number.isInteger(bands[digits]) ||
    bands[digits] < 0 ||
    bands[digits] > 11 ||
    TOLERANCE[bands[digits + 1]] === undefined ||
    (bands.length === 6 && TEMPERATURE[bands[5]] === undefined)
  )
    throw new Error('invalid');
  const power =
    bands[digits] === 10 ? -1 : bands[digits] === 11 ? -2 : bands[digits];
  const value = Number(bands.slice(0, digits).join('')) * 10 ** power;
  return {
    value,
    tolerance: TOLERANCE[bands[digits + 1]],
    temperature: bands.length === 6 ? TEMPERATURE[bands[5]] : null,
  };
}
export function encodeBands(
  value: number,
  count: number,
  tolerance = 10,
): number[] {
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    ![4, 5, 6].includes(count) ||
    TOLERANCE[tolerance] === undefined
  )
    throw new Error('invalid');
  const digits = count === 4 ? 2 : 3,
    power = Math.floor(Math.log10(value)) - digits + 1,
    significant = value / 10 ** power;
  if (
    power < -2 ||
    power > 9 ||
    Math.abs(significant - Math.round(significant)) > 1e-7
  )
    throw new Error('resistorRange');
  return [
    ...String(Math.round(significant)).split('').map(Number),
    power === -1 ? 10 : power === -2 ? 11 : power,
    tolerance,
    ...(count === 6 ? [1] : []),
  ];
}
export function decodeSmd(source: string): number {
  const value = source.trim().toUpperCase();
  if (/^0{1,4}$/.test(value)) return 0;
  if (/^\d*R\d+$/.test(value) && value.length <= 6)
    return Number(value.replace('R', '.'));
  if (/^\d{3,4}$/.test(value))
    return Number(value.slice(0, -1)) * 10 ** Number(value.at(-1));
  throw new Error('invalid');
}
export type ClockState = {
  remaining: [number, number];
  active: 0 | 1;
  running: boolean;
  started: number;
  delayLeft: number;
  moves: [number, number];
};
export function clockRemaining(
  state: ClockState,
  now: number,
): [number, number] {
  const values: [number, number] = [...state.remaining];
  if (state.running)
    values[state.active] = Math.max(
      0,
      values[state.active] - Math.max(0, now - state.started - state.delayLeft),
    );
  return values;
}
export function switchClock(
  state: ClockState,
  now: number,
  increment: number,
  delay: number,
): ClockState {
  const remaining = clockRemaining(state, now);
  if (!state.running || remaining[state.active] <= 0)
    return { ...state, remaining, running: false };
  remaining[state.active] += increment;
  const moves: [number, number] = [...state.moves];
  moves[state.active]++;
  return {
    remaining,
    active: state.active === 0 ? 1 : 0,
    running: true,
    started: now,
    delayLeft: delay,
    moves,
  };
}
