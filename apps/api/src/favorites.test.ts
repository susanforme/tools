import { describe, expect, test } from 'bun:test';
import { isToolPath } from './index';

describe('favorite tool path validation', () => {
  test('accepts tool routes and rejects unsafe paths', () => {
    expect(isToolPath('/json')).toBe(true);
    expect(isToolPath('/url-encode')).toBe(true);
    expect(isToolPath('//example.com')).toBe(false);
    expect(isToolPath('/api/auth/me')).toBe(false);
  });
});
