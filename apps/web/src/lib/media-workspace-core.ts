import { serializeSubtitles } from './subtitles';
export type TranscriptSegment = { start: number; end: number; text: string };
export function transcriptExport(
  segments: TranscriptSegment[],
  format: 'txt' | 'srt' | 'vtt',
  offset = 0,
): string {
  if (
    !segments.length ||
    segments.length > 1000 ||
    !Number.isFinite(offset) ||
    Math.abs(offset) > 3600
  )
    throw new Error('segments');
  const cues = segments.map((s) => ({
    ...s,
    start: s.start + offset,
    end: s.end + offset,
  }));
  if (
    cues.some(
      (s, i) =>
        !Number.isFinite(s.start) ||
        !Number.isFinite(s.end) ||
        s.start < 0 ||
        s.end <= s.start ||
        s.text.length > 10000 ||
        !s.text.trim() ||
        (i > 0 && s.start < cues[i - 1]!.start),
    )
  )
    throw new Error('segments');
  return format === 'txt'
    ? cues.map((s) => s.text).join('\n')
    : serializeSubtitles(cues, format);
}
export function safeMusicName(
  pattern: string,
  tags: { title: string; artist: string; album: string; track: string },
  fallback: string,
): string {
  if (pattern.length > 200) throw new Error('invalid');
  const output = pattern
    .replace(
      /\{(title|artist|album|track)\}/g,
      (_, key: keyof typeof tags) => tags[key],
    )
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 180);
  return (
    (output ||
      fallback
        .replace(/\.mp3$/i, '')
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_') ||
      'audio') + '.mp3'
  );
}
export function validateSequence(
  durations: number[],
  width: number,
  height: number,
) {
  if (
    !durations.length ||
    durations.length > 120 ||
    durations.some((d) => !Number.isFinite(d) || d < 20 || d > 10000) ||
    durations.reduce((s, d) => s + d, 0) > 180000 ||
    ![width, height].every(
      (n) => Number.isInteger(n) && n >= 64 && n <= 1920,
    ) ||
    width * height > 2073600
  )
    throw new Error('sequenceLimit');
}
export function bookLayout(
  template: string,
  width: number,
  height: number,
  bleed: number,
  margin: number,
) {
  if (
    ![width, height, bleed, margin].every(Number.isFinite) ||
    width < 100 ||
    width > 350 ||
    height < 100 ||
    height > 350 ||
    bleed < 0 ||
    bleed > 10 ||
    margin < 5 ||
    margin > 40 ||
    margin * 2 >= Math.min(width, height)
  )
    throw new Error('bookSize');
  const x = bleed + margin,
    y = x,
    w = width - 2 * margin,
    h = height - 2 * margin;
  return {
    width: width + bleed * 2,
    height: height + bleed * 2,
    boxes:
      template === 'pair'
        ? [
            { x, y, width: w, height: (h - 12) / 2 },
            { x, y: y + (h + 12) / 2, width: w, height: (h - 12) / 2 },
          ]
        : [{ x, y, width: w, height: template === 'caption' ? h * 0.75 : h }],
    textY: bleed + height - margin - (template === 'caption' ? h * 0.25 : 0),
    textWidth: w,
  };
}
