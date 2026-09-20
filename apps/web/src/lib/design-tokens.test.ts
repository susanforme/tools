import { describe, expect, it } from 'vitest';
import { analyzeDesignTokens } from './design-tokens';
const analyze = (value: unknown) => analyzeDesignTokens(JSON.stringify(value));
const color = { colorSpace: 'srgb', components: [0.1, 0.2, 0.3] };
const dimension = { value: 1, unit: 'rem' };
const token = ($type: string, $value: unknown) => ({ $type, $value });

describe('DTCG design tokens', () => {
  it('inherits types, resolves aliases and root tokens, and safely ignores extension data', async () => {
    const result = await analyze({
      base: {
        $type: 'color',
        $root: { $value: color },
        primary: { $value: '{base.$root}' },
        $extensions: { arbitrary: { $ref: 'https://example.test/no-network' } },
      },
      alias: { $value: '{base.primary}' },
    });
    expect(result.issues).toEqual([]);
    expect(result.tokens).toHaveLength(3);
    expect(result.css).toContain('--token-alias: color(srgb 0.1 0.2 0.3 / 1)');
  });
  it('supports every standard type and composite exports without dropping typography fields', async () => {
    const result = await analyze({
      color: token('color', color),
      size: token('dimension', dimension),
      number: token('number', -2),
      family: token('fontFamily', ['Inter', 'Arial']),
      weight: token('fontWeight', 'semi-bold'),
      time: token('duration', { value: 200, unit: 'ms' }),
      curve: token('cubicBezier', [0.1, -3, 0.9, 4]),
      stroke: token('strokeStyle', 'solid'),
      border: token('border', {
        width: '{size}',
        color: '{color}',
        style: '{stroke}',
      }),
      transition: token('transition', {
        duration: '{time}',
        delay: { value: 0, unit: 's' },
        timingFunction: '{curve}',
      }),
      shadow: token('shadow', [
        {
          color: '{color}',
          offsetX: dimension,
          offsetY: dimension,
          blur: dimension,
          spread: dimension,
          inset: true,
        },
      ]),
      gradient: token('gradient', [
        { color: '{color}', position: -1 },
        { color: '{color}', position: 2 },
      ]),
      typography: token('typography', {
        fontFamily: '{family}',
        fontSize: '{size}',
        fontWeight: '{weight}',
        letterSpacing: dimension,
        lineHeight: 1.5,
      }),
    });
    expect(result.issues).toEqual([]);
    expect(result.tokens).toHaveLength(13);
    expect(result.css).toContain('--token-typography-letter-spacing: 1rem;');
    expect(result.css).toContain('--token-typography-font-weight: 600;');
    expect(result.css).toContain('/ 1) 0%, color(srgb 0.1 0.2 0.3 / 1) 100%)');
  });
  it('resolves escaped local JSON pointers including subvalues', async () => {
    const result = await analyze({
      'a/b~c': token('dimension', dimension),
      value: token('number', { $ref: '#/a~1b~0c/$value/value' }),
      same: token('dimension', { $ref: '#/a~1b~0c/$value' }),
      inferred: { $value: { $ref: '#/a~1b~0c/$value' } },
      inherited: { $type: 'number', alias: { $value: '{a/b~c}' } },
    });
    expect(result.issues).toEqual([]);
    expect(result.css).toContain('--token-value: 1;');
    expect(result.tokens.find((item) => item.path === 'inferred')?.type).toBe(
      'dimension',
    );
    expect(
      result.tokens.find((item) => item.path === 'inherited.alias')?.type,
    ).toBe('dimension');
  });
  it('reports missing targets, cyclic references, explicit type mismatches and pointer cycles', async () => {
    const result = await analyze({
      a: token('number', '{b}'),
      b: token('number', '{a}'),
      missing: token('number', '{nothing}'),
      wrong: token('fontWeight', '{n}'),
      n: token('number', 500),
      pointer: token('number', { $ref: '#/pointer/$value' }),
    });
    expect(result.css).toBe('');
    expect(result.issues.map((x) => x.code)).toEqual(
      expect.arrayContaining(['CYCLE', 'MISSING', 'TYPE']),
    );
    expect(result.issues).toHaveLength(5);
  });
  it('rejects unknown reserved fields, unsupported extensions, invalid values and group aliases', async () => {
    const result = await analyze({
      extended: { $extends: '{base}', x: token('number', 1) },
      base: { x: token('number', 1) },
      groupAlias: token('number', '{base}'),
      stroke: token('strokeStyle', {
        dashArray: [dimension],
        lineCap: 'round',
      }),
      invalid: token('color', { ...color, components: [2, 0, 0] }),
      unknown: { ...token('number', 1), $mystery: true },
      child: { ...token('number', 1), nested: {} },
      duration: token('duration', { value: 1, unit: 'min' }),
    });
    expect(result.css).toBe('');
    expect(result.issues.map((x) => x.code)).toEqual(
      expect.arrayContaining(['UNSUPPORTED', 'MISSING', 'VALUE', 'STRUCTURE']),
    );
  });
  it('detects CSS collisions and duplicate JSON keys, and escapes font names against CSS injection', async () => {
    const collision = await analyze({
      a: { b: token('number', 1) },
      'a-b': token('number', 2),
    });
    expect(collision.issues[0]?.code).toBe('COLLISION');
    expect(collision.css).toBe('');
    const duplicate = await analyzeDesignTokens(
      '{"x":{"$type":"number","$value":1},"x":{"$type":"number","$value":2}}',
    );
    expect(duplicate.issues[0]?.code).toBe('DUPLICATE');
    const safe = await analyze({
      font: token(
        'fontFamily',
        '</style><script>alert(1)</script>"; color:red;\n',
      ),
    });
    expect(safe.issues).toEqual([]);
    expect(safe.css).not.toContain('<');
    expect(safe.css).toContain('\\22 ');
    await expect(analyzeDesignTokens('{}', 'x;}body{')).rejects.toThrow(
      'PREFIX',
    );
  });
  it('validates ranges, forbids array alias flattening, and bounds resource usage', async () => {
    const result = await analyze({
      curve: token('cubicBezier', [2, 0, 1, 1]),
      weight: token('fontWeight', 1001),
      extra: token('dimension', { ...dimension, unknown: 1 }),
      array: token('fontFamily', ['A']),
      nested: token('fontFamily', ['{array}']),
      empty: token('shadow', []),
      pointer: token('number', { $ref: 'https://example.test/data' }),
    });
    expect(result.css).toBe('');
    expect(result.issues).toHaveLength(6);
    await expect(
      analyzeDesignTokens(' '.repeat(2 * 1024 * 1024 + 1)),
    ).rejects.toThrow('LIMIT');
    await expect(
      analyzeDesignTokens('['.repeat(110) + '0' + ']'.repeat(110)),
    ).rejects.toThrow('LIMIT');
    expect((await analyzeDesignTokens('{')).issues[0]?.code).toBe('JSON');
  });
});
