import { describe, expect, test } from 'vitest';
import { normalizeSqlValue, quoteSqlIdentifier } from './sqlite-playground';

describe('SQLite playground helpers', () => {
  test('serializes values for result tables', () => {
    expect(normalizeSqlValue(9007199254740993n)).toBe('9007199254740993');
    expect(normalizeSqlValue(new Uint8Array([1, 2, 3]))).toBe('BLOB (3 bytes)');
  });

  test('quotes SQLite identifiers', () => {
    expect(quoteSqlIdentifier('order"items')).toBe('"order""items"');
  });
});
