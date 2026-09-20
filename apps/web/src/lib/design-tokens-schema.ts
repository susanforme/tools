import type { AnySchema } from 'ajv';

const number = { type: 'number' };
const ref = (name: string) => ({ $ref: `#/definitions/${name}` });
const object = (
  properties: Record<string, unknown>,
  optional: string[] = [],
) => ({
  type: 'object',
  properties,
  required: Object.keys(properties).filter((key) => !optional.includes(key)),
  additionalProperties: false,
});
const array = (items: unknown) => ({ type: 'array', items, minItems: 1 });
export const WEIGHTS: Record<string, number> = {
  thin: 100,
  hairline: 100,
  'extra-light': 200,
  'ultra-light': 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  medium: 500,
  'semi-bold': 600,
  'demi-bold': 600,
  bold: 700,
  'extra-bold': 800,
  'ultra-bold': 800,
  black: 900,
  heavy: 900,
  'extra-black': 950,
  'ultra-black': 950,
};
export const COLOR_SPACES = [
  'srgb',
  'srgb-linear',
  'display-p3',
  'a98-rgb',
  'prophoto-rgb',
  'rec2020',
  'xyz-d65',
  'xyz-d50',
  'hsl',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
];
const shadow = object(
  {
    color: ref('color'),
    offsetX: ref('dimension'),
    offsetY: ref('dimension'),
    blur: ref('dimension'),
    spread: ref('dimension'),
    inset: { type: 'boolean' },
  },
  ['inset'],
);
export const DEFINITIONS: Record<string, AnySchema> = {
  number,
  dimension: object({ value: number, unit: { enum: ['px', 'rem'] } }),
  duration: object({ value: number, unit: { enum: ['ms', 's'] } }),
  fontFamily: { anyOf: [{ type: 'string' }, array({ type: 'string' })] },
  fontWeight: {
    anyOf: [
      { type: 'number', minimum: 1, maximum: 1000 },
      { enum: Object.keys(WEIGHTS) },
    ],
  },
  cubicBezier: {
    type: 'array',
    items: [
      { type: 'number', minimum: 0, maximum: 1 },
      number,
      { type: 'number', minimum: 0, maximum: 1 },
      number,
    ],
    minItems: 4,
    maxItems: 4,
    additionalItems: false,
  },
  color: object(
    {
      colorSpace: { enum: COLOR_SPACES },
      components: {
        type: 'array',
        items: { anyOf: [number, { const: 'none' }] },
        minItems: 3,
        maxItems: 3,
      },
      alpha: { type: 'number', minimum: 0, maximum: 1 },
      hex: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
    },
    ['alpha', 'hex'],
  ),
  strokeStyle: {
    enum: [
      'solid',
      'dashed',
      'dotted',
      'double',
      'groove',
      'ridge',
      'outset',
      'inset',
    ],
  },
  border: object({
    color: ref('color'),
    width: ref('dimension'),
    style: ref('strokeStyle'),
  }),
  transition: object({
    duration: ref('duration'),
    delay: ref('duration'),
    timingFunction: ref('cubicBezier'),
  }),
  shadow: { anyOf: [shadow, array(shadow)] },
  gradient: array(object({ color: ref('color'), position: number })),
  typography: object({
    fontFamily: ref('fontFamily'),
    fontSize: ref('dimension'),
    fontWeight: ref('fontWeight'),
    letterSpacing: ref('dimension'),
    lineHeight: number,
  }),
};
