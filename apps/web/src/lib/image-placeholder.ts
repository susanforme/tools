export interface PlaceholderRequest {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  components: number;
}
export interface PlaceholderResult {
  thumbhash: string;
  thumbUrl: string;
  blurhash: string;
  blurPixels: Uint8ClampedArray;
  width: number;
  height: number;
}
export async function createImagePlaceholder(
  request: PlaceholderRequest,
): Promise<PlaceholderResult> {
  const { pixels, width, height, components } = request;
  if (
    ![width, height, components].every(Number.isInteger) ||
    width < 1 ||
    height < 1 ||
    width > 100 ||
    height > 100 ||
    components < 2 ||
    components > 6 ||
    pixels.length !== width * height * 4
  )
    throw new Error('INVALID');
  const [thumb, blur] = await Promise.all([
    import('thumbhash'),
    import('blurhash'),
  ]);
  const hash = thumb.rgbaToThumbHash(width, height, pixels);
  const opaque = new Uint8ClampedArray(pixels);
  for (let i = 0; i < opaque.length; i += 4) {
    const alpha = opaque[i + 3] / 255;
    for (let c = 0; c < 3; c++)
      opaque[i + c] = Math.round(opaque[i + c] * alpha + 255 * (1 - alpha));
    opaque[i + 3] = 255;
  }
  const blurhash = blur.encode(opaque, width, height, components, components);
  const outWidth = Math.max(
    1,
    Math.round((width / Math.max(width, height)) * 64),
  );
  const outHeight = Math.max(
    1,
    Math.round((height / Math.max(width, height)) * 64),
  );
  return {
    thumbhash: btoa(String.fromCharCode(...hash)),
    thumbUrl: thumb.thumbHashToDataURL(hash),
    blurhash,
    blurPixels: blur.decode(blurhash, outWidth, outHeight),
    width: outWidth,
    height: outHeight,
  };
}
