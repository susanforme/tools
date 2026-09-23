import { svgToDataUri } from './svg-tools';
export type PatternOptions = {
  layout: string;
  width: number;
  height: number;
  size: number;
  angle: number;
  x: number;
  y: number;
  repeat: number;
  background: string;
  color: string;
  shape: string;
};
export function patternPeriod(options: PatternOptions): {
  width: number;
  height: number;
} {
  const { layout, width, height, size, angle, x, y, repeat } = options;
  if (
    !['grid', 'halfDrop', 'mirror'].includes(layout) ||
    ![width, height, size, angle, x, y, repeat].every(Number.isFinite) ||
    width < 16 ||
    width > 512 ||
    height < 16 ||
    height > 512 ||
    size < 1 ||
    size > Math.min(width, height) * 2 ||
    Math.abs(angle) > 360 ||
    x < 0 ||
    x > 100 ||
    y < 0 ||
    y > 100 ||
    !Number.isInteger(repeat) ||
    repeat < 1 ||
    repeat > 8 ||
    !/^#[0-9a-f]{6}$/i.test(options.color) ||
    !(
      options.background === 'transparent' ||
      /^#[0-9a-f]{6}$/i.test(options.background)
    )
  )
    throw new Error('pattern');
  return {
    width: width * (layout === 'grid' ? 1 : 2),
    height: height * (layout === 'mirror' ? 2 : 1),
  };
}
export function patternSvg(
  options: PatternOptions,
  motif: string | null,
  large: boolean,
): string {
  const period = patternPeriod(options),
    repeat = large ? options.repeat : 1;
  let design = motif;
  if (!design) {
    const graphic =
      options.shape === 'leaf'
        ? `<ellipse cx="50" cy="50" rx="20" ry="42" fill="${options.color}" transform="rotate(35 50 50)"/>`
        : options.shape === 'star'
          ? `<polygon points="${Array.from({ length: 10 }, (_, i) => {
              const a = (i * Math.PI) / 5 - Math.PI / 2,
                r = i % 2 ? 20 : 45;
              return `${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`;
            }).join(' ')}" fill="${options.color}"/>`
          : `<circle cx="50" cy="50" r="40" fill="${options.color}"/>`;
    design = svgToDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${graphic}</svg>`,
    );
  }
  if (
    !/^data:image\/(png|jpeg|webp|svg\+xml)[;,]/.test(design) ||
    design.length > 8000000
  )
    throw new Error('pattern');
  const items: string[] = [];
  for (let row = -2; row <= 3; row++)
    for (let col = -2; col <= 3; col++) {
      const sx = options.layout === 'mirror' && Math.abs(col % 2) ? -1 : 1,
        sy = options.layout === 'mirror' && Math.abs(row % 2) ? -1 : 1;
      const offsetX = (options.x / 100) * options.width,
        offsetY = (options.y / 100) * options.height;
      const x =
          col * options.width + (sx < 0 ? options.width - offsetX : offsetX),
        y =
          row * options.height +
          (sy < 0 ? options.height - offsetY : offsetY) +
          (options.layout === 'halfDrop' && Math.abs(col % 2)
            ? options.height / 2
            : 0);
      items.push(
        `<g transform="translate(${x} ${y}) scale(${sx} ${sy}) rotate(${options.angle})"><use href="#motif"/></g>`,
      );
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${period.width * repeat}" height="${period.height * repeat}" viewBox="0 0 ${period.width * repeat} ${period.height * repeat}"><defs><image id="motif" href="${design.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" x="${-options.size / 2}" y="${-options.size / 2}" width="${options.size}" height="${options.size}" preserveAspectRatio="xMidYMid meet"/><pattern id="tile" patternUnits="userSpaceOnUse" width="${period.width}" height="${period.height}">${options.background === 'transparent' ? '' : `<rect width="${period.width}" height="${period.height}" fill="${options.background}"/>`}${items.join('')}</pattern></defs><rect width="100%" height="100%" fill="url(#tile)"/></svg>`;
}
export function cleanMotifSvg(source: string): string {
  if (source.length > 500000 || /<!DOCTYPE|<!ENTITY/i.test(source))
    throw new Error('svg');
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (
    doc.querySelector('parsererror') ||
    doc.documentElement.localName !== 'svg' ||
    doc.querySelectorAll('*').length > 2000
  )
    throw new Error('svg');
  const tags = new Set([
    'svg',
    'g',
    'path',
    'rect',
    'circle',
    'ellipse',
    'line',
    'polygon',
    'polyline',
    'text',
    'defs',
    'linearGradient',
    'radialGradient',
    'stop',
    'clipPath',
  ]);
  const attrs = new Set([
    'viewBox',
    'width',
    'height',
    'x',
    'y',
    'x1',
    'x2',
    'y1',
    'y2',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'd',
    'points',
    'fill',
    'stroke',
    'stroke-width',
    'opacity',
    'fill-opacity',
    'stroke-opacity',
    'transform',
    'id',
    'offset',
    'stop-color',
    'stop-opacity',
    'clip-path',
    'font-size',
    'font-family',
    'text-anchor',
    'gradientUnits',
    'gradientTransform',
  ]);
  for (const node of Array.from(doc.querySelectorAll('*'))) {
    if (!tags.has(node.localName)) {
      node.remove();
      continue;
    }
    for (const attr of Array.from(node.attributes)) {
      if (
        !attrs.has(attr.name) ||
        (/url\s*\(/i.test(attr.value) && !/^url\(#[\w-]+\)$/.test(attr.value))
      )
        node.removeAttribute(attr.name);
    }
  }
  doc.documentElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(doc);
}
export async function patternPng(
  svg: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const blob = new Blob([svg], { type: 'image/svg+xml' }),
    url = URL.createObjectURL(blob),
    image = new Image();
  try {
    image.src = url;
    await image.decode();
    signal?.throwIfAborted();
    if (image.width * image.height > 16000000 || !image.width || !image.height)
      throw new Error('size');
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas');
      context.drawImage(image, 0, 0);
      const result = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error('canvas'))),
          'image/png',
        ),
      );
      signal?.throwIfAborted();
      return result;
    } finally {
      canvas.width = canvas.height = 0;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
