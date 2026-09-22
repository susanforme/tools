export type Pitch = {
  frequency: number;
  midi: number;
  note: string;
  octave: number;
  cents: number;
};

const NOTES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export function describePitch(
  frequency: number,
  reference = 440,
): Pitch | null {
  if (
    !Number.isFinite(frequency) ||
    frequency <= 0 ||
    !Number.isFinite(reference) ||
    reference <= 0
  )
    return null;
  const exact = 69 + 12 * Math.log2(frequency / reference);
  const midi = Math.round(exact);
  return {
    frequency,
    midi,
    note: NOTES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    cents: (exact - midi) * 100,
  };
}

/** YIN 累积归一化差分；仅接受稳定单音，拒绝静音和低置信度输入。 */
export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  noiseFloor = 0.01,
): number | null {
  if (
    samples.length < 256 ||
    !Number.isFinite(sampleRate) ||
    sampleRate < 8000 ||
    !Number.isFinite(noiseFloor) ||
    noiseFloor < 0
  )
    return null;
  const step = Math.max(1, Math.floor(sampleRate / 24000));
  const signal = new Float32Array(Math.floor(samples.length / step));
  let mean = 0;
  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += samples[i * step + j];
    signal[i] = sum / step;
    mean += signal[i];
  }
  mean /= signal.length;
  let energy = 0;
  for (let i = 0; i < signal.length; i++) {
    signal[i] -= mean;
    energy += signal[i] * signal[i];
  }
  if (
    !Number.isFinite(energy) ||
    Math.sqrt(energy / signal.length) < noiseFloor
  )
    return null;
  const rate = sampleRate / step;
  const minLag = Math.max(2, Math.floor(rate / 1400));
  const maxLag = Math.min(
    Math.floor(rate / 50),
    Math.floor(signal.length / 2) - 1,
  );
  const windowSize = signal.length - maxLag - 1;
  const difference = new Float64Array(maxLag + 2);
  let sum = 0;
  difference[0] = 1;
  for (let lag = 1; lag <= maxLag + 1; lag++) {
    let value = 0;
    for (let i = 0; i < windowSize; i++) {
      const delta = signal[i] - signal[i + lag];
      value += delta * delta;
    }
    sum += value;
    difference[lag] = sum === 0 ? 1 : (value * lag) / sum;
  }
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (difference[lag] >= 0.12) continue;
    while (lag < maxLag && difference[lag + 1] < difference[lag]) lag++;
    const left = difference[lag - 1];
    const center = difference[lag];
    const right = difference[lag + 1];
    const curvature = left - 2 * center + right;
    const offset =
      curvature === 0
        ? 0
        : Math.max(-1, Math.min(1, (left - right) / (2 * curvature)));
    const frequency = rate / (lag + offset);
    return frequency >= 50 && frequency <= 1400 ? frequency : null;
  }
  return null;
}
