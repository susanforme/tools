import { describe, expect, it } from 'vitest';
import { inspectGeoJson, GEO_SAMPLE } from './geojson-tool';
describe('GeoJSON inspection', () => {
  it('measures point, line and polygon while retaining properties', async () => {
    const result = await inspectGeoJson(GEO_SAMPLE);
    expect(result.collection.features).toHaveLength(3);
    expect(result.bounds).toEqual([121.46, 31.22, 121.5, 31.24]);
    expect(result.positions).toBe(9);
    expect(result.area).toBeGreaterThan(2000000);
    expect(result.length).toBeGreaterThan(5);
  });
  it('rejects invalid positions and rings instead of drawing misleading shapes', async () => {
    await expect(
      inspectGeoJson('{"type":"Point","coordinates":[181,30]}'),
    ).rejects.toThrow('COORDINATE');
    await expect(
      inspectGeoJson(
        '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1]]]}',
      ),
    ).rejects.toThrow('RING');
    await expect(
      inspectGeoJson('{"type":"LineString","coordinates":[[179,0],[-179,0]]}'),
    ).rejects.toThrow('DATELINE');
  });
  it('supports null geometry and collections, does not trust supplied bounding boxes', async () => {
    const result = await inspectGeoJson(
      JSON.stringify({
        type: 'FeatureCollection',
        bbox: [1, 2, 3, 4],
        features: [
          {
            type: 'Feature',
            properties: { name: '<img src=x>' },
            geometry: null,
          },
          {
            type: 'Feature',
            properties: null,
            geometry: {
              type: 'GeometryCollection',
              geometries: [{ type: 'Point', coordinates: [0, 0] }],
            },
          },
        ],
      }),
    );
    expect(result.bounds).toEqual([0, 0, 0, 0]);
    expect(result.collection.features[0].properties?.name).toBe('<img src=x>');
  });
});
