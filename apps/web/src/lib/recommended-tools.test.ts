import { describe, expect, it } from 'vitest';
import {
  generateLorem,
  inspectPdfSignatures,
  unwrapRedirectUrl,
  validateCardNumber,
  validateIban,
} from './recommended-tools';

describe('recommended tool helpers', () => {
  it('validates and unwraps representative inputs', () => {
    expect(validateIban('GB82 WEST 1234 5698 7654 32').valid).toBe(true);
    expect(validateCardNumber('4111 1111 1111 1111')).toMatchObject({
      brand: 'Visa',
      valid: true,
    });
    expect(
      unwrapRedirectUrl(
        'https://example.com/?url=https%3A%2F%2Fopenai.com%2F',
      ).at(-1)?.url,
    ).toBe('https://openai.com/');
    const pdf = new TextEncoder().encode(
      '/Name (Tester) /Reason (Approved) /SubFilter /adbe.pkcs7.detached /ByteRange [0 10 20 5]',
    );
    expect(inspectPdfSignatures(pdf)[0]?.name).toBe('Tester');
    expect(generateLorem(2, 2).split('\n\n')).toHaveLength(2);
  });
});
