export function createPngIco(
  png: Uint8Array,
  width: number,
  height: number,
): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(22 + png.length);
  const view = new DataView(output.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  output[6] = width >= 256 ? 0 : width;
  output[7] = height >= 256 ? 0 : height;
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, png.length, true);
  view.setUint32(18, 22, true);
  output.set(png, 22);
  return output;
}
