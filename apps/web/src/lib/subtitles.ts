import type { SubtitleCue } from './media-tools';

export type SubtitleFormat = 'srt' | 'vtt';

function parseTimestamp(value: string): number {
  const normalized = value.trim().replace(',', '.');
  const parts = normalized.split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) {
    throw new Error('INVALID_TIMESTAMP');
  }
  const [hours = 0, minutes = 0, seconds = 0] =
    parts.length === 3 ? parts : [0, ...parts];
  return hours * 3600 + minutes * 60 + seconds;
}

function formatTimestamp(value: number, separator: ',' | '.'): string {
  const milliseconds = Math.max(0, Math.round(value * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}${separator}${String(millis).padStart(3, '0')}`;
}

export function detectSubtitleFormat(text: string): SubtitleFormat {
  return text.trimStart().startsWith('WEBVTT') ? 'vtt' : 'srt';
}

export function parseSubtitles(text: string): SubtitleCue[] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const body = normalized.replace(/^WEBVTT[^\n]*\n+/, '');
  const cues: SubtitleCue[] = [];
  for (const block of body.split(/\n{2,}/)) {
    const lines = block.split('\n').filter(Boolean);
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex < 0) continue;
    const [startValue, endPart] = lines[timingIndex]!.split('-->');
    const endValue = endPart?.trim().split(/\s+/)[0];
    if (!startValue || !endValue) continue;
    const start = parseTimestamp(startValue);
    const end = parseTimestamp(endValue);
    const cueText = lines
      .slice(timingIndex + 1)
      .join('\n')
      .trim();
    if (end > start && cueText) cues.push({ start, end, text: cueText });
  }
  if (cues.length === 0) throw new Error('NO_CUES');
  return cues;
}

export function serializeSubtitles(
  cues: SubtitleCue[],
  format: SubtitleFormat,
): string {
  const separator = format === 'srt' ? ',' : '.';
  const blocks = cues.map((cue, index) => {
    const timing = `${formatTimestamp(cue.start, separator)} --> ${formatTimestamp(cue.end, separator)}`;
    return format === 'srt'
      ? `${index + 1}\n${timing}\n${cue.text}`
      : `${timing}\n${cue.text}`;
  });
  return `${format === 'vtt' ? 'WEBVTT\n\n' : ''}${blocks.join('\n\n')}\n`;
}
