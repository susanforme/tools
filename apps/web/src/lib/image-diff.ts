export function createPixelDiff(
  first: ImageData,
  second: ImageData,
  heatmap: boolean,
): { image: ImageData; changed: number; total: number } {
  if (first.width !== second.width || first.height !== second.height) {
    throw new Error('图片尺寸必须一致');
  }
  const result = diffPixelData(first.data, second.data, heatmap);
  return {
    image: new ImageData(result.data, first.width, first.height),
    changed: result.changed,
    total: result.total,
  };
}

export function diffPixelData(
  first: Uint8ClampedArray,
  second: Uint8ClampedArray,
  heatmap: boolean,
): {
  data: Uint8ClampedArray<ArrayBuffer>;
  changed: number;
  total: number;
} {
  if (first.length !== second.length || first.length % 4 !== 0) {
    throw new Error('像素数据长度必须一致');
  }
  const output = new Uint8ClampedArray(new ArrayBuffer(first.length));
  let changed = 0;
  for (let index = 0; index < first.length; index += 4) {
    const delta = Math.max(
      Math.abs((first[index] ?? 0) - (second[index] ?? 0)),
      Math.abs((first[index + 1] ?? 0) - (second[index + 1] ?? 0)),
      Math.abs((first[index + 2] ?? 0) - (second[index + 2] ?? 0)),
      Math.abs((first[index + 3] ?? 0) - (second[index + 3] ?? 0)),
    );
    if (delta > 8) changed += 1;
    if (heatmap) {
      output[index] = delta;
      output[index + 1] = Math.max(255 - delta * 2, 0);
      output[index + 2] = 0;
      output[index + 3] = 255;
    } else {
      output[index] = delta;
      output[index + 1] = delta;
      output[index + 2] = delta;
      output[index + 3] = 255;
    }
  }
  return { data: output, changed, total: first.length / 4 };
}
