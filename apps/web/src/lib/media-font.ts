export type FontAxis = {
  tag: string;
  name: string;
  min: number;
  max: number;
  default: number;
};
export type LayoutFont = { name: string; data: string; axes: FontAxis[] };
export type LayoutOptions = {
  heading: string;
  body: string;
  minimum: number;
  maximum: number;
  spacing: number;
  leading: number;
  axes: Record<string, number>;
};
export function layoutCss(options: LayoutOptions, fonts: LayoutFont[]): string {
  const { heading, body, minimum, maximum, spacing, leading, axes } = options;
  if (
    ![minimum, maximum, spacing, leading].every(Number.isFinite) ||
    minimum < 8 ||
    maximum > 120 ||
    maximum < minimum ||
    spacing < -5 ||
    spacing > 20 ||
    leading < 0.8 ||
    leading > 3 ||
    ![heading, body].every((v) =>
      [
        'serif',
        'sans-serif',
        'monospace',
        ...fonts.map((_, i) => `Uploaded${i}`),
      ].includes(v),
    )
  )
    throw new Error('invalid');
  const rules = fonts.map(
    (font, i) =>
      `@font-face { font-family: Uploaded${i}; src: url(${JSON.stringify(font.data)}); }`,
  );
  const variations = (family: string) => {
    const index = Number(family.replace('Uploaded', ''));
    const font = fonts[index];
    return (
      font?.axes
        .map((axis) => {
          const value = axes[`${index}-${axis.tag}`] ?? axis.default;
          if (!Number.isFinite(value) || value < axis.min || value > axis.max)
            throw new Error('invalid');
          return `'${axis.tag}' ${value}`;
        })
        .join(', ') || 'normal'
    );
  };
  rules.push(
    `.body { font-family: ${body}; font-size: clamp(${minimum}px, calc(${minimum}px + (${maximum} - ${minimum}) * (100vw - 320px) / 960), ${maximum}px); line-height: ${leading}; letter-spacing: ${spacing}px; font-variation-settings: ${variations(body)}; }`,
  );
  rules.push(
    `.heading { font-family: ${heading}; font-size: clamp(${minimum * 1.8}px, calc(${minimum * 1.8}px + (${maximum * 1.8} - ${minimum * 1.8}) * (100vw - 320px) / 960), ${maximum * 1.8}px); line-height: 1.2; font-variation-settings: ${variations(heading)}; }`,
  );
  return rules.join('\n');
}
export function escapeHtml(value: string) {
  return value.replace(
    /[<>&"']/g,
    (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}
