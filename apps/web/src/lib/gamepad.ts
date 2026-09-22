export type GamepadLayout = 'generic' | 'xbox' | 'playstation' | 'nintendo';
export interface GamepadSnapshot {
  id: string;
  index: number;
  mapping: string;
  buttons: { value: number; pressed: boolean; touched: boolean }[];
  axes: number[];
}
export interface StickPoint {
  x: number;
  y: number;
}

export const GAMEPAD_LAYOUTS = [
  'auto',
  'generic',
  'xbox',
  'playstation',
  'nintendo',
] as const;
export const STANDARD_BUTTONS = Array.from({ length: 17 }, (_, i) => `b${i}`);
export const STANDARD_AXES = ['0', '1', '2', '3'];
export const GAMEPAD_LABELS: Record<GamepadLayout, string[]> = {
  generic: [
    '1',
    '2',
    '3',
    '4',
    'L1',
    'R1',
    'L2',
    'R2',
    '◁',
    '▷',
    'L3',
    'R3',
    '↑',
    '↓',
    '←',
    '→',
    '⌂',
  ],
  xbox: [
    'A',
    'B',
    'X',
    'Y',
    'LB',
    'RB',
    'LT',
    'RT',
    'View',
    'Menu',
    'L3',
    'R3',
    '↑',
    '↓',
    '←',
    '→',
    'X',
  ],
  playstation: [
    '×',
    '○',
    '□',
    '△',
    'L1',
    'R1',
    'L2',
    'R2',
    'Share',
    'Options',
    'L3',
    'R3',
    '↑',
    '↓',
    '←',
    '→',
    'PS',
  ],
  nintendo: [
    'B',
    'A',
    'Y',
    'X',
    'L',
    'R',
    'ZL',
    'ZR',
    '−',
    '+',
    'L3',
    'R3',
    '↑',
    '↓',
    '←',
    '→',
    '⌂',
  ],
};

export function identifyGamepad(id: string): GamepadLayout {
  // ponytail: ID 仅推测外观，品牌伪装/驱动重命名时由用户手选；不据此猜测轴映射。
  if (/dualsense|dualshock|playstation|sony|054c/i.test(id))
    return 'playstation';
  if (/nintendo|switch|joy-con|057e/i.test(id)) return 'nintendo';
  if (/xbox|xinput|microsoft|045e/i.test(id)) return 'xbox';
  return 'generic';
}

export function readGamepadButton(
  pad: GamepadSnapshot,
  binding: string,
): number | null {
  const match = /^(b|a)(\d{1,3})([+\-><]?)$/.exec(binding);
  if (!match) return null;
  const index = Number(match[2]);
  if (match[1] === 'b' && !match[3]) {
    const button = pad.buttons[index];
    return button ? button.value : null;
  }
  const axis = pad.axes[index];
  if (match[1] !== 'a' || axis === undefined) return null;
  switch (match[3]) {
    case '+':
      return Math.max(0, axis);
    case '-':
      return Math.max(0, -axis);
    case '>':
      return (axis + 1) / 2;
    case '<':
      return (1 - axis) / 2;
    default:
      return null;
  }
}

export function readGamepadAxis(
  pad: GamepadSnapshot,
  binding: string,
): number | null {
  if (!/^-?\d{1,3}$/.test(binding)) return null;
  const inverted = binding.startsWith('-');
  const value = pad.axes[Number(binding.replace('-', ''))];
  return value === undefined ? null : value * (inverted ? -1 : 1);
}

export function gamepadBindings(
  value: string | undefined,
  fallback: string[],
): string[] {
  const items = value?.split(',');
  return fallback.map((defaultValue, i) =>
    items ? (items[i] ?? '_') : defaultValue,
  );
}

export function appendGamepadTrail(
  trail: StickPoint[],
  point: StickPoint,
): StickPoint[] {
  const last = trail.at(-1);
  if (last?.x === point.x && last?.y === point.y) return trail;
  return [...trail.slice(-119), point];
}
