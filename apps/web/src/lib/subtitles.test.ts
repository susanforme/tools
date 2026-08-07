import { describe, expect, it } from 'vitest';
import { parseSubtitles, serializeSubtitles } from './subtitles';

describe('subtitle conversion', () => {
  it('converts SRT cues to WebVTT and back', () => {
    const cues = parseSubtitles(
      '1\n00:00:01,250 --> 00:00:03,500\n你好\n\n2\n00:00:04,000 --> 00:00:05,000\nWorld\n',
    );
    const vtt = serializeSubtitles(cues, 'vtt');
    expect(vtt).toContain('00:00:01.250 --> 00:00:03.500');
    expect(parseSubtitles(vtt)).toEqual(cues);
  });
});
