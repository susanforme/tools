import { contrastRatio } from './image-palette';
import {
  isHex,
  isNumberIn,
  isRecord,
  validateCreativeImage,
  type CreativeImage,
} from './creative-tools';
export const GENERIC_BEAD_COLORS = [
  '#ffffff',
  '#111111',
  '#ef4444',
  '#f97316',
  '#facc15',
  '#84cc16',
  '#22c55e',
  '#14b8a6',
  '#38bdf8',
  '#2563eb',
  '#8b5cf6',
  '#d946ef',
  '#ec4899',
  '#fda4af',
  '#92400e',
  '#94a3b8',
];
export type BeadGrid = {
  columns: number;
  rows: number;
  palette: string[];
  cells: number[];
};
export type BeadProject = {
  version: 1;
  image: CreativeImage | null;
  grid: BeadGrid | null;
};
export function parseBeadColors(text: string): string[] {
  const colors = [
    ...new Set(
      text
        .split(/[\s,;，；]+/)
        .filter(Boolean)
        .map((value) => value.toLowerCase()),
    ),
  ];
  if (
    !colors.length ||
    colors.length > 32 ||
    colors.some((value) => !isHex(value))
  )
    throw new Error('beadPattern.invalidColors');
  return colors;
}
export function beadUsage(grid: BeadGrid): number[] {
  const counts = grid.palette.map(() => 0);
  for (const index of grid.cells) counts[index]++;
  return counts;
}
export function quantizeBeads(
  pixels: Uint8ClampedArray,
  columns: number,
  rows: number,
  colors: string[],
  limit: number,
): BeadGrid {
  if (
    !Number.isInteger(columns) ||
    !Number.isInteger(rows) ||
    columns < 1 ||
    rows < 1 ||
    columns > 120 ||
    rows > 120 ||
    pixels.length !== columns * rows * 4 ||
    !colors.length ||
    colors.length > 32 ||
    colors.some((value) => !isHex(value)) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 32
  )
    throw new Error('beadPattern.invalidGrid');
  const rgb = colors.map((hex) =>
    [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)),
  );
  const nearest = (offset: number, choices: number[]) => {
    let winner = choices[0],
      distance = Infinity;
    const alpha = pixels[offset + 3] / 255;
    for (const candidate of choices) {
      const delta = rgb[candidate].reduce(
        (sum, value, channel) =>
          sum +
          (pixels[offset + channel] * alpha + 255 * (1 - alpha) - value) ** 2,
        0,
      );
      if (delta < distance) {
        distance = delta;
        winner = candidate;
      }
    }
    return winner;
  };
  const candidates = colors.map((_, index) => index),
    counts = colors.map(() => 0);
  for (let offset = 0; offset < pixels.length; offset += 4)
    counts[nearest(offset, candidates)]++;
  const selected = candidates
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, Math.min(limit, colors.length));
  const palette = selected.map((index) => colors[index]);
  const cells: number[] = [];
  for (let offset = 0; offset < pixels.length; offset += 4)
    cells.push(selected.indexOf(nearest(offset, selected)));
  return { columns, rows, palette, cells };
}
export function validateBeadProject(value: unknown): value is BeadProject {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !(value.image === null || validateCreativeImage(value.image))
  )
    return false;
  if (value.grid === null) return true;
  const grid = value.grid;
  return (
    isRecord(grid) &&
    isNumberIn(grid.columns, 1, 120) &&
    Number.isInteger(grid.columns) &&
    isNumberIn(grid.rows, 1, 120) &&
    Number.isInteger(grid.rows) &&
    Array.isArray(grid.palette) &&
    grid.palette.length >= 1 &&
    grid.palette.length <= 32 &&
    grid.palette.every(isHex) &&
    Array.isArray(grid.cells) &&
    grid.cells.length === grid.columns * grid.rows &&
    grid.cells.every(
      (cell: unknown) =>
        isNumberIn(cell, 0, (grid.palette as string[]).length - 1) &&
        Number.isInteger(cell),
    )
  );
}
export function drawBeadGrid(
  canvas: HTMLCanvasElement,
  grid: BeadGrid,
  labels = true,
  region = { x: 0, y: 0, columns: grid.columns, rows: grid.rows },
): void {
  const cell = labels ? 24 : 12;
  canvas.width = region.columns * cell;
  canvas.height = region.rows * cell;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('creativeCommon.canvasError');
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `${Math.round(cell * 0.42)}px sans-serif`;
  for (let y = 0; y < region.rows; y++)
    for (let x = 0; x < region.columns; x++) {
      const index = grid.cells[(y + region.y) * grid.columns + x + region.x],
        color = grid.palette[index];
      context.fillStyle = color;
      context.fillRect(x * cell, y * cell, cell, cell);
      context.strokeStyle = '#808080';
      context.lineWidth = 0.5;
      context.strokeRect(x * cell, y * cell, cell, cell);
      if (labels) {
        context.fillStyle =
          contrastRatio(color, '#000000') > contrastRatio(color, '#ffffff')
            ? '#000000'
            : '#ffffff';
        context.fillText(String(index + 1), (x + 0.5) * cell, (y + 0.5) * cell);
      }
    }
}
export async function beadPdf(
  grid: BeadGrid,
  title: string,
  paletteLabel: string,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const { PDFDocument, PageSizes, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  for (let y = 0; y < grid.rows; y += 50)
    for (let x = 0; x < grid.columns; x += 35) {
      signal.throwIfAborted();
      const canvas = document.createElement('canvas');
      drawBeadGrid(canvas, grid, true, {
        x,
        y,
        columns: Math.min(35, grid.columns - x),
        rows: Math.min(50, grid.rows - y),
      });
      const image = await pdf.embedPng(canvas.toDataURL('image/png'));
      const page = pdf.addPage(PageSizes.A4),
        scale = Math.min(520 / canvas.width, 720 / canvas.height);
      page.drawImage(image, {
        x: 36,
        y: 70 + (720 - canvas.height * scale),
        width: canvas.width * scale,
        height: canvas.height * scale,
      });
      page.drawText(
        `X: ${x + 1}-${x + Math.min(35, grid.columns - x)}  Y: ${y + 1}-${y + Math.min(50, grid.rows - y)}`,
        { x: 36, y: 40, size: 11 },
      );
      canvas.width = canvas.height = 0;
    }
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1250;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('creativeCommon.canvasError');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#111111';
  context.font = 'bold 32px sans-serif';
  context.fillText(title, 40, 60);
  context.font = '24px sans-serif';
  context.fillText(paletteLabel, 40, 110, 920);
  const counts = beadUsage(grid);
  grid.palette.forEach((color, index) => {
    const x = (index % 2) * 480 + 40,
      y = Math.floor(index / 2) * 62 + 150;
    context.fillStyle = color;
    context.fillRect(x, y, 38, 38);
    context.strokeStyle = '#777777';
    context.strokeRect(x, y, 38, 38);
    context.fillStyle = '#111111';
    context.fillText(
      `${index + 1}  ${color.toUpperCase()}  × ${counts[index]}`,
      x + 52,
      y + 28,
    );
  });
  const legend = await pdf.embedPng(canvas.toDataURL('image/png')),
    page = pdf.addPage(PageSizes.A4);
  page.drawRectangle({
    width: page.getWidth(),
    height: page.getHeight(),
    color: rgb(1, 1, 1),
  });
  page.drawImage(legend, { x: 25, y: 100, width: 545, height: 681 });
  signal.throwIfAborted();
  return pdf.save();
}
