import { describe, expect, it } from 'vitest';
import { detectImageFormat, readWebpLoopCount } from './webp-gif';

describe('WebP / GIF conversion helpers', () => {
  it('detects file signatures and reads animation loop count', async () => {
    const gifHeader = new Blob([new TextEncoder().encode('GIF89a')]);
    const webpBytes = new Uint8Array(26);
    webpBytes.set(new TextEncoder().encode('RIFF'), 0);
    webpBytes.set(new TextEncoder().encode('WEBP'), 8);
    webpBytes.set(new TextEncoder().encode('ANIM'), 12);
    webpBytes[16] = 6;
    webpBytes[24] = 3;
    const webpHeader = new Blob([webpBytes]);

    expect(await detectImageFormat(gifHeader)).toBe('gif');
    expect(await detectImageFormat(webpHeader)).toBe('webp');
    expect(readWebpLoopCount(webpBytes)).toBe(3);
  });
});
