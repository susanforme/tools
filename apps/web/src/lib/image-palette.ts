export type PaletteColor = {
  bestText: '#000000' | '#ffffff';
  contrast: number;
  hex: string;
};

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map((start) =>
      Number.parseInt(hex.slice(start, start + 2), 16),
    );
    return (
      0.2126 * channel(rgb[0]!) +
      0.7152 * channel(rgb[1]!) +
      0.0722 * channel(rgb[2]!)
    );
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

export function extractPalette(
  data: Uint8ClampedArray,
  limit = 8,
): PaletteColor[] {
  const buckets = new Map<number, number>();
  for (let index = 0; index < data.length; index += 16) {
    if (data[index + 3]! < 128) continue;
    const key =
      (Math.round(data[index]! / 32) << 8) |
      (Math.round(data[index + 1]! / 32) << 4) |
      Math.round(data[index + 2]! / 32);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, limit)
    .map(([key]) => {
      const rgb = [key >> 8, (key >> 4) & 15, key & 15].map((value) =>
        Math.min(255, value * 32),
      );
      const hex = `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
      const black = contrastRatio(hex, '#000000');
      const white = contrastRatio(hex, '#ffffff');
      return {
        hex,
        bestText: black >= white ? '#000000' : '#ffffff',
        contrast: Math.max(black, white),
      };
    });
}
