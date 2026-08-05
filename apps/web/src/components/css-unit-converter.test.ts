import { describe, expect, test } from 'vitest';
import { buildConvertValues } from './css-unit-converter';

describe('CSS unit conversion', () => {
  test('converts through px using the configured viewport and root size', () => {
    expect(buildConvertValues('px', '16', 375, 16).values).toEqual({
      px: '16',
      rem: '1',
      vw: '4.266667',
    });
    expect(buildConvertValues('rem', '1', 375, 16).values.px).toBe('16');
    expect(buildConvertValues('vw', '4', 400, 16).values.px).toBe('16');
  });
});
