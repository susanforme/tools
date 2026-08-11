export type ColorVisionMode =
  | 'protanopia'
  | 'deuteranopia'
  | 'tritanopia'
  | 'achromatopsia';

type Matrix = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const COLOR_VISION_MATRICES: Record<ColorVisionMode, Matrix> = {
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882,
    -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182,
    0.04294, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733,
    0.691367, 0.3039,
  ],
  achromatopsia: [
    0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722,
  ],
};

function toLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function toSrgb(value: number): number {
  const clamped = Math.min(Math.max(value, 0), 1);
  const normalized =
    clamped <= 0.0031308
      ? clamped * 12.92
      : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(normalized * 255);
}

export function simulateColorVision(
  rgb: readonly [number, number, number],
  mode: ColorVisionMode,
): [number, number, number] {
  const matrix = COLOR_VISION_MATRICES[mode];
  const [red, green, blue] = rgb.map(toLinear);
  return [
    toSrgb(matrix[0] * red! + matrix[1] * green! + matrix[2] * blue!),
    toSrgb(matrix[3] * red! + matrix[4] * green! + matrix[5] * blue!),
    toSrgb(matrix[6] * red! + matrix[7] * green! + matrix[8] * blue!),
  ];
}

export function simulateImagePixels(
  source: Uint8ClampedArray,
  mode: ColorVisionMode,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(source);
  for (let index = 0; index < output.length; index += 4) {
    const [red, green, blue] = simulateColorVision(
      [output[index]!, output[index + 1]!, output[index + 2]!],
      mode,
    );
    output[index] = red;
    output[index + 1] = green;
    output[index + 2] = blue;
  }
  return output;
}

export type JsonGraphNode = {
  id: string;
  parentId: string | null;
  label: string;
  detail: string;
  depth: number;
  row: number;
  kind: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
};

export type JsonGraph = {
  nodes: JsonGraphNode[];
  width: number;
  height: number;
  truncated: boolean;
};

function graphKind(value: unknown): JsonGraphNode['kind'] {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

function graphDetail(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} items`;
  if (value !== null && typeof value === 'object')
    return `${Object.keys(value).length} keys`;
  const detail = JSON.stringify(value);
  return (detail ?? String(value)).slice(0, 46);
}

export function buildJsonGraph(value: unknown, limit = 200): JsonGraph {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('INVALID_LIMIT');
  const nodes: JsonGraphNode[] = [];
  const rows: number[] = [];
  let truncated = false;

  const visit = (
    label: string,
    item: unknown,
    parentId: string | null,
    depth: number,
  ) => {
    if (nodes.length >= limit) {
      truncated = true;
      return;
    }
    const id = `node-${nodes.length}`;
    const row = rows[depth] ?? 0;
    rows[depth] = row + 1;
    nodes.push({
      id,
      parentId,
      label: label.slice(0, 28),
      detail: graphDetail(item),
      depth,
      row,
      kind: graphKind(item),
    });
    if (item !== null && typeof item === 'object') {
      for (const [key, child] of Object.entries(item)) {
        visit(key, child, id, depth + 1);
      }
    }
  };

  visit('$', value, null, 0);
  const maxDepth = Math.max(...nodes.map(({ depth }) => depth), 0);
  const maxRows = Math.max(...rows, 1);
  return {
    nodes,
    width: (maxDepth + 1) * 240 + 20,
    height: maxRows * 68 + 20,
    truncated,
  };
}

function escapeClosingTag(value: string, tag: 'script' | 'style'): string {
  return value.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);
}

export function createSandboxDocument({
  html,
  css,
  javascript,
  channel,
}: {
  html: string;
  css: string;
  javascript: string;
  channel: string;
}): string {
  const safeCss = escapeClosingTag(css, 'style');
  const safeJavascript = escapeClosingTag(javascript, 'script');
  const serializedChannel = JSON.stringify(channel);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>${safeCss}</style>
<script>
(() => {
  const channel = ${serializedChannel};
  const format = (value) => {
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch { return String(value); }
  };
  const send = (level, values) => parent.postMessage({
    channel,
    type: 'console',
    level,
    values: values.map(format),
  }, '*');
  for (const level of ['log', 'info', 'warn', 'error']) {
    console[level] = (...values) => send(level, values);
  }
  addEventListener('error', (event) => send('error', [event.message]));
  addEventListener('unhandledrejection', (event) => send('error', [event.reason]));
})();
</script>
</head>
<body>
${html}
<script>${safeJavascript}</script>
</body>
</html>`;
}
