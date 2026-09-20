export interface PathOptions {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  mode: string;
}
export async function transformSvgPath(
  input: string,
  options: PathOptions,
): Promise<string> {
  if (!input.trim() || input.length > 20000) throw new Error('LIMIT');
  if (
    ![options.x, options.y, options.scale, options.rotate].every(
      (v) => Number.isFinite(v) && Math.abs(v) <= 100000,
    ) ||
    options.scale === 0
  )
    throw new Error('INVALID');
  const { default: svgpath } = await import('svgpath');
  const path = svgpath(input);
  if (Reflect.get(path, 'err'))
    throw new Error(String(Reflect.get(path, 'err')));
  path
    .scale(options.scale)
    .rotate(options.rotate)
    .translate(options.x, options.y);
  if (options.mode === 'relative') path.rel();
  else path.abs();
  const result = path.round(4).toString();
  if (/[IiNn]/.test(result) || result.length > 200000)
    throw new Error('INVALID');
  return result;
}
