type Coefficients = [number, number, number, number, number];

function kWeightCoefficients(sampleRate: number): [Coefficients, Coefficients] {
  const shelfK = Math.tan((Math.PI * 1681.974450955533) / sampleRate);
  const vh = 10 ** (3.999843853973347 / 20);
  const vb = vh ** 0.4996667741545416;
  const qShelf = 0.7071752369554196;
  const shelfA = 1 + shelfK / qShelf + shelfK ** 2;
  const shelf: Coefficients = [
    (vh + (vb * shelfK) / qShelf + shelfK ** 2) / shelfA,
    (2 * (shelfK ** 2 - vh)) / shelfA,
    (vh - (vb * shelfK) / qShelf + shelfK ** 2) / shelfA,
    (2 * (shelfK ** 2 - 1)) / shelfA,
    (1 - shelfK / qShelf + shelfK ** 2) / shelfA,
  ];
  const highK = Math.tan((Math.PI * 38.13547087602444) / sampleRate);
  const qHigh = 0.5003270373238773;
  const highA = 1 + highK / qHigh + highK ** 2;
  const high: Coefficients = [
    1 / highA,
    -2 / highA,
    1 / highA,
    (2 * (highK ** 2 - 1)) / highA,
    (1 - highK / qHigh + highK ** 2) / highA,
  ];
  return [shelf, high];
}

function filter(
  sample: number,
  coefficients: Coefficients,
  state: [number, number],
): number {
  const [b0, b1, b2, a1, a2] = coefficients;
  const value = b0 * sample + state[0];
  state[0] = b1 * sample - a1 * value + state[1];
  state[1] = b2 * sample - a2 * value;
  return value;
}

function sinc(value: number): number {
  return value === 0 ? 1 : Math.sin(Math.PI * value) / (Math.PI * value);
}

export function analyzeAudioLoudness(
  channels: Float32Array[],
  sampleRate: number,
): { lufs: number; truePeakDb: number } {
  if (
    !channels.length ||
    !channels[0]?.length ||
    sampleRate < 8000 ||
    sampleRate > 192000 ||
    channels.some((channel) => channel.length !== channels[0]!.length)
  )
    throw new Error('INVALID_AUDIO');
  const [shelf, high] = kWeightCoefficients(sampleRate);
  const states = channels.map(() => ({
    shelf: [0, 0] as [number, number],
    high: [0, 0] as [number, number],
  }));
  const block = Math.min(
    channels[0]!.length,
    Math.max(1, Math.round(sampleRate * 0.4)),
  );
  const hop = Math.max(1, Math.round(sampleRate * 0.1));
  const ring = new Float64Array(block);
  const energies: number[] = [];
  let running = 0;
  for (let index = 0; index < channels[0]!.length; index++) {
    let energy = 0;
    for (let channel = 0; channel < channels.length; channel++) {
      const state = states[channel]!;
      const weighted = filter(
        filter(channels[channel]![index]!, shelf, state.shelf),
        high,
        state.high,
      );
      energy += weighted * weighted;
    }
    const position = index % block;
    running += energy - ring[position]!;
    ring[position] = energy;
    if (index + 1 >= block && (index + 1 - block) % hop === 0)
      energies.push(Math.max(0, running / block));
  }
  const absolute = energies.filter(
    (energy) => -0.691 + 10 * Math.log10(Math.max(energy, 1e-20)) > -70,
  );
  const preliminary =
    absolute.reduce((sum, energy) => sum + energy, 0) /
    Math.max(absolute.length, 1);
  const threshold = preliminary / 10;
  const gated = absolute.filter((energy) => energy >= threshold);
  const mean =
    gated.reduce((sum, energy) => sum + energy, 0) / Math.max(gated.length, 1);
  let peak = 0;
  const phases = [0.25, 0.5, 0.75];
  for (const samples of channels) {
    for (let index = 0; index < samples.length; index++) {
      peak = Math.max(peak, Math.abs(samples[index]!));
      if (index === samples.length - 1) continue;
      for (const phase of phases) {
        let estimate = 0,
          gain = 0;
        for (let offset = -7; offset <= 8; offset++) {
          const position = index + offset;
          if (position < 0 || position >= samples.length) continue;
          const distance = phase - offset;
          const weight =
            sinc(distance) * (0.5 + 0.5 * Math.cos((Math.PI * distance) / 8));
          estimate += samples[position]! * weight;
          gain += weight;
        }
        if (gain) peak = Math.max(peak, Math.abs(estimate / gain));
      }
    }
  }
  return {
    lufs: mean > 0 ? -0.691 + 10 * Math.log10(mean) : -120,
    truePeakDb: peak > 0 ? 20 * Math.log10(peak) : -120,
  };
}
