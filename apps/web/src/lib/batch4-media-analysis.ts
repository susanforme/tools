export type GcodeSegment = {
  from: [number, number, number];
  to: [number, number, number];
  extrusion: number;
  speed: number;
};
export type GcodeResult = {
  segments: GcodeSegment[];
  layers: number[];
  filament: number;
  seconds: number;
  travel: number;
};
export function parseGcode(source: string): GcodeResult {
  if (!source.trim() || source.length > 20_000_000) throw new Error('limit');
  let position: [number, number, number] = [0, 0, 0],
    absolute = true,
    extruderAbsolute = true,
    unit = 1,
    feed = 1500,
    e = 0;
  const coordinateOffset: [number, number, number] = [0, 0, 0];
  const segments: GcodeSegment[] = [];
  let filament = 0,
    extruded = 0,
    seconds = 0,
    travel = 0;
  const layerSet = new Set<number>();
  // ponytail: feed-rate estimates omit acceleration and warmup; use firmware motion simulation for machine-specific accuracy.
  const append = (next: [number, number, number], extrusion: number) => {
    const distance = Math.hypot(...next.map((v, i) => v - position[i]!));
    if (segments.length >= 200_000) throw new Error('limit');
    if (distance > 0) {
      segments.push({
        from: [...position],
        to: next,
        extrusion,
        speed: feed / 60,
      });
      if (extrusion > 0) layerSet.add(Math.round(next[2] * 1000) / 1000);
      else travel += distance;
    }
    extruded += extrusion;
    filament = Math.max(filament, extruded);
    seconds += ((distance || Math.abs(extrusion)) / feed) * 60;
    position = next;
  };
  for (const raw of source.split(/\r?\n/)) {
    const line = raw
      .replace(/\([^)]*\)/g, '')
      .split(';')[0]!
      .split('*')[0]!
      .trim()
      .toUpperCase();
    const words = [
      ...line.matchAll(/([A-Z])\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+))/g),
    ];
    const command = words.find(
      ([, _key]) => _key === 'G' || _key === 'M' || _key === 'T',
    );
    if (!command) continue;
    const code = command[1] + String(Number(command[2]));
    const values: Record<string, number> = {};
    for (const [, key, value] of words) values[key!] = Number(value);
    if (
      Object.values(values).some(
        (n) => !Number.isFinite(n) || Math.abs(n) > 1e8,
      )
    )
      throw new Error('invalid');
    if (code === 'G20') unit = 25.4;
    else if (code === 'G21') unit = 1;
    else if (code === 'G90') absolute = true;
    else if (code === 'G91') absolute = false;
    else if (code === 'M82') extruderAbsolute = true;
    else if (code === 'M83') extruderAbsolute = false;
    else if (code === 'G92') {
      for (const [i, k] of ['X', 'Y', 'Z'].entries())
        if (values[k] !== undefined)
          coordinateOffset[i] = position[i]! - values[k]! * unit;
      if (values.E !== undefined) e = values.E * unit;
    } else if (code === 'M200' && values.D !== 0) throw new Error('extruder');
    else if (code === 'G17') {
    } else if (code === 'G18' || code === 'G19') throw new Error('arc');
    else if (code === 'G28') {
      const axes = ['X', 'Y', 'Z'];
      const specified = axes.some((k) => line.includes(k));
      axes.forEach((k, i) => {
        if (!specified || line.includes(k)) {
          position[i] = 0;
          coordinateOffset[i] = 0;
        }
      });
    } else if (code === 'G4')
      seconds += (values.S ?? 0) + (values.P ?? 0) / 1000;
    else if (['G0', 'G1', 'G2', 'G3'].includes(code)) {
      if (values.F !== undefined) {
        if (values.F <= 0) throw new Error('invalid');
        feed = values.F * unit;
      }
      const next = position.map((p, i) =>
        values['XYZ'[i]!] === undefined
          ? p
          : (absolute ? coordinateOffset[i]! : p) + values['XYZ'[i]!]! * unit,
      ) as [number, number, number];
      const nextE =
          values.E === undefined
            ? e
            : (extruderAbsolute ? 0 : e) + values.E * unit,
        extrusion = nextE - e;
      e = nextE;
      if (code === 'G2' || code === 'G3') {
        if (
          values.R !== undefined ||
          (values.I === undefined && values.J === undefined)
        )
          throw new Error('arc');
        const start = [...position],
          cx = start[0]! + (values.I ?? 0) * unit,
          cy = start[1]! + (values.J ?? 0) * unit;
        const radius = Math.hypot(start[0]! - cx, start[1]! - cy);
        if (
          radius <= 0 ||
          Math.abs(Math.hypot(next[0] - cx, next[1] - cy) - radius) > 0.1
        )
          throw new Error('arc');
        const a = Math.atan2(start[1]! - cy, start[0]! - cx);
        let sweep = Math.atan2(next[1] - cy, next[0] - cx) - a;
        if (code === 'G2' && sweep >= 0) sweep -= 2 * Math.PI;
        if (code === 'G3' && sweep <= 0) sweep += 2 * Math.PI;
        const count = Math.max(2, Math.ceil((Math.abs(sweep) * radius) / 0.5));
        if (count > 200_000) throw new Error('limit');
        for (let i = 1; i <= count; i++) {
          const angle = a + (sweep * i) / count;
          append(
            i === count
              ? next
              : [
                  cx + radius * Math.cos(angle),
                  cy + radius * Math.sin(angle),
                  start[2]! + ((next[2] - start[2]!) * i) / count,
                ],
            extrusion / count,
          );
        }
      } else append(next, extrusion);
    } else if (/^T\d+$/.test(code) && code !== 'T0')
      throw new Error('extruder');
  }
  if (!segments.length) throw new Error('invalid');
  return {
    segments,
    layers: [...layerSet].sort((a, b) => a - b),
    filament,
    seconds,
    travel,
  };
}
export type AudioAnalysis = {
  duration: number;
  rmsDb: number | null;
  peakDb: number | null;
  clipped: number;
  correlation: number | null;
  frequencies: number[];
  spectrum: number[];
  spectrogram: number[][];
  sampleRate: number;
};
function powers(samples: Float32Array, start: number, size: number): number[] {
  const real = new Float64Array(size),
    imag = new Float64Array(size);
  for (let i = 0; i < size; i++)
    real[i] =
      (samples[start + i] ?? 0) *
      (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [real[i], real[j]] = [real[j]!, real[i]!];
  }
  for (let len = 2; len <= size; len *= 2) {
    const angle = (-2 * Math.PI) / len;
    for (let i = 0; i < size; i += len)
      for (let j = 0; j < len / 2; j++) {
        const cos = Math.cos(angle * j),
          sin = Math.sin(angle * j),
          k = i + j + len / 2;
        const re = real[k]! * cos - imag[k]! * sin,
          im = real[k]! * sin + imag[k]! * cos;
        real[k] = real[i + j]! - re;
        imag[k] = imag[i + j]! - im;
        real[i + j] += re;
        imag[i + j] += im;
      }
  }
  return Array.from(
    { length: size / 2 },
    (_, i) => ((real[i]! ** 2 + imag[i]! ** 2) * 16) / (size * size),
  );
}
export function analyzeAudio(
  channels: Float32Array[],
  sampleRate: number,
): AudioAnalysis {
  if (
    !channels.length ||
    channels.length > 8 ||
    !Number.isFinite(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 192000 ||
    !channels[0]!.length ||
    channels.some((c) => c.length !== channels[0]!.length) ||
    channels.length * channels[0]!.length > 50_000_000
  )
    throw new Error('limit');
  const length = channels[0]!.length;
  let sum = 0,
    peak = 0,
    clipped = 0,
    left = 0,
    right = 0,
    cross = 0;
  for (let i = 0; i < length; i++) {
    for (const channel of channels) {
      const n = channel[i]!;
      if (!Number.isFinite(n)) throw new Error('invalid');
      sum += n * n;
      peak = Math.max(peak, Math.abs(n));
      if (Math.abs(n) >= 0.999) clipped++;
    }
    if (channels.length >= 2) {
      left += channels[0]![i]! ** 2;
      right += channels[1]![i]! ** 2;
      cross += channels[0]![i]! * channels[1]![i]!;
    }
  }
  // ponytail: sample at most 512 FFT windows; add tiled high-resolution analysis for long-file forensic work.
  const size = 1024,
    count = Math.min(512, Math.max(1, Math.ceil(length / (size / 2)))),
    spectrum = new Array<number>(size / 2).fill(0),
    spectrogram: number[][] = [];
  for (let frame = 0; frame < count; frame++) {
    const at = Math.round(
      (frame * Math.max(0, length - size)) / Math.max(1, count - 1),
    );
    const power = new Array<number>(size / 2).fill(0);
    for (const ch of channels) {
      const p = powers(ch, at, size);
      p.forEach((n, i) => {
        power[i] += n / channels.length;
      });
    }
    power.forEach((n, i) => {
      spectrum[i] += n / count;
    });
    spectrogram.push(
      power.map((p) => Math.max(-100, 10 * Math.log10(p || 1e-10))),
    );
  }
  return {
    duration: length / sampleRate,
    rmsDb: sum ? 10 * Math.log10(sum / (length * channels.length)) : null,
    peakDb: peak ? 20 * Math.log10(peak) : null,
    clipped,
    correlation: left && right ? cross / Math.sqrt(left * right) : null,
    frequencies: spectrum.map((_, i) => (i * sampleRate) / size),
    spectrum: spectrum.map((p) => Math.max(-100, 10 * Math.log10(p || 1e-10))),
    spectrogram,
    sampleRate,
  };
}
