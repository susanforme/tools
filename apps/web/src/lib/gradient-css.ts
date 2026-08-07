export type GradientType = 'linear' | 'radial' | 'conic' | 'mesh';
export type PatternStyle =
  | 'dots'
  | 'grid'
  | 'lines'
  | 'diagonal'
  | 'checker'
  | 'crosses';
export type AnimationDirection = 'normal' | 'reverse' | 'alternate';

export type ColorStop = { id: string; color: string; position: number };
export type MeshPoint = {
  id: string;
  color: string;
  x: number;
  y: number;
};

export type GradientComposition = {
  base: { enabled: boolean; color: string };
  gradient: {
    enabled: boolean;
    type: GradientType;
    angle: number;
    stops: ColorStop[];
    meshPoints: MeshPoint[];
  };
  pattern: {
    enabled: boolean;
    style: PatternStyle;
    size: number;
    color: string;
    opacity: number;
  };
  noise: { enabled: boolean; intensity: number; opacity: number };
  animation: {
    enabled: boolean;
    speed: number;
    direction: AnimationDirection;
  };
};

export const DEFAULT_GRADIENT_COMPOSITION: GradientComposition = {
  base: { enabled: true, color: '#0a0a0a' },
  gradient: {
    enabled: true,
    type: 'linear',
    angle: 135,
    stops: [
      { id: 'stop-1', color: '#667eea', position: 0 },
      { id: 'stop-2', color: '#764ba2', position: 100 },
    ],
    meshPoints: [
      { id: 'mesh-1', color: '#667eea', x: 20, y: 25 },
      { id: 'mesh-2', color: '#764ba2', x: 80, y: 20 },
      { id: 'mesh-3', color: '#f093fb', x: 25, y: 80 },
      { id: 'mesh-4', color: '#4facfe', x: 80, y: 75 },
    ],
  },
  pattern: {
    enabled: false,
    style: 'dots',
    size: 20,
    color: '#ffffff',
    opacity: 0.1,
  },
  noise: { enabled: false, intensity: 0.65, opacity: 0.16 },
  animation: { enabled: false, speed: 1, direction: 'normal' },
};

export const GRADIENT_PRESETS = [
  { name: 'Aurora', colors: ['#667eea', '#764ba2', '#f093fb'] },
  { name: 'Cosmic', colors: ['#0f0c29', '#302b63', '#24243e'] },
  { name: 'Sunset', colors: ['#ff512f', '#f09819', '#ffcc70'] },
  { name: 'Ocean', colors: ['#00c6ff', '#0072ff', '#001f54'] },
  { name: 'Forest', colors: ['#134e5e', '#71b280', '#b6f492'] },
  { name: 'Candy', colors: ['#ff9a9e', '#fad0c4', '#fbc2eb'] },
] as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const color = (value: string) =>
  /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
const record = (value: unknown) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const number = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;
const boolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;
const string = (value: unknown, fallback: string) =>
  typeof value === 'string' ? value : fallback;

