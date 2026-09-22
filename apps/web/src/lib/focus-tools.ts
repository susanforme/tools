export function boundedNumber(
  value: number | null | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function remainingTime(
  deadline: number | null,
  paused: number,
  now: number,
): number {
  return Math.max(0, deadline === null ? paused : deadline - now);
}

export function formatClock(milliseconds: number, roundUp = false): string {
  const seconds = Math.max(
    0,
    (roundUp ? Math.ceil : Math.floor)(milliseconds / 1000),
  );
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export const SOUND_TRACKS = [
  'rain',
  'wind',
  'cafe',
  'white',
  'pink',
  'brown',
] as const;
export type SoundTrack = (typeof SOUND_TRACKS)[number];
export type SoundLevels = Record<SoundTrack, number>;
export const DEFAULT_LEVELS: SoundLevels = {
  rain: 40,
  wind: 0,
  cafe: 0,
  white: 0,
  pink: 0,
  brown: 0,
};

export function parseMix(value: unknown): SoundLevels | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (
    !SOUND_TRACKS.every(
      (key) =>
        typeof record[key] === 'number' &&
        Number.isFinite(record[key]) &&
        record[key] >= 0 &&
        record[key] <= 100,
    )
  )
    return null;
  return Object.fromEntries(
    SOUND_TRACKS.map((key) => [key, record[key]]),
  ) as SoundLevels;
}

export function createNoiseSamples(
  kind: 'white' | 'pink' | 'brown',
  length: number,
  random: () => number = Math.random,
): Float32Array<ArrayBuffer> {
  const samples = new Float32Array(length);
  let brown = 0;
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let index = 0; index < length; index++) {
    const white = random() * 2 - 1;
    if (kind === 'brown') {
      brown = (brown + 0.02 * white) / 1.02;
      samples[index] = brown * 3.5;
    } else if (kind === 'pink') {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      samples[index] =
        (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    } else samples[index] = white;
  }
  // 循环接缝短淡入淡出，避免噪音缓存边缘产生爆音。
  const fade = Math.min(128, Math.floor(length / 2));
  for (let index = 0; index < fade; index++) {
    samples[index] *= index / fade;
    samples[length - 1 - index] *= index / fade;
  }
  return samples;
}
