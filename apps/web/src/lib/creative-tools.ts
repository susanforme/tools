import { canvasBlob, importImage } from './image-document-tools';

export type CreativeImage = {
  name: string;
  data: string;
  width: number;
  height: number;
};
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const isNumberIn = (
  value: unknown,
  min: number,
  max: number,
): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;
export const isHex = (value: unknown): value is string =>
  typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
export function validateCreativeImage(value: unknown): value is CreativeImage {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    value.name.length <= 300 &&
    typeof value.data === 'string' &&
    value.data.length < 25_000_000 &&
    /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(value.data) &&
    isNumberIn(value.width, 1, 2000) &&
    isNumberIn(value.height, 1, 2000)
  );
}
export function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('creativeCommon.imageError'));
    reader.readAsDataURL(blob);
  });
}
export async function readCreativeImage(file: File): Promise<CreativeImage> {
  const image = await importImage(file);
  try {
    return {
      name: image.name,
      data: await blobDataUrl(image.blob),
      width: image.width,
      height: image.height,
    };
  } finally {
    URL.revokeObjectURL(image.url);
  }
}
export async function decodeCreativeImage(
  source: CreativeImage,
): Promise<HTMLImageElement> {
  if (!validateCreativeImage(source))
    throw new Error('creativeCommon.invalidProject');
  const image = new Image();
  image.src = source.data;
  await image.decode();
  if (
    image.naturalWidth !== source.width ||
    image.naturalHeight !== source.height
  )
    throw new Error('creativeCommon.invalidProject');
  return image;
}
export async function canvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return canvasBlob(canvas);
}
export function escapeXml(value: string): string {
  return value.replace(
    /[<>&"']/g,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[character]!,
  );
}
