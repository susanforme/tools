import type { WorkbenchTool } from '@/components/multi-tool-workbench';
import {
  detectSubtitleFormat,
  parseSubtitles,
  serializeSubtitles,
} from './subtitles';

const json = (value: unknown): string => JSON.stringify(value, null, 2);

export function stretchSubtitles(source: string, speed: number): string {
  if (!Number.isFinite(speed) || speed < 0.25 || speed > 4)
    throw new Error('倍速应为 0.25–4 倍');
  const cues = parseSubtitles(source);
  return serializeSubtitles(
    cues.map((cue) => ({
      ...cue,
      start: cue.start / speed,
      end: cue.end / speed,
    })),
    detectSubtitleFormat(source),
  );
}

function svgDocument(source: string): Document {
  if (source.length > 1_000_000) throw new Error('SVG 超过 1 MB');
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (
    document.querySelector('parsererror') ||
    document.documentElement.localName !== 'svg'
  )
    throw new Error('SVG 无效');
  return document;
}

export function namespaceSvgIds(source: string, prefix: string): string {
  if (!/^[A-Za-z][\w-]{0,39}$/.test(prefix)) throw new Error('ID 前缀无效');
  const document = svgDocument(source);
  if (document.querySelector('style')) throw new Error('暂不支持内嵌 CSS');
  const ids = new Map<string, string>();
  document.querySelectorAll('[id]').forEach((element) => {
    const id = element.getAttribute('id')!;
    if (ids.has(id)) throw new Error(`SVG ID 重复： ${id}`);
    ids.set(id, `${prefix}-${id}`);
    element.setAttribute('id', `${prefix}-${id}`);
  });
  document.querySelectorAll('*').forEach((element) => {
    for (const attribute of [...element.attributes]) {
      if (attribute.name === 'id') continue;
      let value = attribute.value.replace(
        /url\(#([^)]*)\)/g,
        (match, id: string) => (ids.has(id) ? `url(#${ids.get(id)})` : match),
      );
      if (
        (attribute.localName === 'href' || attribute.name === 'href') &&
        value.startsWith('#')
      )
        value = `#${ids.get(value.slice(1)) ?? value.slice(1)}`;
      if (['aria-labelledby', 'aria-describedby'].includes(attribute.name))
        value = value
          .split(/\s+/)
          .map((id) => ids.get(id) ?? id)
          .join(' ');
      if (value !== attribute.value)
        element.setAttributeNS(attribute.namespaceURI, attribute.name, value);
    }
  });
  return new XMLSerializer().serializeToString(document);
}

export function svgAccessibility(source: string) {
  const document = svgDocument(source);
  const root = document.documentElement;
  const title =
    [...root.children]
      .find((child) => child.localName === 'title')
      ?.textContent?.trim() ?? '';
  const description =
    [...root.children]
      .find((child) => child.localName === 'desc')
      ?.textContent?.trim() ?? '';
  const decorative = root.getAttribute('aria-hidden') === 'true';
  const label = root.getAttribute('aria-label')?.trim() ?? '';
  const labelledBy = root.getAttribute('aria-labelledby')?.trim() ?? '';
  const ids = new Set(
    [...root.querySelectorAll('[id]')].map((element) =>
      element.getAttribute('id'),
    ),
  );
  const missingReferences = labelledBy
    .split(/\s+/)
    .filter((id) => id && !ids.has(id));
  return {
    decorative,
    title,
    description,
    ariaLabel: label,
    missingReferences,
    hasAccessibleName:
      decorative ||
      Boolean(label || title || (labelledBy && !missingReferences.length)),
  };
}

export async function pdfPageSizes(file: File): Promise<string> {
  if (file.size > 40_000_000 || !file.name.toLowerCase().endsWith('.pdf'))
    throw new Error('请选择不超过 40 MB 的 PDF');
  const { PDFDocument } = await import('pdf-lib');
  const document = await PDFDocument.load(await file.arrayBuffer());
  if (document.getPageCount() > 500) throw new Error('PDF 超过 500 页');
  return json(
    document.getPages().map((page, index) => ({
      page: index + 1,
      widthPt: Number(page.getWidth().toFixed(2)),
      heightPt: Number(page.getHeight().toFixed(2)),
      rotation: page.getRotation().angle,
    })),
  );
}

export function silenceRegions(
  channels: Float32Array[],
  sampleRate: number,
  thresholdDb: number,
  minimumSeconds: number,
) {
  if (
    !channels.length ||
    channels.some((channel) => channel.length !== channels[0]!.length) ||
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0
  )
    throw new Error('音频无效');
  if (
    !Number.isFinite(thresholdDb) ||
    thresholdDb < -100 ||
    thresholdDb > -10 ||
    !Number.isFinite(minimumSeconds) ||
    minimumSeconds < 0.1 ||
    minimumSeconds > 60
  )
    throw new Error('静音设置无效');
  const frame = Math.max(1, Math.round(sampleRate * 0.02));
  const threshold = 10 ** (thresholdDb / 20);
  const regions: Array<{ start: number; end: number }> = [];
  let start = -1;
  for (let index = 0; index < channels[0]!.length; index += frame) {
    let peak = 0;
    for (const channel of channels)
      for (
        let sample = index;
        sample < Math.min(index + frame, channel.length);
        sample++
      )
        peak = Math.max(peak, Math.abs(channel[sample]!));
    const silent = peak <= threshold;
    if (silent && start < 0) start = index;
    if ((!silent || index + frame >= channels[0]!.length) && start >= 0) {
      const end = silent ? channels[0]!.length : index;
      if ((end - start) / sampleRate >= minimumSeconds)
        regions.push({
          start: Number((start / sampleRate).toFixed(2)),
          end: Number((end / sampleRate).toFixed(2)),
        });
      start = -1;
    }
  }
  return regions;
}

async function inspectSilence(
  file: File,
  threshold: number,
  minimum: number,
): Promise<string> {
  if (file.size > 25_000_000 || !file.type.startsWith('audio/'))
    throw new Error('请选择不超过 25 MB 的音频');
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    if (decoded.duration > 1800) throw new Error('音频超过 30 分钟');
    const channels = Array.from(
      { length: decoded.numberOfChannels },
      (_, index) => decoded.getChannelData(index),
    );
    return json({
      durationSeconds: Number(decoded.duration.toFixed(2)),
      regions: silenceRegions(channels, decoded.sampleRate, threshold, minimum),
    });
  } finally {
    await context.close();
  }
}