export function parseGradientComposition(value: string | null | undefined) {
  if (!value) return DEFAULT_GRADIENT_COMPOSITION;
  try {
    const parsed: unknown = JSON.parse(value);
    const compact = Array.isArray(parsed) ? parsed : null;
    const source = record(
      compact
        ? {
            base: { enabled: compact[0] === 1, color: compact[1] },
            gradient: {
              enabled: compact[2] === 1,
              type: compact[3],
              angle: compact[4],
              stops: Array.isArray(compact[5])
                ? compact[5].map((stop, index) => {
                    const values = Array.isArray(stop) ? stop : [];
                    return {
                      id: `stop-${index}`,
                      color: values[0],
                      position: values[1],
                    };
                  })
                : [],
              meshPoints: Array.isArray(compact[6])
                ? compact[6].map((point, index) => {
                    const values = Array.isArray(point) ? point : [];
                    return {
                      id: `mesh-${index}`,
                      color: values[0],
                      x: values[1],
                      y: values[2],
                    };
                  })
                : [],
            },
            pattern: {
              enabled: compact[7] === 1,
              style: compact[8],
              size: compact[9],
              color: compact[10],
              opacity: compact[11],
            },
            noise: {
              enabled: compact[12] === 1,
              intensity: compact[13],
              opacity: compact[14],
            },
            animation: {
              enabled: compact[15] === 1,
              speed: compact[16],
              direction: compact[17],
            },
          }
        : parsed,
    );
    const base = record(source.base);
    const gradient = record(source.gradient);
    const pattern = record(source.pattern);
    const noise = record(source.noise);
    const animation = record(source.animation);
    const types: GradientType[] = ['linear', 'radial', 'conic', 'mesh'];
    const patterns: PatternStyle[] = [
      'dots',
      'grid',
      'lines',
      'diagonal',
      'checker',
      'crosses',
    ];
    const directions: AnimationDirection[] = ['normal', 'reverse', 'alternate'];
    const rawStops =
      Array.isArray(gradient.stops) && gradient.stops.length >= 2
        ? gradient.stops
        : DEFAULT_GRADIENT_COMPOSITION.gradient.stops;
    const rawPoints =
      Array.isArray(gradient.meshPoints) && gradient.meshPoints.length >= 2
        ? gradient.meshPoints
        : DEFAULT_GRADIENT_COMPOSITION.gradient.meshPoints;
    return {
      base: {
        enabled: boolean(base.enabled, true),
        color: color(string(base.color, '#0a0a0a')),
      },
      gradient: {
        enabled: boolean(gradient.enabled, true),
        type: types.includes(gradient.type as GradientType)
          ? (gradient.type as GradientType)
          : 'linear',
        angle: number(gradient.angle, 135, 0, 360),
        stops: rawStops.slice(0, 8).map((item, index) => {
          const stop = record(item);
          return {
            id: string(stop.id, `stop-${index}`),
            color: color(string(stop.color, '#000000')),
            position: number(stop.position, index * 100, 0, 100),
          };
        }),
        meshPoints: rawPoints.slice(0, 8).map((item, index) => {
          const point = record(item);
          return {
            id: string(point.id, `mesh-${index}`),
            color: color(string(point.color, '#000000')),
            x: number(point.x, 50, 0, 100),
            y: number(point.y, 50, 0, 100),
          };
        }),
      },
      pattern: {
        enabled: boolean(pattern.enabled, false),
        style: patterns.includes(pattern.style as PatternStyle)
          ? (pattern.style as PatternStyle)
          : 'dots',
        size: number(pattern.size, 20, 4, 80),
        color: color(string(pattern.color, '#ffffff')),
        opacity: number(pattern.opacity, 0.1, 0, 1),
      },
      noise: {
        enabled: boolean(noise.enabled, false),
        intensity: number(noise.intensity, 0.65, 0, 1),
        opacity: number(noise.opacity, 0.16, 0, 1),
      },
      animation: {
        enabled: boolean(animation.enabled, false),
        speed: number(animation.speed, 1, 0.25, 3),
        direction: directions.includes(
          animation.direction as AnimationDirection,
        )
          ? (animation.direction as AnimationDirection)
          : 'normal',
      },
    } satisfies GradientComposition;
  } catch {
    return DEFAULT_GRADIENT_COMPOSITION;
  }
}

export function serializeGradientComposition(composition: GradientComposition) {
  return JSON.stringify([
    composition.base.enabled ? 1 : 0,
    composition.base.color,
    composition.gradient.enabled ? 1 : 0,
    composition.gradient.type,
    composition.gradient.angle,
    composition.gradient.stops.map((stop) => [stop.color, stop.position]),
    composition.gradient.meshPoints.map((point) => [
      point.color,
      point.x,
      point.y,
    ]),
    composition.pattern.enabled ? 1 : 0,
    composition.pattern.style,
    composition.pattern.size,
    composition.pattern.color,
    composition.pattern.opacity,
    composition.noise.enabled ? 1 : 0,
    composition.noise.intensity,
    composition.noise.opacity,
    composition.animation.enabled ? 1 : 0,
    composition.animation.speed,
    composition.animation.direction,
  ]);
}

