import { bookLayout } from './media-workspace-core';
export type BookPage = {
  id: string;
  template: string;
  photos: string[];
  text: string;
};
export type BookOptions = {
  width: number;
  height: number;
  bleed: number;
  margin: number;
};
export async function drawBookPage(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  page: BookPage,
  images: Record<string, Blob>,
  options: BookOptions,
) {
  const layout = bookLayout(
    page.template,
    options.width,
    options.height,
    options.bleed,
    options.margin,
  );
  canvas.width = Math.round(layout.width * 8);
  canvas.height = Math.round(layout.height * 8);
  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error('canvas');
  ctx.scale(8, 8);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, layout.width, layout.height);
  const full = page.template === 'cover' || page.template === 'bleed';
  const boxes = full
    ? [{ x: 0, y: 0, width: layout.width, height: layout.height }]
    : layout.boxes;
  for (const [i, box] of boxes.entries()) {
    const blob = images[page.photos[i] ?? ''];
    if (!blob) continue;
    const image = await createImageBitmap(blob);
    try {
      const scale = Math.max(
        box.width / image.width,
        box.height / image.height,
      );
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.width, box.height);
      ctx.clip();
      ctx.drawImage(
        image,
        box.x + (box.width - image.width * scale) / 2,
        box.y + (box.height - image.height * scale) / 2,
        image.width * scale,
        image.height * scale,
      );
      ctx.restore();
    } finally {
      image.close();
    }
  }
  if (page.text) {
    const x = options.bleed + options.margin;
    let y =
      page.template === 'cover'
        ? layout.height - options.bleed - options.margin - 35
        : page.template === 'caption'
          ? layout.textY + 5
          : layout.height - options.bleed - options.margin - 20;
    const size = page.template === 'cover' ? 8 : 4;
    ctx.font = `${size}px sans-serif`;
    ctx.textBaseline = 'top';
    if (full) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, y - 4, layout.width, layout.height - y + 4);
      ctx.fillStyle = '#fff';
    } else ctx.fillStyle = '#111827';
    let line = '';
    for (const char of page.text) {
      if (
        char === '\n' ||
        ctx.measureText(line + char).width > layout.textWidth
      ) {
        ctx.fillText(line, x, y);
        y += size * 1.4;
        line = char === '\n' ? '' : char;
      } else line += char;
      if (y > layout.height - options.bleed - options.margin - size)
        throw new Error('bookText');
    }
    if (line) ctx.fillText(line, x, y);
  }
  return layout;
}
