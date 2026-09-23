// @vitest-environment jsdom
import { it, expect } from 'vitest';
import {
  cleanMotifSvg,
  patternPeriod,
  patternSvg,
  type PatternOptions,
} from './seamless-pattern';
const options: PatternOptions = {
  layout: 'grid',
  width: 120,
  height: 80,
  size: 60,
  angle: 30,
  x: 50,
  y: 50,
  repeat: 4,
  background: '#ffffff',
  color: '#e11d48',
  shape: 'leaf',
};
it('exports full rectangular repeat periods for half-drop and mirror layouts', () => {
  expect(patternPeriod(options)).toEqual({ width: 120, height: 80 });
  expect(patternPeriod({ ...options, layout: 'halfDrop' })).toEqual({
    width: 240,
    height: 80,
  });
  expect(patternPeriod({ ...options, layout: 'mirror' })).toEqual({
    width: 240,
    height: 160,
  });
  const svg = patternSvg({ ...options, layout: 'mirror' }, null, true);
  expect(svg).toContain('width="960" height="640"');
  expect(svg).toContain('scale(-1 -1)');
  expect(svg).toContain('patternUnits="userSpaceOnUse"');
  expect(svg.match(/<image /g)).toHaveLength(1);
  expect(svg.match(/<use /g)).toHaveLength(36);
  expect(() => patternSvg({ ...options, width: 0 }, null, false)).toThrow(
    'pattern',
  );
});
it('strips executable and external-resource SVG motifs while retaining local vector shapes', () => {
  const svg = cleanMotifSvg(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><image href="https://example.com/x"/><rect width="10" height="10" onclick="x()" fill="url(https://example.com/x)"/><path d="M0 0L1 1"/></svg>',
  );
  expect(svg).not.toContain('script');
  expect(svg).not.toContain('image');
  expect(svg).not.toContain('onclick');
  expect(svg).not.toContain('http://example');
  expect(svg).toContain('<path');
  expect(() =>
    cleanMotifSvg('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///x">]><svg/>'),
  ).toThrow('svg');
});