export const MEDIA_AUDITS: readonly WorkbenchTool[] = [
  {
    id: 'subtitleSpeed',
    fields: [
      {
        id: 'subtitle',
        label: 'subtitleInput',
        sample: '1\n00:00:01,000 --> 00:00:03,000\nHello',
      },
      { id: 'speed', label: 'playbackSpeed', kind: 'number', sample: '1.25' },
    ],
    run: ({ subtitle, speed }) => ({
      output: stretchSubtitles(subtitle ?? '', Number(speed)),
    }),
  },
  {
    id: 'svgIds',
    fields: [
      {
        id: 'svg',
        label: 'svgInput',
        sample:
          '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="a"/></defs><rect fill="url(#a)"/></svg>',
      },
      { id: 'prefix', label: 'idPrefix', sample: 'icon' },
    ],
    run: ({ svg, prefix }) => {
      const output = namespaceSvgIds(svg ?? '', prefix ?? '');
      return {
        output,
        download: {
          bytes: new TextEncoder().encode(output),
          name: 'namespaced.svg',
          type: 'image/svg+xml',
        },
      };
    },
  },
  {
    id: 'svgAccessibility',
    fields: [
      {
        id: 'svg',
        label: 'svgInput',
        sample:
          '<svg xmlns="http://www.w3.org/2000/svg"><title>Logo</title><circle r="4"/></svg>',
      },
    ],
    run: ({ svg }) => ({ output: json(svgAccessibility(svg ?? '')) }),
  },
  {
    id: 'pdfPageSizes',
    fields: [
      {
        id: 'file',
        label: 'pdfFile',
        kind: 'file',
        accept: '.pdf,application/pdf',
      },
    ],
    run: async (_values, file) => {
      if (!file) throw new Error('请选择 PDF');
      return { output: await pdfPageSizes(file) };
    },
  },
  {
    id: 'audioSilence',
    fields: [
      { id: 'file', label: 'audioFile', kind: 'file', accept: 'audio/*' },
      {
        id: 'threshold',
        label: 'silenceThreshold',
        kind: 'number',
        sample: '-50',
      },
      { id: 'minimum', label: 'minimumSilence', kind: 'number', sample: '0.5' },
    ],
    run: async ({ threshold, minimum }, file) => {
      if (!file) throw new Error('请选择音频');
      return {
        output: await inspectSilence(file, Number(threshold), Number(minimum)),
      };
    },
  },
];
