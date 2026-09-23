export type PixelProject = {
  width: number;
  height: number;
  layers: Array<{ name: string; visible: boolean }>;
  frames: string[][][];
};
export function validPixelProject(value: unknown): value is PixelProject {
  if (!value || typeof value !== 'object') return false;
  const p = value as PixelProject;
  return (
    Number.isInteger(p.width) &&
    p.width >= 1 &&
    p.width <= 64 &&
    Number.isInteger(p.height) &&
    p.height >= 1 &&
    p.height <= 64 &&
    Array.isArray(p.layers) &&
    p.layers.length >= 1 &&
    p.layers.length <= 8 &&
    p.layers.every(
      (l) =>
        l &&
        typeof l.name === 'string' &&
        l.name.length <= 80 &&
        typeof l.visible === 'boolean',
    ) &&
    Array.isArray(p.frames) &&
    p.frames.length >= 1 &&
    p.frames.length <= 64 &&
    p.width * p.height * p.layers.length * p.frames.length <= 262144 &&
    p.frames.every(
      (f) =>
        Array.isArray(f) &&
        f.length === p.layers.length &&
        f.every(
          (l) =>
            Array.isArray(l) &&
            l.length === p.width * p.height &&
            l.every(
              (c) =>
                typeof c === 'string' &&
                (c === '' || /^#[0-9a-f]{6}$/i.test(c)),
            ),
        ),
    )
  );
}
export function pixelFrame(project: PixelProject, index: number): Uint8Array {
  if (!validPixelProject(project) || !project.frames[index])
    throw new Error('invalid');
  const bytes = new Uint8Array(project.width * project.height * 4);
  for (const [layer, pixels] of project.frames[index].entries())
    if (project.layers[layer].visible)
      for (let i = 0; i < pixels.length; i++) {
        const color = pixels[i];
        if (!color) continue;
        const value = Number.parseInt(color.slice(1), 16);
        bytes.set([value >> 16, (value >> 8) & 255, value & 255, 255], i * 4);
      }
  return bytes;
}
export function pixelLine(
  from: [number, number],
  to: [number, number],
): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  let [x, y] = from;
  const [endX, endY] = to,
    dx = Math.abs(endX - x),
    dy = -Math.abs(endY - y),
    sx = x < endX ? 1 : -1,
    sy = y < endY ? 1 : -1;
  let error = dx + dy;
  for (let i = 0; i < 128; i++) {
    result.push([x, y]);
    if (x === endX && y === endY) break;
    const double = 2 * error;
    if (double >= dy) {
      error += dy;
      x += sx;
    }
    if (double <= dx) {
      error += dx;
      y += sy;
    }
  }
  return result;
}
