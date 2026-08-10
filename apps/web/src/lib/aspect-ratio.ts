export type AspectPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
};

export const ASPECT_PRESETS: AspectPreset[] = [
  { id: '1:1', label: '1:1', width: 1, height: 1 },
  { id: '4:3', label: '4:3', width: 4, height: 3 },
  { id: '3:2', label: '3:2', width: 3, height: 2 },
  { id: '16:9', label: '16:9', width: 16, height: 9 },
  { id: '9:16', label: '9:16', width: 9, height: 16 },
  { id: '21:9', label: '21:9', width: 21, height: 9 },
  { id: '3:4', label: '3:4', width: 3, height: 4 },
  { id: '2:3', label: '2:3', width: 2, height: 3 },
];

export function heightFromWidth(
  width: number,
  ratioW: number,
  ratioH: number,
): number {
  if (ratioW === 0) return 0;
  return (width * ratioH) / ratioW;
}

export function widthFromHeight(
  height: number,
  ratioW: number,
  ratioH: number,
): number {
  if (ratioH === 0) return 0;
  return (height * ratioW) / ratioH;
}

export function simplifyRatio(
  width: number,
  height: number,
): { w: number; h: number } {
  const gcd = (a: number, b: number): number =>
    b === 0 ? a : gcd(b, a % b);
  const w = Math.round(Math.abs(width));
  const h = Math.round(Math.abs(height));
  if (w === 0 || h === 0) return { w: 0, h: 0 };
  const g = gcd(w, h);
  return { w: w / g, h: h / g };
}

export type SafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const SAFE_AREA_PRESETS: Array<{
  id: string;
  label: string;
  width: number;
  height: number;
  insets: SafeAreaInsets;
}> = [
  {
    id: 'iphone-14',
    label: 'iPhone 14',
    width: 390,
    height: 844,
    insets: { top: 47, right: 0, bottom: 34, left: 0 },
  },
  {
    id: 'iphone-14-pro',
    label: 'iPhone 14 Pro',
    width: 393,
    height: 852,
    insets: { top: 59, right: 0, bottom: 34, left: 0 },
  },
  {
    id: 'iphone-15-pro-max',
    label: 'iPhone 15 Pro Max',
    width: 430,
    height: 932,
    insets: { top: 59, right: 0, bottom: 34, left: 0 },
  },
  {
    id: 'android-nav',
    label: 'Android 手势条',
    width: 412,
    height: 915,
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
  },
  {
    id: 'ipad',
    label: 'iPad',
    width: 820,
    height: 1180,
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
  },
];

export function contentBox(
  width: number,
  height: number,
  insets: SafeAreaInsets,
) {
  return {
    width: Math.max(0, width - insets.left - insets.right),
    height: Math.max(0, height - insets.top - insets.bottom),
  };
}
