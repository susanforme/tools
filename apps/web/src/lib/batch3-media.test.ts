// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { processAudio } from './media-audio';
import { exportTracks, readTracks, trackDistances } from './media-tracks';
import { measureTriangles } from './media-model';
import { layoutCss } from './media-font';
import {
  pixelFrame,
  pixelLine,
  validPixelProject,
  type PixelProject,
} from './media-pixels';

describe('media tools extensions', () => {
  it('round trips line coordinates, altitude and escaped names through GPX and KML', async () => {
    const tracks = [
      {
        name: 'A & <B>',
        points: [
          [120, 30, 100],
          [120.01, 30.01, 105],
        ] as [number, number, number][],
      },
    ];
    for (const format of ['gpx', 'kml', 'geojson'])
      expect(await readTracks(exportTracks(tracks, format), 'sample')).toEqual(
        tracks,
      );
    expect(
      trackDistances([
        [0, 0],
        [1, 0],
      ])[1],
    ).toBeCloseTo(111.195, 3);
    await expect(
      readTracks(
        '<!DOCTYPE gpx [<!ENTITY x SYSTEM "file:///etc/passwd">]><gpx/>',
        'bad',
      ),
    ).rejects.toThrow();
    await expect(
      readTracks(
        '<gpx><trk><trkseg><trkpt lat="0"/><trkpt lat="0" lon="0"/></trkseg></trk></gpx>',
        'bad',
      ),
    ).rejects.toThrow();
  });
  it('measures a closed tetrahedron and rejects open or inconsistent topology', () => {
    const vertices = [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      faces = [
        [0, 2, 1],
        [0, 1, 3],
        [0, 3, 2],
        [1, 2, 3],
      ];
    const triangles = faces.flatMap((face) => face.flatMap((i) => vertices[i]));
    const measurement = measureTriangles(triangles);
    expect(measurement.closed).toBe(true);
    expect(measurement.volume).toBeCloseTo(1 / 6);
    expect(measurement.area).toBeCloseTo(1.5 + Math.sqrt(3) / 2);
    expect(measurement.dimensions).toEqual([1, 1, 1]);
    expect(measureTriangles(triangles.slice(9)).volume).toBeNull();
    expect(measureTriangles(triangles.map((v) => v * 2)).volume).toBeCloseTo(
      8 / 6,
    );
  });
  it('normalizes stereo, encodes valid WAV channel metadata and locates silence', () => {
    const channel = Float32Array.from({ length: 8000 }, (_, i) =>
      i < 4000 ? 0 : 0.25,
    );
    const options = {
      normalize: true,
      peakDb: 0,
      fadeIn: 0,
      fadeOut: 0,
      speed: 2,
      channels: 'keep',
      silenceDb: -45,
      minSilence: 0.2,
    };
    const result = processAudio({
      channels: [channel, channel],
      sampleRate: 8000,
      options,
    });
    const view = new DataView(result.wav.buffer);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(40, true)).toBe(16000);
    expect(result.duration).toBe(0.5);
    expect(result.silence).toEqual([{ start: 0, end: 0.5 }]);
    expect(view.getInt16(44 + 3000 * 4, true)).toBe(32767);
    expect(() =>
      processAudio({
        channels: [channel],
        sampleRate: 8000,
        options: { ...options, speed: 0 },
      }),
    ).toThrow();
  });
  it('averages channels and fades without clipping', () => {
    const result = processAudio({
      channels: [
        new Float32Array(8000).fill(1),
        new Float32Array(8000).fill(-1),
      ],
      sampleRate: 8000,
      options: {
        normalize: false,
        peakDb: -1,
        fadeIn: 0.1,
        fadeOut: 0.1,
        speed: 1,
        channels: 'mono',
        silenceDb: -40,
        minSilence: 0.5,
      },
    });
    expect(new DataView(result.wav.buffer).getUint16(22, true)).toBe(1);
    expect(result.wav.slice(44).every((v) => v === 0)).toBe(true);
  });
  it('exports bounded responsive CSS and validates font variable axes', () => {
    const options = {
      heading: 'Uploaded0',
      body: 'serif',
      minimum: 16,
      maximum: 24,
      spacing: 0,
      leading: 1.6,
      axes: { '0-wght': 700 },
    };
    const fonts = [
      {
        name: 'Variable',
        data: 'data:font/woff2;base64,AA==',
        axes: [
          { tag: 'wght', name: 'Weight', min: 100, max: 900, default: 400 },
        ],
      },
    ];
    expect(layoutCss(options, fonts)).toContain("'wght' 700");
    expect(layoutCss(options, fonts)).toContain('clamp(16px');
    expect(() =>
      layoutCss({ ...options, axes: { '0-wght': 950 } }, fonts),
    ).toThrow();
    expect(() =>
      layoutCss({ ...options, heading: 'serif; color:red' }, fonts),
    ).toThrow();
  });
  it('composites visible pixel layers and validates backup boundaries', () => {
    const project: PixelProject = {
      width: 2,
      height: 1,
      layers: [
        { name: 'base', visible: true },
        { name: 'top', visible: true },
      ],
      frames: [
        [
          ['#ff0000', '#ffffff'],
          ['', '#0000ff'],
        ],
      ],
    };
    expect(validPixelProject(project)).toBe(true);
    expect([...pixelFrame(project, 0)]).toEqual([
      255, 0, 0, 255, 0, 0, 255, 255,
    ]);
    expect([
      ...pixelFrame(
        {
          ...project,
          layers: project.layers.map((l) => ({ ...l, visible: false })),
        },
        0,
      ),
    ]).toEqual(Array(8).fill(0));
    expect(validPixelProject({ ...project, width: 65 })).toBe(false);
    expect(validPixelProject({ ...project, frames: [[['url(x)']]] })).toBe(
      false,
    );
    expect(pixelLine([0, 0], [3, 3])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });
});
