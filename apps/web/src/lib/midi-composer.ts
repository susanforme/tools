import type { MidiJSON, TrackJSON } from '@tonejs/midi';
export type MidiProject = MidiJSON;
export function emptyMidiTrack(index: number): TrackJSON {
  return {
    name: `Track ${index + 1}`,
    channel: index % 15 < 9 ? index % 15 : (index % 15) + 1,
    instrument: { number: 0, family: 'piano', name: 'acoustic grand piano' },
    notes: [],
    controlChanges: {},
    pitchBends: [],
  };
}
export function emptyMidi(): MidiProject {
  return {
    header: {
      name: 'Composition',
      ppq: 480,
      meta: [],
      tempos: [{ ticks: 0, bpm: 120 }],
      timeSignatures: [{ ticks: 0, timeSignature: [4, 4] }],
      keySignatures: [],
    },
    tracks: [emptyMidiTrack(0)],
  };
}
export function transformMidi(
  project: MidiProject,
  track: number,
  quantize: number,
  transpose: number,
): MidiProject {
  if (
    !Number.isFinite(quantize) ||
    quantize < 0 ||
    quantize > 4 ||
    !Number.isInteger(transpose) ||
    Math.abs(transpose) > 48
  )
    throw new Error('invalid');
  const step = project.header.ppq * quantize;
  const notes = project.tracks[track]?.notes;
  if (!notes) throw new Error('invalid');
  if (
    notes.some(
      (note) => note.midi + transpose < 0 || note.midi + transpose > 127,
    )
  )
    throw new Error('pitch');
  return {
    ...project,
    tracks: project.tracks.map((t, i) =>
      i !== track
        ? t
        : {
            ...t,
            notes: t.notes.map((note) => ({
              ...note,
              midi: note.midi + transpose,
              ticks: step
                ? Math.max(0, Math.round(note.ticks / step) * step)
                : note.ticks,
              durationTicks: step
                ? Math.max(step, Math.round(note.durationTicks / step) * step)
                : note.durationTicks,
            })),
          },
    ),
  };
}
export function checkMidi(project: MidiProject) {
  if (
    !Number.isFinite(project.header.ppq) ||
    project.header.ppq <= 0 ||
    project.header.ppq > 32767 ||
    project.tracks.length > 32 ||
    project.tracks.reduce((sum, track) => sum + track.notes.length, 0) > 10000
  )
    throw new Error('limit');
  if (
    project.header.tempos.length > 1000 ||
    project.header.tempos.some(
      (tempo) =>
        !Number.isFinite(tempo.bpm) ||
        tempo.bpm <= 0 ||
        tempo.bpm > 1000 ||
        !Number.isFinite(tempo.ticks) ||
        tempo.ticks < 0,
    )
  )
    throw new Error('invalid');
  for (const track of project.tracks)
    for (const n of track.notes)
      if (
        !Number.isInteger(n.midi) ||
        n.midi < 0 ||
        n.midi > 127 ||
        !Number.isFinite(n.ticks) ||
        n.ticks < 0 ||
        !Number.isFinite(n.durationTicks) ||
        n.durationTicks <= 0 ||
        !Number.isFinite(n.velocity) ||
        n.velocity < 0 ||
        n.velocity > 1 ||
        n.ticks + n.durationTicks > project.header.ppq * 60000
      )
        throw new Error('invalid');
}
