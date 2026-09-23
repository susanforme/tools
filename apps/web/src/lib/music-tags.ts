export type MusicTags = {
  title: string;
  artist: string;
  album: string;
  track: string;
};
export type TagEdit = Partial<MusicTags> & { cover?: Uint8Array | null };
type Frame = { id: string; bytes: Uint8Array };
function syncSize(bytes: Uint8Array, offset: number): number {
  if ([0, 1, 2, 3].some((i) => bytes[offset + i]! > 127))
    throw new Error('tagFormat');
  return (
    bytes[offset]! * 2097152 +
    bytes[offset + 1]! * 16384 +
    bytes[offset + 2]! * 128 +
    bytes[offset + 3]!
  );
}
function writeSize(
  bytes: Uint8Array,
  offset: number,
  size: number,
  sync: boolean,
) {
  for (let i = 3; i >= 0; i--) {
    bytes[offset + i] = size % (sync ? 128 : 256);
    size = Math.floor(size / (sync ? 128 : 256));
  }
}
export function readId3Frames(bytes: Uint8Array): {
  frames: Frame[];
  audioOffset: number;
  version: 3 | 4;
} {
  if (bytes.length < 10 || String.fromCharCode(...bytes.slice(0, 3)) !== 'ID3')
    return { frames: [], audioOffset: 0, version: 3 };
  const version = bytes[3];
  if ((version !== 3 && version !== 4) || (bytes[5]! & 0xd0) !== 0)
    throw new Error('tagFormat');
  const end = 10 + syncSize(bytes, 6);
  if (end > bytes.length || end > 10_000_000) throw new Error('tagFormat');
  const frames: Frame[] = [];
  let at = 10;
  while (at + 10 <= end && bytes[at] !== 0) {
    const id = String.fromCharCode(...bytes.slice(at, at + 4));
    if (!/^[A-Z0-9]{4}$/.test(id)) throw new Error('tagFormat');
    const size =
      version === 4
        ? syncSize(bytes, at + 4)
        : new DataView(bytes.buffer, bytes.byteOffset + at + 4, 4).getUint32(0);
    if (size <= 0 || at + 10 + size > end) throw new Error('tagFormat');
    frames.push({ id, bytes: bytes.slice(at, at + 10 + size) });
    at += 10 + size;
  }
  return { frames, audioOffset: end, version };
}
export async function editMp3(
  bytes: Uint8Array,
  edit: TagEdit,
): Promise<Uint8Array> {
  if (
    bytes.length > 50_000_000 ||
    Object.values(edit).some((v) => typeof v === 'string' && v.length > 1000)
  )
    throw new Error('tagLimit');
  const original = readId3Frames(bytes);
  if (
    bytes[original.audioOffset] !== 0xff ||
    (bytes[original.audioOffset + 1]! & 0xe0) !== 0xe0
  )
    throw new Error('mp3');
  const { ID3Writer } = await import('browser-id3-writer');
  const writer = new ID3Writer(new Uint8Array([0xff, 0xfb, 0x90, 0x00]).buffer);
  const remove = new Set<string>();
  for (const [key, id] of [
    ['title', 'TIT2'],
    ['artist', 'TPE1'],
    ['album', 'TALB'],
    ['track', 'TRCK'],
  ] as const) {
    const value = edit[key];
    if (value !== undefined) {
      remove.add(id);
      if (value) {
        if (id === 'TPE1') writer.setFrame(id, [value]);
        else writer.setFrame(id, value);
      }
    }
  }
  if (edit.cover !== undefined) {
    remove.add('APIC');
    if (edit.cover) {
      if (edit.cover.length > 5_000_000) throw new Error('coverLimit');
      writer.setFrame('APIC', {
        type: 3,
        data: new Uint8Array(edit.cover).buffer,
        description: 'Cover',
      });
    }
  }
  const generated = writer.addTag();
  const fresh = readId3Frames(new Uint8Array(generated)).frames.map((frame) => {
    if (original.version === 4)
      writeSize(frame.bytes, 4, frame.bytes.length - 10, true);
    return frame;
  });
  const frames = [
    ...original.frames.filter((frame) => !remove.has(frame.id)),
    ...fresh,
  ];
  const length = frames.reduce((n, f) => n + f.bytes.length, 0);
  if (length > 10_000_000) throw new Error('tagLimit');
  const output = new Uint8Array(
    10 + length + bytes.length - original.audioOffset,
  );
  output.set([73, 68, 51, original.version, 0, 0]);
  writeSize(output, 6, length, true);
  let at = 10;
  for (const frame of frames) {
    output.set(frame.bytes, at);
    at += frame.bytes.length;
  }
  output.set(bytes.subarray(original.audioOffset), at);
  return output;
}
