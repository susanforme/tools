import { describe, expect, it } from 'vitest';
import { utmToWgs84, wgs84ToUtm } from './utm-coordinates';

describe('WGS84 UTM conversion', () => {
  it('round trips points in both hemispheres and special zones', () => {
    for (const [lon, lat] of [
      [121.4737, 31.2304],
      [-73.9857, 40.7484],
      [151.2093, -33.8688],
      [6, 60],
      [20, 78],
    ]) {
      const point = wgs84ToUtm(lon, lat);
      const restored = utmToWgs84(point);
      expect(restored.lon).toBeCloseTo(lon, 5);
      expect(restored.lat).toBeCloseTo(lat, 5);
    }
  });
  it('rejects out-of-range coordinates', () => {
    expect(() => wgs84ToUtm(0, 90)).toThrow();
    expect(() =>
      utmToWgs84({ zone: 0, hemisphere: 'N', easting: 500000, northing: 0 }),
    ).toThrow();
  });
});
