export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];
export const CHORD_INTERVALS: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dominant7: [0, 4, 7, 10],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
};
export function chordNotes(root: number, quality: string): number[] {
  if (
    !Number.isInteger(root) ||
    root < 0 ||
    root > 11 ||
    !CHORD_INTERVALS[quality]
  )
    throw new Error('invalid');
  return CHORD_INTERVALS[quality].map((n) => (root + n) % 12);
}
const PITCHES: Record<string, number> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  'E#': 5,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};
export function transposeChart(source: string, shift: number): string {
  if (
    !Number.isInteger(shift) ||
    Math.abs(shift) > 24 ||
    source.length > 100000
  )
    throw new Error('invalid');
  return source.replace(
    /\b([A-G](?:#|b)?)(?=(?:maj|min|dim|aug|sus|add|m|M)?\d*(?:\b|\/|\]|\s|$))/g,
    (note) => NOTE_NAMES[(PITCHES[note] + (shift % 12) + 12) % 12],
  );
}
export function guitarShapes(notes: number[]): number[][] {
  const tuning = [4, 9, 2, 7, 11, 4],
    allowed = new Set(notes),
    results: number[][] = [];
  for (let base = 0; base <= 9 && results.length < 8; base++) {
    const visit = (shape: number[], used: Set<number>) => {
      if (results.length >= 8) return;
      const string = shape.length;
      if (string === 6) {
        if (
          shape.filter((n) => n >= 0).length < 3 ||
          notes.some((n) => !used.has(n))
        )
          return;
        const frets = shape.filter((n) => n > 0);
        if (frets.length && Math.max(...frets) - Math.min(...frets) > 3) return;
        if (!results.some((old) => old.join() === shape.join()))
          results.push(shape);
        return;
      }
      const options = [
        -1,
        ...Array.from({ length: 5 }, (_, n) => base + n),
      ].filter((f) => f < 0 || allowed.has((tuning[string] + f) % 12));
      for (const fret of options) {
        const next = new Set(used);
        if (fret >= 0) next.add((tuning[string] + fret) % 12);
        visit([...shape, fret], next);
      }
    };
    visit([], new Set());
  }
  return results;
}
export function playTone(
  context: BaseAudioContext,
  note: number,
  when: number,
  duration: number,
  volume = 0.2,
) {
  const oscillator = context.createOscillator(),
    gain = context.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12);
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(volume, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    when + Math.max(0.03, duration),
  );
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(when);
  oscillator.stop(when + Math.max(0.03, duration) + 0.02);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
  return () => {
    try {
      const time = context.currentTime;
      gain.gain.cancelScheduledValues(time);
      gain.gain.setTargetAtTime(0.0001, time, 0.015);
      oscillator.stop(time + 0.1);
    } catch {
      /* 已停止 */
    }
  };
}
export const DRUM_TRACKS = ['kick', 'snare', 'hat', 'clap'] as const;
export function drumHit(
  context: BaseAudioContext,
  track: number,
  time: number,
) {
  const gain = context.createGain();
  gain.connect(context.destination);
  const duration =
    track === 0 ? 0.35 : track === 1 ? 0.2 : track === 2 ? 0.07 : 0.13;
  gain.gain.setValueAtTime(track === 2 ? 0.12 : 0.35, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  if (track === 0) {
    const osc = context.createOscillator();
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.2);
    osc.connect(gain);
    osc.start(time);
    osc.stop(time + duration);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  } else {
    const buffer = context.createBuffer(
        1,
        Math.ceil(context.sampleRate * duration),
        context.sampleRate,
      ),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] =
        (Math.random() * 2 - 1) *
        (track === 3
          ? Math.sin((i / context.sampleRate) * 140 * Math.PI) ** 2
          : 1);
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter();
    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = track === 2 ? 7000 : track === 1 ? 1000 : 1200;
    source.connect(filter);
    filter.connect(gain);
    source.start(time);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
}
export function stepTime(step: number, bpm: number, swing: number): number {
  return (step * 60) / bpm / 4 + (step % 2 ? (60 / bpm / 4) * swing : 0);
}
export function encodeWav(buffer: AudioBuffer): Uint8Array {
  const size = buffer.length * 2,
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
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, size, true);
  const samples = buffer.getChannelData(0);
  samples.forEach((sample, i) =>
    view.setInt16(
      44 + i * 2,
      Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 32768 : 32767),
      true,
    ),
  );
  return bytes;
}
export type DrumPattern = { bpm: number; swing: number; steps: boolean[][] };
export function validateDrum(value: unknown): value is DrumPattern {
  return (
    typeof value === 'object' &&
    value !== null &&
    'bpm' in value &&
    typeof value.bpm === 'number' &&
    Number.isFinite(value.bpm) &&
    value.bpm >= 30 &&
    value.bpm <= 300 &&
    'swing' in value &&
    typeof value.swing === 'number' &&
    Number.isFinite(value.swing) &&
    value.swing >= 0 &&
    value.swing <= 0.75 &&
    'steps' in value &&
    Array.isArray(value.steps) &&
    value.steps.length === 4 &&
    value.steps.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 16 &&
        row.every((step) => typeof step === 'boolean'),
    )
  );
}
