export type AudioOptions = {
  normalize: boolean;
  peakDb: number;
  fadeIn: number;
  fadeOut: number;
  speed: number;
  channels: string;
  silenceDb: number;
  minSilence: number;
};
export type AudioTask = {
  channels: Float32Array[];
  sampleRate: number;
  options: AudioOptions;
};
export function processAudio({ channels, sampleRate, options: o }: AudioTask) {
  const length = channels[0]?.length ?? 0;
  if (
    !length ||
    channels.length > 2 ||
    !channels.every((c) => c.length === length) ||
    length * channels.length > 60_000_000 ||
    !Number.isFinite(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 192000 ||
    ![o.peakDb, o.fadeIn, o.fadeOut, o.speed, o.silenceDb, o.minSilence].every(
      Number.isFinite,
    ) ||
    o.speed < 0.25 ||
    o.speed > 4 ||
    o.peakDb > 0 ||
    o.peakDb < -30 ||
    o.fadeIn < 0 ||
    o.fadeOut < 0 ||
    o.fadeIn + o.fadeOut > length / sampleRate ||
    o.silenceDb > 0 ||
    o.silenceDb < -100 ||
    o.minSilence < 0.02 ||
    !['keep', 'mono', 'left', 'right', 'swap'].includes(o.channels)
  )
    throw new Error('invalid');
  const selected =
    o.channels === 'mono'
      ? [
          Float32Array.from(
            channels[0],
            (_, i) => channels.reduce((n, c) => n + c[i], 0) / channels.length,
          ),
        ]
      : o.channels === 'left'
        ? [channels[0]]
        : o.channels === 'right'
          ? [channels.at(-1)!]
          : o.channels === 'swap'
            ? [...channels].reverse()
            : channels;
  let peak = 0;
  for (const channel of selected)
    for (const sample of channel) {
      if (!Number.isFinite(sample)) throw new Error('invalid');
      peak = Math.max(peak, Math.abs(sample));
    }
  const gain = o.normalize && peak > 0 ? 10 ** (o.peakDb / 20) / peak : 1,
    size = Math.floor(length / o.speed),
    output = selected.map(() => new Float32Array(size));
  if (size * output.length > 60_000_000) throw new Error('limit');
  for (let i = 0; i < size; i++) {
    const pos = i * o.speed,
      base = Math.floor(pos),
      frac = pos - base,
      seconds = pos / sampleRate;
    const envelope = Math.min(
      1,
      o.fadeIn ? seconds / o.fadeIn : 1,
      o.fadeOut ? (length / sampleRate - seconds) / o.fadeOut : 1,
    );
    for (let c = 0; c < selected.length; c++)
      output[c][i] = Math.max(
        -1,
        Math.min(
          1,
          (selected[c][base] * (1 - frac) +
            selected[c][Math.min(base + 1, length - 1)] * frac) *
            gain *
            envelope,
        ),
      );
  }
  const silence: Array<{ start: number; end: number }> = [],
    window = Math.max(1, Math.round(sampleRate * 0.02)),
    threshold = 10 ** (o.silenceDb / 20);
  let start = -1;
  for (let i = 0; i < length; i += window) {
    const end = Math.min(length, i + window);
    let sum = 0;
    for (const channel of selected)
      for (let j = i; j < end; j++) sum += channel[j] ** 2;
    const quiet = Math.sqrt(sum / ((end - i) * selected.length)) <= threshold;
    if (quiet && start < 0) start = i;
    if (start >= 0 && (!quiet || end === length)) {
      const stop = quiet ? end : i;
      if ((stop - start) / sampleRate >= o.minSilence)
        silence.push({ start: start / sampleRate, end: stop / sampleRate });
      start = -1;
    }
  }
  return {
    wav: audioWav(output, sampleRate),
    silence,
    duration: size / sampleRate,
    peakDb: peak ? 20 * Math.log10(peak) : null,
  };
}
export function audioWav(
  channels: Float32Array[],
  sampleRate: number,
): Uint8Array {
  const samples = channels[0].length,
    count = channels.length,
    size = samples * count * 2,
    bytes = new Uint8Array(44 + size),
    view = new DataView(bytes.buffer);
  const ascii = (at: number, s: string) =>
    Array.from(s).forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + size, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, count, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * count * 2, true);
  view.setUint16(32, count * 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, size, true);
  for (let i = 0; i < samples; i++)
    for (let c = 0; c < count; c++) {
      const value = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(
        44 + (i * count + c) * 2,
        value * (value < 0 ? 32768 : 32767),
        true,
      );
    }
  return bytes;
}
