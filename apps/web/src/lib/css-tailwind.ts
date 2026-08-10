const SPACING: Record<string, string> = {
  '0': '0',
  '1': '0.25rem',
  '2': '0.5rem',
  '3': '0.75rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '8': '2rem',
  '10': '2.5rem',
  '12': '3rem',
  '16': '4rem',
  '20': '5rem',
  '24': '6rem',
  px: '1px',
};

const COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  transparent: 'transparent',
  'slate-500': '#64748b',
  'gray-500': '#6b7280',
  'zinc-500': '#71717a',
  'red-500': '#ef4444',
  'orange-500': '#f97316',
  'amber-500': '#f59e0b',
  'yellow-500': '#eab308',
  'lime-500': '#84cc16',
  'green-500': '#22c55e',
  'emerald-500': '#10b981',
  'teal-500': '#14b8a6',
  'cyan-500': '#06b6d4',
  'sky-500': '#0ea5e9',
  'blue-500': '#3b82f6',
  'indigo-500': '#6366f1',
  'violet-500': '#8b5cf6',
  'purple-500': '#a855f7',
  'fuchsia-500': '#d946ef',
  'pink-500': '#ec4899',
  'rose-500': '#f43f5e',
};

type Rule = { test: RegExp; css: (match: RegExpMatchArray) => string | null };

function spacing(value: string, property: string): string | null {
  const size = SPACING[value];
  return size == null ? null : `${property}: ${size};`;
}

