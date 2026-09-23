import { it, expect } from 'vitest';
import {
  arrangeObjects,
  newSvgObject,
  sceneSvg,
  selectedObjects,
  validScene,
  objectBounds,
} from './visual-svg-editor';
it('exports editable shape nodes and escaped text without UI selection marks', () => {
  const text = { ...newSvgObject('text', 'one'), text: '<script>&"' };
  const path = newSvgObject('path', 'two');
  const scene = { width: 640, height: 400, objects: [text, path] };
  expect(validScene(scene)).toBe(true);
  const svg = sceneSvg(scene);
  expect(svg).toContain('&lt;script&gt;&amp;&quot;');
  expect(svg).toContain('C20 10 80 10 90 80');
  expect(svg).not.toContain('data-node');
  expect(
    validScene({ ...scene, objects: [text, { ...path, id: 'one' }] }),
  ).toBe(false);
  expect(
    validScene({
      ...scene,
      objects: [{ ...path, nodes: [{ command: 'M', values: [Infinity, 0] }] }],
    }),
  ).toBe(false);
});
it('moves grouped members together and aligns rotated bounding boxes', () => {
  const a = {
      ...newSvgObject('rect', 'a'),
      x: 0,
      y: 0,
      width: 20,
      height: 10,
      group: 'group',
    },
    b = {
      ...newSvgObject('rect', 'b'),
      x: 30,
      y: 0,
      width: 10,
      height: 10,
      group: 'group',
    },
    c = {
      ...newSvgObject('rect', 'c'),
      x: 100,
      y: 30,
      width: 20,
      height: 10,
      rotation: 90,
    };
  expect(selectedObjects([a, b, c], ['a'])).toHaveLength(2);
  const result = arrangeObjects([a, b, c], ['a', 'c'], 'left');
  expect(result[1].x - result[0].x).toBe(30);
  expect(objectBounds(result[2]).x).toBeCloseTo(objectBounds(result[0]).x);
  const distributed = arrangeObjects(
    [
      { ...a, group: null },
      { ...b, group: null },
      { ...c, rotation: 0 },
    ],
    ['a', 'b', 'c'],
    'distributeX',
  );
  expect(
    distributed[1].x - (distributed[0].x + distributed[0].width),
  ).toBeCloseTo(distributed[2].x - (distributed[1].x + distributed[1].width));
});
