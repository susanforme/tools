import { describe, expect, it } from 'vitest';
import { decryptTotpSecret, encryptTotpSecret } from './totp-share';

describe('TOTP 分享秘钥', () => {
  it('加密后可还原，且相同秘钥每次生成不同密文', async () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const first = await encryptTotpSecret(secret);
    const second = await encryptTotpSecret(secret);

    expect(first).not.toContain(secret);
    expect(first).not.toBe(second);
    expect(await decryptTotpSecret(first)).toBe(secret);
  });
});
