import { checkMidi, type MidiProject } from './midi-composer';
export type MidiRequest =
  | { type: 'parse'; bytes: ArrayBuffer }
  | { type: 'encode' | 'prepare'; project: MidiProject };
export type MidiResponse = { project: MidiProject; bytes: Uint8Array | null };
self.onmessage = async (event: MessageEvent<MidiRequest>) => {
  try {
    const q = event.data;
    if (q.type === 'parse' && q.bytes.byteLength > 2_000_000)
      throw new Error('limit');
    const { Midi } = await import('@tonejs/midi');
    const midi = q.type === 'parse' ? new Midi(q.bytes) : new Midi();
    if (q.type !== 'parse') {
      checkMidi(q.project);
      midi.fromJSON(q.project);
    }
    if (!midi.header.tempos.length) midi.header.setTempo(120);
    const project = midi.toJSON();
    checkMidi(project);
    if (midi.duration > 3600 || !Number.isFinite(midi.duration))
      throw new Error('limit');
    self.postMessage({
      result: { project, bytes: q.type === 'encode' ? midi.toArray() : null },
    });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
