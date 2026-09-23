import type { FeatureCollection, LineString } from 'geojson';
import { inspectGeoJson, GEO_MAX_BYTES } from './geojson-tool';
export type TrackPoint = [number, number, number?];
export type Track = { name: string; points: TrackPoint[] };
export function validateTrack(track: Track): Track {
  if (
    track.points.length < 2 ||
    track.points.length > 50000 ||
    track.points.some(
      (p) =>
        p.length < 2 ||
        p.length > 3 ||
        !p.every(Number.isFinite) ||
        Math.abs(p[0]) > 180 ||
        Math.abs(p[1]) > 90,
    )
  )
    throw new Error('invalid');
  return track;
}
export async function readTracks(text: string, name: string): Promise<Track[]> {
  if (new TextEncoder().encode(text).length > GEO_MAX_BYTES)
    throw new Error('limit');
  const tracks: Track[] = [];
  if (text.trim().startsWith('<')) {
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('invalid');
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('invalid');
    const nodes = (root: Document | Element, tag: string) =>
      Array.from(root.getElementsByTagNameNS('*', tag));
    if (doc.documentElement.localName === 'gpx') {
      for (const segment of [...nodes(doc, 'trkseg'), ...nodes(doc, 'rte')]) {
        const points = [
          ...nodes(segment, 'trkpt'),
          ...nodes(segment, 'rtept'),
        ].map((p) => {
          if (!p.hasAttribute('lon') || !p.hasAttribute('lat'))
            throw new Error('invalid');
          const point: TrackPoint = [
            Number(p.getAttribute('lon')),
            Number(p.getAttribute('lat')),
          ];
          const elevation = nodes(p, 'ele')[0]?.textContent;
          if (elevation?.trim()) point.push(Number(elevation));
          return point;
        });
        tracks.push(
          validateTrack({
            name:
              nodes(segment.parentElement ?? segment, 'name')[0]?.textContent ||
              name,
            points,
          }),
        );
      }
    } else if (doc.documentElement.localName === 'kml') {
      for (const line of nodes(doc, 'LineString')) {
        const points = (nodes(line, 'coordinates')[0]?.textContent ?? '')
          .trim()
          .split(/\s+/)
          .map((p) => p.split(',').map(Number) as TrackPoint);
        tracks.push(
          validateTrack({
            name:
              nodes(line.parentElement ?? line, 'name')[0]?.textContent || name,
            points,
          }),
        );
      }
    } else throw new Error('invalid');
  } else {
    const result = await inspectGeoJson(text);
    for (const f of result.collection.features) {
      const lines =
        f.geometry?.type === 'LineString'
          ? [f.geometry.coordinates]
          : f.geometry?.type === 'MultiLineString'
            ? f.geometry.coordinates
            : [];
      for (const points of lines)
        tracks.push(
          validateTrack({
            name: String(f.properties?.name ?? name),
            points: points as TrackPoint[],
          }),
        );
    }
  }
  if (!tracks.length || tracks.reduce((n, t) => n + t.points.length, 0) > 50000)
    throw new Error('limit');
  return tracks;
}
export function trackCollection(
  tracks: Track[],
): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: tracks.map((track) => ({
      type: 'Feature',
      properties: { name: track.name },
      geometry: {
        type: 'LineString',
        coordinates: track.points.map((p) => [...p] as number[]),
      },
    })),
  };
}
export function trackDistances(points: TrackPoint[]): number[] {
  const distances = [0];
  const radians = (n: number) => (n * Math.PI) / 180;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const h =
      Math.sin(radians(b[1] - a[1]) / 2) ** 2 +
      Math.cos(radians(a[1])) *
        Math.cos(radians(b[1])) *
        Math.sin(radians(b[0] - a[0]) / 2) ** 2;
    distances.push(
      distances[i - 1] + 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, h))),
    );
  }
  return distances;
}
const escapeXml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  );
export function exportTracks(tracks: Track[], format: string): string {
  tracks.forEach(validateTrack);
  if (format === 'geojson')
    return JSON.stringify(trackCollection(tracks), null, 2);
  if (format === 'gpx')
    return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Dev Tools" xmlns="http://www.topografix.com/GPX/1/1">${tracks.map((t) => `<trk><name>${escapeXml(t.name)}</name><trkseg>${t.points.map((p) => `<trkpt lat="${p[1]}" lon="${p[0]}">${p[2] !== undefined ? `<ele>${p[2]}</ele>` : ''}</trkpt>`).join('')}</trkseg></trk>`).join('')}</gpx>`;
  if (format === 'kml')
    return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${tracks.map((t) => `<Placemark><name>${escapeXml(t.name)}</name><LineString><coordinates>${t.points.map((p) => p.join(',')).join(' ')}</coordinates></LineString></Placemark>`).join('')}</Document></kml>`;
  throw new Error('invalid');
}
