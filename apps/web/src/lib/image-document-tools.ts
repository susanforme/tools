export type ImageSource = {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
};
export type Point = { x: number; y: number };
export type Corners = [Point, Point, Point, Point];
export const FULL_CORNERS: Corners = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
export const MAX_IMAGES = 20;

export function canvasBlob(
  canvas: HTMLCanvasElement,
  type = 'image/png',
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('imageDocumentCommon.errors.encode')),
      type,
      0.92,
    ),
  );
}

export async function importImage(file: File): Promise<ImageSource> {
  if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024)
    throw new Error('imageDocumentCommon.errors.fileSize');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 50_000_000)
      throw new Error('imageDocumentCommon.errors.imagePixels');
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('imageDocumentCommon.errors.canvas');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await canvasBlob(canvas);
    return {
      id: crypto.randomUUID(),
      name: file.name,
      blob,
      url: URL.createObjectURL(blob),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    bitmap.close();
  }
}

export type CollageLayout = 'vertical' | 'horizontal' | 'grid';
export function collageLayout(
  images: Array<{ width: number; height: number }>,
  mode: CollageLayout,
  width: number,
  gap: number,
  columns: number,
) {
  if (
    !images.length ||
    !Number.isFinite(width) ||
    width < 1 ||
    !Number.isFinite(gap) ||
    gap < 0 ||
    !Number.isInteger(columns) ||
    columns < 1 ||
    images.some(
      (image) =>
        !Number.isFinite(image.width) ||
        !Number.isFinite(image.height) ||
        image.width <= 0 ||
        image.height <= 0,
    )
  )
    throw new Error('imageDocumentCommon.errors.dimensions');
  const cols =
    mode === 'vertical'
      ? 1
      : mode === 'horizontal'
        ? images.length
        : Math.min(columns, images.length);
  const heights = images.map((image) =>
    Math.max(1, Math.round((width * image.height) / image.width)),
  );
  const placements: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];
  let y = gap;
  for (let row = 0; row < images.length; row += cols) {
    const rowHeight = Math.max(...heights.slice(row, row + cols));
    for (
      let column = 0;
      column < cols && row + column < images.length;
      column++
    )
      placements.push({
        x: gap + column * (width + gap),
        y,
        width,
        height: heights[row + column],
      });
    y += rowHeight + gap;
  }
  const outputWidth = cols * width + (cols + 1) * gap;
  if (outputWidth > 16384 || y > 16384 || outputWidth * y > 24_000_000)
    throw new Error('imageDocumentCommon.errors.collageSize');
  return { width: outputWidth, height: y, placements };
}

export function validCorners(points: Corners): boolean {
  if (
    points.some(
      ({ x, y }) =>
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < 0 ||
        x > 1 ||
        y < 0 ||
        y > 1,
    )
  )
    return false;
  let area = 0;
  for (let index = 0; index < 4; index++) {
    const a = points[index],
      b = points[(index + 1) % 4],
      c = points[(index + 2) % 4];
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) <= 0.00001)
      return false;
    area += a.x * b.y - b.x * a.y;
  }
  return area >= 0.002;
}

// 从单位矩形反向映射至原图四边形，避免正向映射产生空洞。
export function perspectiveTransform(
  points: Corners,
): (x: number, y: number) => Point {
  if (!validCorners(points))
    throw new Error('imageDocumentCommon.errors.corners');
  const matrix: number[][] = [];
  FULL_CORNERS.forEach(({ x, y }, index) => {
    const point = points[index];
    matrix.push([x, y, 1, 0, 0, 0, -point.x * x, -point.x * y, point.x]);
    matrix.push([0, 0, 0, x, y, 1, -point.y * x, -point.y * y, point.y]);
  });
  for (let column = 0; column < 8; column++) {
    let pivot = column;
    for (let row = column + 1; row < 8; row++)
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column]))
        pivot = row;
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    const divisor = matrix[column][column];
    if (Math.abs(divisor) < 1e-10)
      throw new Error('imageDocumentCommon.errors.smallArea');
    for (let entry = column; entry <= 8; entry++)
      matrix[column][entry] /= divisor;
    for (let row = 0; row < 8; row++) {
      if (row === column) continue;
      const factor = matrix[row][column];
      for (let entry = column; entry <= 8; entry++)
        matrix[row][entry] -= factor * matrix[column][entry];
    }
  }
  const h = matrix.map((row) => row[8]);
  return (x, y) => {
    const denominator = h[6] * x + h[7] * y + 1;
    return {
      x: (h[0] * x + h[1] * y + h[2]) / denominator,
      y: (h[3] * x + h[4] * y + h[5]) / denominator,
    };
  };
}

export async function scanImage(
  source: ImageSource,
  corners: Corners,
  blackWhite: boolean,
  threshold: number,
  signal: AbortSignal,
): Promise<HTMLCanvasElement> {
  const transform = perspectiveTransform(corners);
  const bitmap = await createImageBitmap(source.blob);
  try {
    signal.throwIfAborted();
    const input = document.createElement('canvas');
    input.width = source.width;
    input.height = source.height;
    const context = input.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('imageDocumentCommon.errors.canvas');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, input.width, input.height);
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, input.width, input.height);
    const distance = (a: Point, b: Point) =>
      Math.hypot((a.x - b.x) * input.width, (a.y - b.y) * input.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(
      2,
      Math.round(
        Math.max(
          distance(corners[0], corners[1]),
          distance(corners[3], corners[2]),
        ),
      ),
    );
    canvas.height = Math.max(
      2,
      Math.round(
        Math.max(
          distance(corners[0], corners[3]),
          distance(corners[1], corners[2]),
        ),
      ),
    );
    const outputContext = canvas.getContext('2d');
    if (!outputContext) throw new Error('imageDocumentCommon.errors.canvas');
    const output = outputContext.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      if (y % 64 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        signal.throwIfAborted();
      }
      for (let x = 0; x < canvas.width; x++) {
        const mapped = transform(
          x / (canvas.width - 1),
          y / (canvas.height - 1),
        );
        const sx = Math.max(
          0,
          Math.min(input.width - 1, mapped.x * (input.width - 1)),
        );
        const sy = Math.max(
          0,
          Math.min(input.height - 1, mapped.y * (input.height - 1)),
        );
        const x0 = Math.floor(sx),
          y0 = Math.floor(sy),
          x1 = Math.min(x0 + 1, input.width - 1),
          y1 = Math.min(y0 + 1, input.height - 1);
        const dx = sx - x0,
          dy = sy - y0,
          index = (y * canvas.width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          output.data[index + channel] =
            pixels.data[(y0 * input.width + x0) * 4 + channel] *
              (1 - dx) *
              (1 - dy) +
            pixels.data[(y0 * input.width + x1) * 4 + channel] * dx * (1 - dy) +
            pixels.data[(y1 * input.width + x0) * 4 + channel] * (1 - dx) * dy +
            pixels.data[(y1 * input.width + x1) * 4 + channel] * dx * dy;
        }
        if (blackWhite) {
          const value =
            output.data[index] * 0.299 +
              output.data[index + 1] * 0.587 +
              output.data[index + 2] * 0.114 >=
            threshold
              ? 255
              : 0;
          output.data[index] =
            output.data[index + 1] =
            output.data[index + 2] =
              value;
        }
        output.data[index + 3] = 255;
      }
    }
    outputContext.putImageData(output, 0, 0);
    return canvas;
  } finally {
    bitmap.close();
  }
}
