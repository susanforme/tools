import type { ImageSource } from './image-document-tools';
export type SpriteFrame = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export function spriteLayout(
  images: Array<{ name: string; width: number; height: number }>,
  columns: number,
  gap: number,
) {
  if (
    !images.length ||
    images.length > 256 ||
    !Number.isInteger(columns) ||
    columns < 1 ||
    columns > 32 ||
    !Number.isInteger(gap) ||
    gap < 0 ||
    gap > 100
  )
    throw new Error('invalid');
  const cols = Math.min(columns, images.length),
    cellWidth = Math.max(...images.map((i) => i.width)),
    cellHeight = Math.max(...images.map((i) => i.height)),
    width = cols * (cellWidth + gap) - gap,
    height = Math.ceil(images.length / cols) * (cellHeight + gap) - gap;
  if (width > 8192 || height > 8192 || width * height > 32_000_000)
    throw new Error('imageLimit');
  return {
    width,
    height,
    frames: images.map((image, i) => ({
      ...image,
      x: (i % cols) * (cellWidth + gap),
      y: Math.floor(i / cols) * (cellHeight + gap),
    })),
  };
}
export async function makeSprites(
  images: ImageSource[],
  mode: string,
  columns: number,
  gap: number,
  frameWidth: number,
  frameHeight: number,
) {
  let frames: SpriteFrame[], width: number, height: number;
  const canvas = document.createElement('canvas');
  if (mode === 'slice') {
    const source = images[0];
    if (
      !source ||
      !Number.isInteger(frameWidth) ||
      !Number.isInteger(frameHeight) ||
      frameWidth < 1 ||
      frameHeight < 1 ||
      frameWidth > source.width ||
      frameHeight > source.height
    )
      throw new Error('invalid');
    const cols = Math.floor(source.width / frameWidth),
      rows = Math.floor(source.height / frameHeight);
    if (
      cols * rows > 256 ||
      source.width % frameWidth ||
      source.height % frameHeight
    )
      throw new Error('spriteDimensions');
    width = source.width;
    height = source.height;
    frames = Array.from({ length: cols * rows }, (_, i) => ({
      name: `frame-${i + 1}`,
      x: (i % cols) * frameWidth,
      y: Math.floor(i / cols) * frameHeight,
      width: frameWidth,
      height: frameHeight,
    }));
  } else ({ width, height, frames } = spriteLayout(images, columns, gap));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  for (const [i, source] of (mode === 'slice'
    ? images.slice(0, 1)
    : images
  ).entries()) {
    const bitmap = await createImageBitmap(source.blob);
    try {
      ctx.drawImage(
        bitmap,
        mode === 'slice' ? 0 : frames[i].x,
        mode === 'slice' ? 0 : frames[i].y,
      );
    } finally {
      bitmap.close();
    }
  }
  const urls = frames.map((frame) => {
    const cell = document.createElement('canvas');
    cell.width = frame.width;
    cell.height = frame.height;
    cell
      .getContext('2d')!
      .drawImage(
        canvas,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        0,
        0,
        frame.width,
        frame.height,
      );
    const url = cell.toDataURL();
    cell.width = cell.height = 0;
    return url;
  });
  const png = canvas.toDataURL();
  canvas.width = canvas.height = 0;
  return { png, urls, metadata: { width, height, frames } };
}
