import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GRADIENT_COMPOSITION,
  buildGradientStyle,
  generateGradientCss,
  parseGradientComposition,
  serializeGradientComposition,
} from './gradient-css';

describe('gradient css', () => {
  it('composes enabled layers and animation', () => {
    const css = generateGradientCss({
      ...DEFAULT_GRADIENT_COMPOSITION,
      pattern: {
        ...DEFAULT_GRADIENT_COMPOSITION.pattern,
        enabled: true,
      },
      animation: {
        ...DEFAULT_GRADIENT_COMPOSITION.animation,
        enabled: true,
      },
    });
    expect(css).toContain('linear-gradient(135deg');
    expect(css).toContain('radial-gradient(circle');
    expect(css).toContain('@keyframes gradient-shift');
    expect(
      parseGradientComposition(
        serializeGradientComposition({
          ...DEFAULT_GRADIENT_COMPOSITION,
          pattern: {
            ...DEFAULT_GRADIENT_COMPOSITION.pattern,
            enabled: true,
          },
        }),
      ).pattern.enabled,
    ).toBe(true);
    const mesh = buildGradientStyle({
      ...DEFAULT_GRADIENT_COMPOSITION,
      gradient: {
        ...DEFAULT_GRADIENT_COMPOSITION.gradient,
        type: 'mesh',
      },
    });
    expect(mesh.backgroundImage.match(/radial-gradient/g)).toHaveLength(4);
    expect(mesh.backgroundSize.split(', ')).toHaveLength(4);
  });
});
