import { describe, expect, it } from 'vitest';
import { analyzeAudio, parseGcode } from './batch4-media-analysis';
import { emptyMidi, transformMidi, checkMidi } from './batch4-media-midi';
import { storyboardTimes, videoTimecode } from './batch4-media-storyboard';
describe('media workbenches', () => {
  it('tracks relative extrusion, retraction recovery, layers, arcs and inch units', () => {
    const g = parseGcode(
      'G21\nG90\nM83\nG1 Z0.2 F600\nG1 X10 E1\nG1 E-0.5\nG1 E0.5\nG1 Y10 E1\nG1 Z0.4\nG1 X0 E1',
    );
    expect(g.filament).toBeCloseTo(3);
    expect(g.layers).toEqual([0.2, 0.4]);
    expect(g.travel).toBeCloseTo(0.4);
    expect(g.seconds).toBeCloseTo(3.14);
    const arc = parseGcode('G21\nG90\nM83\nG1 X10 F600\nG3 X0 Y10 I-10 J0 E2');
    expect(arc.filament).toBeCloseTo(2);
    expect(arc.segments.at(-1)?.to).toEqual([0, 10, 0]);
    expect(arc.seconds).toBeCloseTo(1 + Math.PI / 2, 2);
    expect(parseGcode('G20\nG91\nM83\nG1 X1 E1 F60').filament).toBeCloseTo(
      25.4,
    );
    expect(parseGcode('G1 X10\nG92 X0\nG1 X10').segments.at(-1)?.to[0]).toBe(
      20,
    );
    expect(() => parseGcode('G1 X1 F0')).toThrow();
    expect(() => parseGcode('G2 X1 R5')).toThrow('arc');
    expect(() => parseGcode('M200 D1.75\nG1 X1')).toThrow('extruder');
  });
  it('analyzes sine energy and opposite stereo without downmix cancellation', () => {
    const a = Float32Array.from(
        { length: 8192 },
        (_, i) => 0.5 * Math.sin((2 * Math.PI * 1000 * i) / 32000),
      ),
      b = a.map((n) => -n);
    const r = analyzeAudio([a, b], 32000);
    expect(r.rmsDb).toBeCloseTo(-9.0309, 3);
    expect(r.peakDb).toBeCloseTo(-6.0206, 3);
    expect(r.correlation).toBeCloseTo(-1, 6);
    expect(r.clipped).toBe(0);
    expect(r.frequencies[r.spectrum.indexOf(Math.max(...r.spectrum))]).toBe(
      1000,
    );
    expect(analyzeAudio([new Float32Array(2048)], 32000).rmsDb).toBeNull();
  });
  it('bounds frame extraction and preserves millisecond timecodes', () => {
    expect(storyboardTimes(21, 10)).toEqual([0, 10, 20]);
    expect(() => storyboardTimes(61, 1)).toThrow('frames');
    expect(videoTimecode(3661.125)).toBe('01:01:01.125');
  });
  it('quantizes and transposes notes while preserving the original project', () => {
    const p = emptyMidi();
    p.tracks[0]!.notes.push({
      ticks: 133,
      durationTicks: 200,
      midi: 60,
      velocity: 0.5,
      time: 0,
      duration: 0,
      name: 'C4',
    });
    const next = transformMidi(p, 0, 0.25, 12);
    expect(next.tracks[0]!.notes[0]).toMatchObject({
      ticks: 120,
      durationTicks: 240,
      midi: 72,
    });
    expect(p.tracks[0]!.notes[0]!.midi).toBe(60);
    checkMidi(next);
    expect(() => transformMidi(p, 0, 0, 100)).toThrow();
  });
  it('round trips MIDI tempo, tracks, velocity and quantized timing', async () => {
    const { Midi } = await import('@tonejs/midi');
    const project = emptyMidi();
    project.tracks[0]!.notes.push({
      ticks: 480,
      durationTicks: 240,
      midi: 64,
      velocity: 0.75,
      time: 0,
      duration: 0,
      name: 'E4',
    });
    const midi = new Midi();
    midi.fromJSON(project);
    const roundtrip = new Midi(midi.toArray());
    expect(roundtrip.tracks[0]!.notes[0]!.ticks).toBe(480);
    expect(roundtrip.tracks[0]!.notes[0]!.duration).toBeCloseTo(0.25);
    expect(roundtrip.tracks[0]!.notes[0]!.velocity).toBeCloseTo(0.75, 1);
  });
});
