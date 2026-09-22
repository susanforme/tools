export interface KeyboardKey {
  code: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type KeySpec = readonly [code: string, label: string, width?: number];
const UNIT = 48;

function row(keys: readonly KeySpec[], x: number, y: number): KeyboardKey[] {
  let offset = x;
  return keys.map(([code, label, width = 1]) => {
    const key = {
      code,
      label,
      x: offset,
      y,
      width: width * UNIT - 5,
      height: 43,
    };
    offset += width * UNIT;
    return key;
  });
}

function letters(value: string): KeySpec[] {
  return [...value].map((letter) => [`Key${letter}`, letter]);
}

// 标准 ANSI 104 键，使用物理 code 区分左右修饰键和数字小键盘。
export const KEYBOARD_KEYS: KeyboardKey[] = [
  ...row([['Escape', 'Esc']], 24, 24),
  ...[0, 1, 2].flatMap((group) =>
    row(
      Array.from({ length: 4 }, (_, i) => {
        const label = `F${group * 4 + i + 1}`;
        return [label, label] as const;
      }),
      120 + group * 216,
      24,
    ),
  ),
  ...row(
    [
      ['Backquote', '~ `'],
      ...Array.from({ length: 10 }, (_, i): KeySpec => {
        const digit = (i + 1) % 10;
        return [`Digit${digit}`, `${'!@#$%^&*()'[i]} ${digit}`];
      }),
      ['Minus', '_ −'],
      ['Equal', '+ ='],
      ['Backspace', 'Backspace', 2],
    ],
    24,
    98,
  ),
  ...row(
    [
      ['Tab', 'Tab', 1.5],
      ...letters('QWERTYUIOP'),
      ['BracketLeft', '{ ['],
      ['BracketRight', '} ]'],
      ['Backslash', '| \\', 1.5],
    ],
    24,
    150,
  ),
  ...row(
    [
      ['CapsLock', 'Caps Lock', 1.75],
      ...letters('ASDFGHJKL'),
      ['Semicolon', ': ;'],
      ['Quote', '" \''],
      ['Enter', 'Enter', 2.25],
    ],
    24,
    202,
  ),
  ...row(
    [
      ['ShiftLeft', 'Shift', 2.25],
      ...letters('ZXCVBNM'),
      ['Comma', '< ,'],
      ['Period', '> .'],
      ['Slash', '? /'],
      ['ShiftRight', 'Shift', 2.75],
    ],
    24,
    254,
  ),
  ...row(
    [
      ['ControlLeft', 'Ctrl', 1.25],
      ['MetaLeft', 'Win / ⌘', 1.25],
      ['AltLeft', 'Alt / ⌥', 1.25],
      ['Space', 'Space', 6.25],
      ['AltRight', 'Alt / ⌥', 1.25],
      ['MetaRight', 'Win / ⌘', 1.25],
      ['ContextMenu', 'Menu', 1.25],
      ['ControlRight', 'Ctrl', 1.25],
    ],
    24,
    306,
  ),
  ...row(
    [
      ['PrintScreen', 'PrtSc'],
      ['ScrollLock', 'ScrLk'],
      ['Pause', 'Pause'],
    ],
    768,
    24,
  ),
  ...row(
    [
      ['Insert', 'Ins'],
      ['Home', 'Home'],
      ['PageUp', 'PgUp'],
    ],
    768,
    98,
  ),
  ...row(
    [
      ['Delete', 'Del'],
      ['End', 'End'],
      ['PageDown', 'PgDn'],
    ],
    768,
    150,
  ),
  ...row([['ArrowUp', '↑']], 816, 254),
  ...row(
    [
      ['ArrowLeft', '←'],
      ['ArrowDown', '↓'],
      ['ArrowRight', '→'],
    ],
    768,
    306,
  ),
  ...row(
    [
      ['NumLock', 'Num'],
      ['NumpadDivide', '/'],
      ['NumpadMultiply', '×'],
      ['NumpadSubtract', '−'],
    ],
    936,
    98,
  ),
  ...row(
    [
      ['Numpad7', '7'],
      ['Numpad8', '8'],
      ['Numpad9', '9'],
    ],
    936,
    150,
  ),
  ...row(
    [
      ['Numpad4', '4'],
      ['Numpad5', '5'],
      ['Numpad6', '6'],
    ],
    936,
    202,
  ),
  ...row(
    [
      ['Numpad1', '1'],
      ['Numpad2', '2'],
      ['Numpad3', '3'],
    ],
    936,
    254,
  ),
  ...row(
    [
      ['Numpad0', '0', 2],
      ['NumpadDecimal', '.'],
    ],
    936,
    306,
  ),
  { code: 'NumpadAdd', label: '+', x: 1080, y: 150, width: 43, height: 95 },
  {
    code: 'NumpadEnter',
    label: 'Enter',
    x: 1080,
    y: 254,
    width: 43,
    height: 95,
  },
];
