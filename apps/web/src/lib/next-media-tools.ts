import type { WorkbenchTool } from '@/components/multi-tool-workbench';
import {
  detectSubtitleFormat,
  parseSubtitles,
  serializeSubtitles,
} from './subtitles';

export function shiftSubtitles(text: string, seconds: number): string {
  if (!Number.isFinite(seconds) || Math.abs(seconds) > 86_400)
    throw new Error('Invalid offset');
  const cues = parseSubtitles(text);
  if (cues.some((cue) => cue.start + seconds < 0))
    throw new Error('Offset makes a cue start before zero');
  return serializeSubtitles(
    cues.map((cue) => ({
      ...cue,
      start: cue.start + seconds,
      end: cue.end + seconds,
    })),
    detectSubtitleFormat(text),
  );
}

export function recolorSvg(source: string, from: string, to: string): string {
  if (source.length > 1_000_000 || !/<svg(?:\s|>)/i.test(source))
    throw new Error('Invalid SVG or file too large');
  const color = /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/;
  if (!color.test(from) || !color.test(to))
    throw new Error('Use #RGB or #RRGGBB colors');
  return source.replace(new RegExp(`${from}(?![0-9a-fA-F])`, 'gi'), to);
}

export function stereoCorrelation(
  left: Float32Array,
  right: Float32Array,
): { correlation: number | null; monoMixRms: number; sampledFrames: number } {
  if (left.length !== right.length || !left.length)
    throw new Error('Invalid stereo samples');
  const stride = Math.max(1, Math.floor(left.length / 1_000_000));
  let sumLeft = 0,
    sumRight = 0,
    sumLeftSquared = 0,
    sumRightSquared = 0,
    sumProduct = 0,
    monoPower = 0,
    count = 0;
  for (let index = 0; index < left.length; index += stride) {
    const a = left[index]!,
      b = right[index]!;
    sumLeft += a;
    sumRight += b;
    sumLeftSquared += a * a;
    sumRightSquared += b * b;
    sumProduct += a * b;
    monoPower += ((a + b) / 2) ** 2;
    count++;
  }
  const covariance = sumProduct / count - (sumLeft * sumRight) / count ** 2;
  const varianceLeft = sumLeftSquared / count - (sumLeft / count) ** 2;
  const varianceRight = sumRightSquared / count - (sumRight / count) ** 2;
  const correlation =
    varianceLeft > 0 && varianceRight > 0
      ? covariance / Math.sqrt(varianceLeft * varianceRight)
      : null;
  return {
    correlation: correlation === null ? null : Number(correlation.toFixed(4)),
    monoMixRms: Number(Math.sqrt(monoPower / count).toFixed(6)),
    sampledFrames: count,
  };
}

export async function stampPdf(
  file: File,
  start: number,
): Promise<{
  output: string;
  download: { bytes: Uint8Array; name: string; type: string };
}> {
  if (file.size > 40_000_000 || !file.name.toLowerCase().endsWith('.pdf'))
    throw new Error('Choose a PDF up to 40 MB');
  if (!Number.isInteger(start) || start < 0 || start > 1_000_000)
    throw new Error('Invalid start number');
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  if (pdf.getPageCount() > 500) throw new Error('PDF exceeds 500 pages');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.getPages().forEach((page, index) => {
    const label = String(start + index);
    const size = 10;
    const width = font.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: (page.getWidth() - width) / 2,
      y: 18,
      size,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  });
  return {
    output: `${pdf.getPageCount()} pages numbered`,
    download: {
      bytes: await pdf.save(),
      name: `${file.name.replace(/\.pdf$/i, '')}-numbered.pdf`,
      type: 'application/pdf',
    },
  };
}

async function inspectStereoPhase(file: File): Promise<string> {
  if (file.size > 25_000_000 || !file.type.startsWith('audio/'))
    throw new Error('Choose an audio file up to 25 MB');
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await file.arrayBuffer());
    if (audio.duration > 1800) throw new Error('Audio exceeds 30 minutes');
    if (audio.numberOfChannels < 2) throw new Error('Stereo audio required');
    return JSON.stringify(
      {
        durationSeconds: Number(audio.duration.toFixed(2)),
        ...stereoCorrelation(audio.getChannelData(0), audio.getChannelData(1)),
      },
      null,
      2,
    );
  } finally {
    await context.close();
  }
}

async function fontCoverage(file: File, text: string): Promise<string> {
  if (file.size > 8_000_000 || !/\.(ttf|otf|woff2?)$/i.test(file.name))
    throw new Error('Choose a font up to 8 MB');
  if ([...text].length > 2_000)
    throw new Error('Text exceeds 2,000 characters');
  const { create } = await import('fontkit');
  const parsed = create(
    new Uint8Array(await file.arrayBuffer()) as unknown as Buffer,
  );
  const font = 'fonts' in parsed ? parsed.fonts[0] : parsed;
  if (!font) throw new Error('Invalid font');
  const characters = [...new Set([...text])];
  const missing = characters.filter(
    (character) => !font.hasGlyphForCodePoint(character.codePointAt(0)!),
  );
  return JSON.stringify(
    {
      uniqueCharacters: characters.length,
      covered: characters.length - missing.length,
      missing: missing.join(''),
    },
    null,
    2,
  );
}

export const MEDIA_TOOLS: readonly WorkbenchTool[] = [
  {
    id: 'subtitleShift',
    fields: [
      {
        id: 'subtitle',
        label: 'subtitleInput',
        sample: '1\n00:00:01,000 --> 00:00:03,000\nHello',
      },
      { id: 'seconds', label: 'offsetSeconds', kind: 'number', sample: '2' },
    ],
    run: ({ subtitle, seconds }) => ({
      output: shiftSubtitles(subtitle ?? '', Number(seconds)),
    }),
  },
  {
    id: 'svgRecolor',
    fields: [
      {
        id: 'svg',
        label: 'svgInput',
        sample:
          '<svg xmlns="http://www.w3.org/2000/svg"><circle r="20" fill="#ff0000"/></svg>',
      },
      { id: 'from', label: 'oldColor', sample: '#ff0000' },
      { id: 'to', label: 'newColor', sample: '#2563eb' },
    ],
    run: ({ svg, from, to }) => {
      const output = recolorSvg(svg ?? '', from ?? '', to ?? '');
      return {
        output,
        download: {
          bytes: new TextEncoder().encode(output),
          name: 'recolored.svg',
          type: 'image/svg+xml',
        },
      };
    },
  },
  {
    id: 'pdfNumbers',
    fields: [
      {
        id: 'file',
        label: 'pdfFile',
        kind: 'file',
        accept: '.pdf,application/pdf',
      },
      { id: 'start', label: 'startNumber', kind: 'number', sample: '1' },
    ],
    run: async ({ start }, file) => {
      if (!file) throw new Error('Choose a PDF');
      return stampPdf(file, Number(start));
    },
  },
  {
    id: 'stereoPhase',
    fields: [
      { id: 'file', label: 'audioFile', kind: 'file', accept: 'audio/*' },
    ],
    run: async (_values, file) => {
      if (!file) throw new Error('Choose audio');
      return { output: await inspectStereoPhase(file) };
    },
  },
  {
    id: 'fontCoverage',
    fields: [
      {
        id: 'file',
        label: 'fontFile',
        kind: 'file',
        accept: '.ttf,.otf,.woff,.woff2',
      },
      { id: 'text', label: 'sampleText', sample: '中文 ABC 0123456789' },
    ],
    run: async ({ text }, file) => {
      if (!file) throw new Error('Choose a font');
      return { output: await fontCoverage(file, text ?? '') };
    },
  },
];
