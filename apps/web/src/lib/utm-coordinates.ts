const A = 6378137;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);

export type UtmPoint = {
  zone: number;
  hemisphere: 'N' | 'S';
  easting: number;
  northing: number;
};

function meridian(phi: number): number {
  return (
    A *
    ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * phi -
      ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) *
        Math.sin(2 * phi) +
      ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * phi))
  );
}

export function wgs84ToUtm(lon: number, lat: number): UtmPoint {
  if (
    !Number.isFinite(lon) ||
    !Number.isFinite(lat) ||
    lon < -180 ||
    lon > 180 ||
    lat < -80 ||
    lat > 84
  )
    throw new Error('WGS84 coordinate outside UTM coverage');
  let zone = Math.min(60, Math.floor((lon + 180) / 6) + 1);
  if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) zone = 32;
  if (lat >= 72 && lat < 84) {
    if (lon >= 0 && lon < 9) zone = 31;
    else if (lon >= 9 && lon < 21) zone = 33;
    else if (lon >= 21 && lon < 33) zone = 35;
    else if (lon >= 33 && lon < 42) zone = 37;
  }
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180;
  const central = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180;
  const sin = Math.sin(phi),
    cos = Math.cos(phi),
    tan = Math.tan(phi);
  const n = A / Math.sqrt(1 - E2 * sin ** 2);
  const t = tan ** 2,
    c = EP2 * cos ** 2,
    x = cos * (lambda - central);
  const easting =
    500000 +
    K0 *
      n *
      (x +
        ((1 - t + c) * x ** 3) / 6 +
        ((5 - 18 * t + t ** 2 + 72 * c - 58 * EP2) * x ** 5) / 120);
  const northing =
    K0 *
      (meridian(phi) +
        n *
          tan *
          (x ** 2 / 2 +
            ((5 - t + 9 * c + 4 * c ** 2) * x ** 4) / 24 +
            ((61 - 58 * t + t ** 2 + 600 * c - 330 * EP2) * x ** 6) / 720)) +
    (lat < 0 ? 10000000 : 0);
  return { zone, hemisphere: lat < 0 ? 'S' : 'N', easting, northing };
}

export function utmToWgs84(point: UtmPoint): { lon: number; lat: number } {
  const { zone, hemisphere, easting } = point;
  if (
    !Number.isInteger(zone) ||
    zone < 1 ||
    zone > 60 ||
    !['N', 'S'].includes(hemisphere) ||
    !Number.isFinite(easting) ||
    easting < 100000 ||
    easting > 900000 ||
    !Number.isFinite(point.northing) ||
    point.northing < 0 ||
    point.northing > 10000000
  )
    throw new Error('Invalid UTM coordinate');
  const y = (point.northing - (hemisphere === 'S' ? 10000000 : 0)) / K0;
  const mu = y / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const phi =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sin = Math.sin(phi),
    cos = Math.cos(phi),
    tan = Math.tan(phi);
  const n = A / Math.sqrt(1 - E2 * sin ** 2);
  const r = (A * (1 - E2)) / (1 - E2 * sin ** 2) ** 1.5;
  const t = tan ** 2,
    c = EP2 * cos ** 2,
    d = (easting - 500000) / (n * K0);
  const lat =
    phi -
    ((n * tan) / r) *
      (d ** 2 / 2 -
        ((5 + 3 * t + 10 * c - 4 * c ** 2 - 9 * EP2) * d ** 4) / 24 +
        ((61 + 90 * t + 298 * c + 45 * t ** 2 - 252 * EP2 - 3 * c ** 2) *
          d ** 6) /
          720);
  const lon =
    (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180 +
    (d -
      ((1 + 2 * t + c) * d ** 3) / 6 +
      ((5 - 2 * c + 28 * t - 3 * c ** 2 + 8 * EP2 + 24 * t ** 2) * d ** 5) /
        120) /
      cos;
  return { lon: (lon * 180) / Math.PI, lat: (lat * 180) / Math.PI };
}