function gradientImages(composition: GradientComposition): string[] {
  if (!composition.gradient.enabled) return [];
  const { angle, meshPoints, stops, type } = composition.gradient;
  if (type === 'mesh') {
    return meshPoints.map(
      (point) =>
        `radial-gradient(circle at ${clamp(point.x, 0, 100)}% ${clamp(point.y, 0, 100)}%, ${color(point.color)} 0%, transparent 55%)`,
    );
  }
  const value = stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((stop) => `${color(stop.color)} ${clamp(stop.position, 0, 100)}%`)
    .join(', ');
  if (type === 'radial') return [`radial-gradient(circle, ${value})`];
  if (type === 'conic') return [`conic-gradient(from ${angle}deg, ${value})`];
  return [`linear-gradient(${angle}deg, ${value})`];
}

function patternImages(composition: GradientComposition): string[] {
  const { color: patternHex, opacity, size, style } = composition.pattern;
  if (!composition.pattern.enabled) return [];
  const shade = `color-mix(in srgb, ${color(patternHex)} ${Math.round(clamp(opacity, 0, 1) * 100)}%, transparent)`;
  if (style === 'dots')
    return [`radial-gradient(circle, ${shade} 1px, transparent 1px)`];
  if (style === 'grid' || style === 'crosses')
    return [
      `linear-gradient(${shade} 1px, transparent 1px)`,
      `linear-gradient(90deg, ${shade} 1px, transparent 1px)`,
    ];
  if (style === 'lines')
    return [
      `repeating-linear-gradient(0deg, ${shade} 0 1px, transparent 1px ${size}px)`,
    ];
  if (style === 'diagonal')
    return [
      `repeating-linear-gradient(45deg, ${shade} 0 1px, transparent 1px ${size}px)`,
    ];
  return [
    `linear-gradient(45deg, ${shade} 25%, transparent 25%, transparent 75%, ${shade} 75%)`,
    `linear-gradient(45deg, ${shade} 25%, transparent 25%, transparent 75%, ${shade} 75%)`,
  ];
}

function noiseImage(composition: GradientComposition): string | null {
  if (!composition.noise.enabled) return null;
  const frequency = (
    0.25 +
    clamp(composition.noise.intensity, 0, 1) * 0.75
  ).toFixed(2);
  const opacity = clamp(composition.noise.opacity, 0, 1).toFixed(2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity="${opacity}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function buildGradientStyle(composition: GradientComposition) {
  const pattern = patternImages(composition);
  const gradients = gradientImages(composition);
  const noise = noiseImage(composition);
  const images = [...(noise ? [noise] : []), ...pattern, ...gradients];
  const size = Math.max(4, composition.pattern.size);
  const patternSizes = pattern.map(() =>
    composition.pattern.style === 'checker'
      ? `${size * 2}px ${size * 2}px`
      : `${size}px ${size}px`,
  );
  const sizes = [
    ...(noise ? ['160px 160px'] : []),
    ...patternSizes,
    ...gradients.map(() =>
      composition.animation.enabled ? '200% 200%' : '100% 100%',
    ),
  ];
  const positions = [
    ...(noise ? ['0 0'] : []),
    ...pattern.map((_, index) =>
      composition.pattern.style === 'checker' && index === 1
        ? `${size}px ${size}px`
        : '0 0',
    ),
    ...gradients.map(() => '0% 50%'),
  ];
  return {
    backgroundColor: composition.base.enabled
      ? color(composition.base.color)
      : 'transparent',
    backgroundImage: images.length ? images.join(', ') : 'none',
    backgroundSize: sizes.length ? sizes.join(', ') : 'auto',
    backgroundPosition: positions.length ? positions.join(', ') : '0 0',
    duration: `${Math.max(2, 12 / clamp(composition.animation.speed, 0.25, 3)).toFixed(1)}s`,
  };
}

export function generateGradientCss(composition: GradientComposition) {
  const style = buildGradientStyle(composition);
  const animation = composition.animation.enabled
    ? `\n  animation: gradient-shift ${style.duration} ease infinite ${composition.animation.direction};`
    : '';
  const keyframes = composition.animation.enabled
    ? `\n\n@keyframes gradient-shift {\n  0%, 100% { background-position: 0% 50%; }\n  50% { background-position: 100% 50%; }\n}`
    : '';
  return `.gradient {\n  background-color: ${style.backgroundColor};\n  background-image: ${style.backgroundImage};\n  background-size: ${style.backgroundSize};\n  background-position: ${style.backgroundPosition};${animation}\n}${keyframes}`;
}