const CLASS_RULES: Rule[] = [
  { test: /^flex$/, css: () => 'display: flex;' },
  { test: /^inline-flex$/, css: () => 'display: inline-flex;' },
  { test: /^grid$/, css: () => 'display: grid;' },
  { test: /^hidden$/, css: () => 'display: none;' },
  { test: /^block$/, css: () => 'display: block;' },
  { test: /^inline-block$/, css: () => 'display: inline-block;' },
  { test: /^items-center$/, css: () => 'align-items: center;' },
  { test: /^items-start$/, css: () => 'align-items: flex-start;' },
  { test: /^items-end$/, css: () => 'align-items: flex-end;' },
  { test: /^justify-center$/, css: () => 'justify-content: center;' },
  { test: /^justify-between$/, css: () => 'justify-content: space-between;' },
  { test: /^justify-start$/, css: () => 'justify-content: flex-start;' },
  { test: /^justify-end$/, css: () => 'justify-content: flex-end;' },
  { test: /^flex-col$/, css: () => 'flex-direction: column;' },
  { test: /^flex-row$/, css: () => 'flex-direction: row;' },
  { test: /^flex-wrap$/, css: () => 'flex-wrap: wrap;' },
  { test: /^flex-1$/, css: () => 'flex: 1 1 0%;' },
  { test: /^grow$/, css: () => 'flex-grow: 1;' },
  { test: /^shrink-0$/, css: () => 'flex-shrink: 0;' },
  { test: /^text-left$/, css: () => 'text-align: left;' },
  { test: /^text-center$/, css: () => 'text-align: center;' },
  { test: /^text-right$/, css: () => 'text-align: right;' },
  { test: /^font-bold$/, css: () => 'font-weight: 700;' },
  { test: /^font-medium$/, css: () => 'font-weight: 500;' },
  { test: /^font-semibold$/, css: () => 'font-weight: 600;' },
  { test: /^font-normal$/, css: () => 'font-weight: 400;' },
  { test: /^italic$/, css: () => 'font-style: italic;' },
  { test: /^underline$/, css: () => 'text-decoration-line: underline;' },
  { test: /^uppercase$/, css: () => 'text-transform: uppercase;' },
  { test: /^lowercase$/, css: () => 'text-transform: lowercase;' },
  { test: /^truncate$/, css: () => 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' },
  { test: /^rounded$/, css: () => 'border-radius: 0.25rem;' },
  { test: /^rounded-md$/, css: () => 'border-radius: 0.375rem;' },
  { test: /^rounded-lg$/, css: () => 'border-radius: 0.5rem;' },
  { test: /^rounded-xl$/, css: () => 'border-radius: 0.75rem;' },
  { test: /^rounded-full$/, css: () => 'border-radius: 9999px;' },
  { test: /^border$/, css: () => 'border-width: 1px;' },
  { test: /^shadow$/, css: () => 'box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);' },
  { test: /^shadow-md$/, css: () => 'box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);' },
  { test: /^shadow-lg$/, css: () => 'box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);' },
  { test: /^w-full$/, css: () => 'width: 100%;' },
  { test: /^h-full$/, css: () => 'height: 100%;' },
  { test: /^min-h-screen$/, css: () => 'min-height: 100vh;' },
  {
    test: /^p-(\w+)$/,
    css: (m) => spacing(m[1]!, 'padding'),
  },
  {
    test: /^px-(\w+)$/,
    css: (m) => {
      const size = SPACING[m[1]!];
      return size ? `padding-left: ${size}; padding-right: ${size};` : null;
    },
  },
  {
    test: /^py-(\w+)$/,
    css: (m) => {
      const size = SPACING[m[1]!];
      return size ? `padding-top: ${size}; padding-bottom: ${size};` : null;
    },
  },
  { test: /^pt-(\w+)$/, css: (m) => spacing(m[1]!, 'padding-top') },
  { test: /^pr-(\w+)$/, css: (m) => spacing(m[1]!, 'padding-right') },
  { test: /^pb-(\w+)$/, css: (m) => spacing(m[1]!, 'padding-bottom') },
  { test: /^pl-(\w+)$/, css: (m) => spacing(m[1]!, 'padding-left') },
  {
    test: /^m-(\w+)$/,
    css: (m) => spacing(m[1]!, 'margin'),
  },
  {
    test: /^mx-(\w+)$/,
    css: (m) => {
      const size = SPACING[m[1]!];
      return size ? `margin-left: ${size}; margin-right: ${size};` : null;
    },
  },
  {
    test: /^my-(\w+)$/,
    css: (m) => {
      const size = SPACING[m[1]!];
      return size ? `margin-top: ${size}; margin-bottom: ${size};` : null;
    },
  },
  { test: /^mt-(\w+)$/, css: (m) => spacing(m[1]!, 'margin-top') },
  { test: /^mr-(\w+)$/, css: (m) => spacing(m[1]!, 'margin-right') },
  { test: /^mb-(\w+)$/, css: (m) => spacing(m[1]!, 'margin-bottom') },
  { test: /^ml-(\w+)$/, css: (m) => spacing(m[1]!, 'margin-left') },
  {
    test: /^gap-(\w+)$/,
    css: (m) => spacing(m[1]!, 'gap'),
  },
  {
    test: /^w-(\w+)$/,
    css: (m) => spacing(m[1]!, 'width'),
  },
  {
    test: /^h-(\w+)$/,
    css: (m) => spacing(m[1]!, 'height'),
  },
  {
    test: /^text-(xs|sm|base|lg|xl|2xl|3xl)$/,
    css: (m) => {
      const map: Record<string, string> = {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
      };
      return `font-size: ${map[m[1]!]};`;
    },
  },
  {
    test: /^text-(.+)$/,
    css: (m) => {
      const color = COLORS[m[1]!];
      return color ? `color: ${color};` : null;
    },
  },
  {
    test: /^bg-(.+)$/,
    css: (m) => {
      const color = COLORS[m[1]!];
      return color ? `background-color: ${color};` : null;
    },
  },
  {
    test: /^border-(.+)$/,
    css: (m) => {
      if (m[1] === '0') return 'border-width: 0;';
      const color = COLORS[m[1]!];
      return color ? `border-color: ${color};` : null;
    },
  },
];

export function tailwindClassesToCss(classNames: string): {
  css: string;
  unknown: string[];
} {
  const classes = classNames
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const lines: string[] = [];
  const unknown: string[] = [];

  for (const className of classes) {
    let matched = false;
    for (const rule of CLASS_RULES) {
      const match = className.match(rule.test);
      if (!match) continue;
      const css = rule.css(match);
      if (css) {
        lines.push(...css.split(/(?<=;)\s*/).filter(Boolean));
        matched = true;
        break;
      }
    }
    if (!matched) unknown.push(className);
  }

  return {
    css: lines.join('\n'),
    unknown,
  };
}

const CSS_TO_TW: Array<{ test: RegExp; tw: (m: RegExpMatchArray) => string | null }> = [
  { test: /^display:\s*flex;?$/i, tw: () => 'flex' },
  { test: /^display:\s*grid;?$/i, tw: () => 'grid' },
  { test: /^display:\s*none;?$/i, tw: () => 'hidden' },
  { test: /^display:\s*block;?$/i, tw: () => 'block' },
  { test: /^flex-direction:\s*column;?$/i, tw: () => 'flex-col' },
  { test: /^flex-direction:\s*row;?$/i, tw: () => 'flex-row' },
  { test: /^align-items:\s*center;?$/i, tw: () => 'items-center' },
  { test: /^justify-content:\s*center;?$/i, tw: () => 'justify-center' },
  { test: /^justify-content:\s*space-between;?$/i, tw: () => 'justify-between' },
  { test: /^font-weight:\s*700;?$/i, tw: () => 'font-bold' },
  { test: /^font-weight:\s*600;?$/i, tw: () => 'font-semibold' },
  { test: /^font-weight:\s*500;?$/i, tw: () => 'font-medium' },
  { test: /^text-align:\s*center;?$/i, tw: () => 'text-center' },
  { test: /^text-align:\s*left;?$/i, tw: () => 'text-left' },
  { test: /^text-align:\s*right;?$/i, tw: () => 'text-right' },
  { test: /^width:\s*100%;?$/i, tw: () => 'w-full' },
  { test: /^height:\s*100%;?$/i, tw: () => 'h-full' },
  { test: /^border-radius:\s*9999px;?$/i, tw: () => 'rounded-full' },
  { test: /^border-radius:\s*0\.5rem;?$/i, tw: () => 'rounded-lg' },
  { test: /^border-radius:\s*0\.375rem;?$/i, tw: () => 'rounded-md' },
  { test: /^border-radius:\s*0\.25rem;?$/i, tw: () => 'rounded' },
  {
    test: /^(padding|margin|gap|width|height):\s*([^;]+);?$/i,
    tw: (m) => {
      const prop = m[1]!.toLowerCase();
      const value = m[2]!.trim();
      const key = Object.entries(SPACING).find(([, v]) => v === value)?.[0];
      if (!key) return null;
      const prefix =
        prop === 'padding'
          ? 'p'
          : prop === 'margin'
            ? 'm'
            : prop === 'gap'
              ? 'gap'
              : prop === 'width'
                ? 'w'
                : 'h';
      return `${prefix}-${key}`;
    },
  },
  {
    test: /^color:\s*([^;]+);?$/i,
    tw: (m) => {
      const value = m[1]!.trim().toLowerCase();
      const key = Object.entries(COLORS).find(
        ([, v]) => v.toLowerCase() === value,
      )?.[0];
      return key ? `text-${key}` : null;
    },
  },
  {
    test: /^background-color:\s*([^;]+);?$/i,
    tw: (m) => {
      const value = m[1]!.trim().toLowerCase();
      const key = Object.entries(COLORS).find(
        ([, v]) => v.toLowerCase() === value,
      )?.[0];
      return key ? `bg-${key}` : null;
    },
  },
];

export function cssToTailwindClasses(css: string): {
  classes: string;
  unknown: string[];
} {
  const declarations = css
    .replace(/\{|\}/g, '\n')
    .split(/[\n;]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.endsWith(';') ? line : `${line};`));

  const classes: string[] = [];
  const unknown: string[] = [];

  for (const declaration of declarations) {
    let matched = false;
    for (const rule of CSS_TO_TW) {
      const match = declaration.match(rule.test);
      if (!match) continue;
      const tw = rule.tw(match);
      if (tw) {
        classes.push(tw);
        matched = true;
        break;
      }
    }
    if (!matched) unknown.push(declaration.replace(/;$/, ''));
  }

  return {
    classes: [...new Set(classes)].join(' '),
    unknown,
  };
}
