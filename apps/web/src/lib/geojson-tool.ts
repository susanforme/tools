import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

export type GeoProperties = Record<string, unknown> | null;
export type GeoFeature = Feature<Geometry | null, GeoProperties>;
export type GeoResult = {
  collection: FeatureCollection<Geometry | null, GeoProperties>;
  bounds: [number, number, number, number] | null;
  positions: number;
  area: number;
  length: number;
};
export const GEO_MAX_BYTES = 5 * 1024 * 1024;

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export async function inspectGeoJson(input: string): Promise<GeoResult> {
  if (new TextEncoder().encode(input).length > GEO_MAX_BYTES)
    throw new Error('SIZE');
  const raw: unknown = JSON.parse(input);
  let positions = 0;
  let bounds: GeoResult['bounds'] = null;
  const position = (value: unknown): Position => {
    if (
      !Array.isArray(value) ||
      value.length < 2 ||
      value.length > 3 ||
      !value.every(
        (n: unknown) => typeof n === 'number' && Number.isFinite(n),
      ) ||
      Math.abs(value[0] as number) > 180 ||
      Math.abs(value[1] as number) > 90
    )
      throw new Error('COORDINATE');
    if (++positions > 50000) throw new Error('LIMIT');
    const [x, y] = value as number[];
    bounds = bounds
      ? [
          Math.min(bounds[0], x),
          Math.min(bounds[1], y),
          Math.max(bounds[2], x),
          Math.max(bounds[3], y),
        ]
      : [x, y, x, y];
    return value as Position;
  };
  const list = <T>(
    value: unknown,
    read: (item: unknown) => T,
    min = 1,
  ): T[] => {
    if (!Array.isArray(value) || value.length < min || value.length > 50000)
      throw new Error('GEOMETRY');
    return value.map(read);
  };
  const line = (value: unknown): Position[] => {
    const points = list(value, position, 2);
    if (points.some((p, i) => i > 0 && Math.abs(p[0] - points[i - 1][0]) > 180))
      throw new Error('DATELINE');
    return points;
  };
  const ring = (value: unknown): Position[] => {
    const points = line(value);
    if (
      points.length < 4 ||
      points[0].length !== points.at(-1)!.length ||
      points[0].some((n, i) => n !== points.at(-1)![i])
    )
      throw new Error('RING');
    return points;
  };
  const polygon = (value: unknown): Position[][] => list(value, ring);
  const geometry = (value: unknown, depth = 0): Geometry => {
    if (!object(value) || depth > 16) throw new Error('GEOMETRY');
    if ('crs' in value) throw new Error('CRS');
    switch (value.type) {
      case 'Point':
        return { type: 'Point', coordinates: position(value.coordinates) };
      case 'MultiPoint':
        return {
          type: 'MultiPoint',
          coordinates: list(value.coordinates, position),
        };
      case 'LineString':
        return { type: 'LineString', coordinates: line(value.coordinates) };
      case 'MultiLineString':
        return {
          type: 'MultiLineString',
          coordinates: list(value.coordinates, line),
        };
      case 'Polygon':
        return { type: 'Polygon', coordinates: polygon(value.coordinates) };
      case 'MultiPolygon':
        return {
          type: 'MultiPolygon',
          coordinates: list(value.coordinates, polygon),
        };
      case 'GeometryCollection':
        return {
          type: 'GeometryCollection',
          geometries: list(
            value.geometries,
            (item) => geometry(item, depth + 1),
            0,
          ),
        };
      default:
        throw new Error('GEOMETRY');
    }
  };
  const feature = (value: unknown): GeoFeature => {
    if (
      !object(value) ||
      value.type !== 'Feature' ||
      !('geometry' in value) ||
      !('properties' in value) ||
      (value.properties !== null && !object(value.properties))
    )
      throw new Error('FEATURE');
    if ('crs' in value) throw new Error('CRS');
    if (
      value.id !== undefined &&
      typeof value.id !== 'string' &&
      typeof value.id !== 'number'
    )
      throw new Error('FEATURE');
    return {
      ...value,
      type: 'Feature',
      properties: value.properties as GeoProperties,
      geometry: value.geometry === null ? null : geometry(value.geometry),
    } as GeoFeature;
  };
  if (!object(raw)) throw new Error('GEOMETRY');
  if ('crs' in raw) throw new Error('CRS');
  let features: GeoFeature[];
  if (raw.type === 'FeatureCollection') {
    if (!Array.isArray(raw.features) || raw.features.length > 2000)
      throw new Error('LIMIT');
    features = raw.features.map(feature);
  } else if (raw.type === 'Feature') features = [feature(raw)];
  else
    features = [{ type: 'Feature', properties: {}, geometry: geometry(raw) }];
  const collection: GeoResult['collection'] = {
    type: 'FeatureCollection',
    features,
  };
  const [{ area }, { length }] = await Promise.all([
    import('@turf/area'),
    import('@turf/length'),
  ]);
  const measurable = {
    ...collection,
    features: features.filter((item) => item.geometry !== null),
  };
  return {
    collection,
    bounds,
    positions,
    area: area(measurable),
    length: length(measurable),
  };
}

export const GEO_SAMPLE = JSON.stringify(
  {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: '起点' },
        geometry: { type: 'Point', coordinates: [121.47, 31.23] },
      },
      {
        type: 'Feature',
        properties: { name: '路线' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [121.47, 31.23],
            [121.48, 31.24],
            [121.5, 31.235],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { name: '区域' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [121.46, 31.22],
              [121.48, 31.22],
              [121.48, 31.23],
              [121.46, 31.23],
              [121.46, 31.22],
            ],
          ],
        },
      },
    ],
  },
  null,
  2,
);
