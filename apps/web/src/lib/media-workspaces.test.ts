import { expect, test } from 'vitest';
import {
  bookLayout,
  safeMusicName,
  transcriptExport,
  validateSequence,
} from './media-workspace-core';
import { editMp3, readId3Frames } from './music-tags';
import { cleanMusicXml } from './sheet-music';
test('transcript timing corrections produce valid SRT/VTT and reject reversed times', () => {
  const cues = [{ start: 1.25, end: 3, text: '你好，世界' }];
  expect(transcriptExport(cues, 'srt', 0.5)).toContain(
    '00:00:01,750 --> 00:00:03,500',
  );
  expect(transcriptExport(cues, 'vtt')).toMatch(/^WEBVTT/);
  expect(() => transcriptExport(cues, 'srt', -2)).toThrow('segments');
  expect(() =>
    transcriptExport([{ start: 2, end: 1, text: 'bad' }], 'txt'),
  ).toThrow();
});
test('ID3 edits retain unmodified raw frames and the exact MP3 payload', async () => {
  const { ID3Writer } = await import('browser-id3-writer');
  const audio = new Uint8Array([0xff, 0xfb, 0x90, 0, 7, 8, 9, 10]);
  const writer = new ID3Writer(audio.buffer);
  writer.setFrame('TIT2', 'Old title');
  writer.setFrame('TALB', '原专辑');
  writer.setFrame('TXXX', { description: 'custom-data', value: 'preserve me' });
  const source = new Uint8Array(writer.addTag());
  const original = readId3Frames(source);
  const edited = await editMp3(source, { title: '新标题', artist: 'Artist' });
  const next = readId3Frames(edited);
  expect(edited.slice(next.audioOffset)).toEqual(audio);
  for (const id of ['TALB', 'TXXX'])
    expect(next.frames.find((f) => f.id === id)?.bytes).toEqual(
      original.frames.find((f) => f.id === id)?.bytes,
    );
  expect(next.frames.filter((f) => f.id === 'TIT2')).toHaveLength(1);
  const cleared = await editMp3(edited, { title: '' });
  expect(readId3Frames(cleared).frames.some((f) => f.id === 'TIT2')).toBe(
    false,
  );
  const unsupported = source.slice();
  unsupported[5] = 128;
  await expect(editMp3(unsupported, { title: 'x' })).rejects.toThrow(
    'tagFormat',
  );
});
test('music filenames cannot escape a ZIP directory', () => {
  expect(
    safeMusicName(
      '{artist} - {title}',
      { artist: 'A/B', title: '../song', album: '', track: '' },
      'x.mp3',
    ),
  ).toBe('A_B - .._song.mp3');
});
test('book geometry includes bleed and constrains unsafe sizes', () => {
  const layout = bookLayout('pair', 210, 297, 3, 12);
  expect([layout.width, layout.height]).toEqual([216, 303]);
  expect(layout.boxes).toHaveLength(2);
  expect(layout.boxes[1]!.y + layout.boxes[1]!.height).toBe(288);
  expect(() => bookLayout('single', 20, 20, 3, 12)).toThrow('bookSize');
  validateSequence([100, 200, 300], 640, 480);
  expect(() => validateSequence([0], 640, 480)).toThrow('sequenceLimit');
  expect(() => validateSequence([200], 4000, 4000)).toThrow();
});
test('MusicXML accepts external DOCTYPE without resolving it and rejects entity expansion', () => {
  expect(
    cleanMusicXml(
      '<?xml version="1.0"?><!DOCTYPE score-partwise PUBLIC "x" "https://example.com/music.dtd"><score-partwise/>',
    ),
  ).toContain('<score-partwise/>');
  expect(() =>
    cleanMusicXml('<!DOCTYPE x [<!ENTITY a "b">]><score-partwise/>'),
  ).toThrow('scoreLimit');
});
