export const MATH_TOOLS = [
  {
    id: 'fraction-calculator',
    iconClassName: 'text-blue-500',
    fields: [
      {
        key: 'a',
        value: '1/3',
      },
      {
        key: 'b',
        value: '1/6',
      },
    ],
    modes: ['add', 'subtract', 'multiply', 'divide'],
  },
  {
    id: 'percentage-calculator',
    iconClassName: 'text-emerald-500',
    fields: [
      {
        key: 'a',
        value: '20',
      },
      {
        key: 'b',
        value: '100',
      },
    ],
    modes: ['of', 'ratio', 'change'],
  },
  {
    id: 'gcd-lcm',
    iconClassName: 'text-amber-500',
    fields: [
      {
        key: 'values',
        value: '12, 18, 30',
        multiline: true,
      },
    ],
    modes: [],
  },
  {
    id: 'prime-factorization',
    iconClassName: 'text-violet-500',
    fields: [
      {
        key: 'n',
        value: '360',
      },
    ],
    modes: [],
  },
  {
    id: 'scientific-notation',
    iconClassName: 'text-cyan-500',
    fields: [
      {
        key: 'x',
        value: '123456.789',
      },
      {
        key: 'digits',
        value: '8',
      },
    ],
    modes: [],
  },
  {
    id: 'rounding-calculator',
    iconClassName: 'text-rose-500',
    fields: [
      {
        key: 'x',
        value: '-1.255',
      },
      {
        key: 'places',
        value: '2',
      },
    ],
    modes: ['nearest', 'floor', 'ceil', 'truncate'],
  },
  {
    id: 'power-root',
    iconClassName: 'text-orange-500',
    fields: [
      {
        key: 'x',
        value: '27',
      },
      {
        key: 'n',
        value: '3',
      },
    ],
    modes: ['power', 'root'],
  },
  {
    id: 'logarithm-calculator',
    iconClassName: 'text-teal-500',
    fields: [
      {
        key: 'x',
        value: '100',
      },
      {
        key: 'base',
        value: '10',
      },
    ],
    modes: [],
  },
  {
    id: 'quadratic-equation',
    iconClassName: 'text-fuchsia-500',
    fields: [
      {
        key: 'a',
        value: '1',
      },
      {
        key: 'b',
        value: '-3',
      },
      {
        key: 'c',
        value: '2',
      },
    ],
    modes: [],
  },
  {
    id: 'linear-system',
    iconClassName: 'text-sky-500',
    fields: [
      {
        key: 'matrix',
        value: '2, 1, 5\n1, -1, 1',
        multiline: true,
      },
    ],
    modes: [],
  },
  {
    id: 'matrix-calculator',
    iconClassName: 'text-indigo-500',
    fields: [
      {
        key: 'a',
        value: '1, 2\n3, 4',
        multiline: true,
      },
      {
        key: 'b',
        value: '5, 6\n7, 8',
        multiline: true,
      },
    ],
    modes: [
      'add',
      'subtract',
      'multiply',
      'transpose',
      'determinant',
      'inverse',
    ],
  },
  {
    id: 'statistics-calculator',
    iconClassName: 'text-green-500',
    fields: [
      {
        key: 'values',
        value: '2, 4, 4, 4, 5, 5, 7, 9',
        multiline: true,
      },
    ],
    modes: ['population', 'sample'],
  },
  {
    id: 'combinatorics',
    iconClassName: 'text-purple-500',
    fields: [
      {
        key: 'n',
        value: '10',
      },
      {
        key: 'r',
        value: '3',
      },
    ],
    modes: [],
  },
  {
    id: 'probability-calculator',
    iconClassName: 'text-pink-500',
    fields: [
      {
        key: 'a',
        value: '0.5',
      },
      {
        key: 'b',
        value: '0.3',
      },
    ],
    modes: [],
  },
  {
    id: 'binomial-distribution',
    iconClassName: 'text-lime-500',
    fields: [
      {
        key: 'n',
        value: '10',
      },
      {
        key: 'p',
        value: '0.5',
      },
      {
        key: 'k',
        value: '5',
      },
    ],
    modes: [],
  },
  {
    id: 'z-score',
    iconClassName: 'text-red-500',
    fields: [
      {
        key: 'x',
        value: '85',
      },
      {
        key: 'mean',
        value: '70',
      },
      {
        key: 'sd',
        value: '10',
      },
    ],
    modes: ['standardize', 'restore'],
  },
  {
    id: 'confidence-interval',
    iconClassName: 'text-yellow-500',
    fields: [
      {
        key: 'mean',
        value: '100',
      },
      {
        key: 'sd',
        value: '15',
      },
      {
        key: 'n',
        value: '100',
      },
    ],
    modes: ['95', '90', '99'],
  },
  {
    id: 'sample-size',
    iconClassName: 'text-slate-500',
    fields: [
      {
        key: 'p',
        value: '0.5',
      },
      {
        key: 'margin',
        value: '5',
      },
      {
        key: 'population',
        value: '0',
      },
    ],
    modes: ['95', '90', '99'],
  },
  {
    id: 'triangle-calculator',
    iconClassName: 'text-stone-500',
    fields: [
      {
        key: 'a',
        value: '3',
      },
      {
        key: 'b',
        value: '4',
      },
      {
        key: 'c',
        value: '5',
      },
    ],
    modes: [],
  },
  {
    id: 'sequence-calculator',
    iconClassName: 'text-zinc-500',
    fields: [
      {
        key: 'a',
        value: '2',
      },
      {
        key: 'd',
        value: '3',
      },
      {
        key: 'n',
        value: '10',
      },
    ],
    modes: ['arithmetic', 'geometric'],
  },
] as const;

export type MathToolId = (typeof MATH_TOOLS)[number]['id'];
