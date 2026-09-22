import { describe, expect, it } from 'vitest';
import {
  appendGamepadTrail,
  gamepadBindings,
  identifyGamepad,
  readGamepadAxis,
  readGamepadButton,
  type GamepadSnapshot,
} from './gamepad';

describe('gamepad input mapping', () => {
  const pad: GamepadSnapshot = {
    id: 'test',
    index: 0,
    mapping: '',
    buttons: [{ value: 0.63, pressed: true, touched: true }],
    axes: [-1, 0.04, 0.7, 1],
  };
  it('keeps trigger pressure, supports custom half/full axes, and rejects absent bindings', () => {
    expect(readGamepadButton(pad, 'b0')).toBe(0.63);
    expect(readGamepadButton(pad, 'a0>')).toBe(0);
    expect(readGamepadButton(pad, 'a0<')).toBe(1);
    expect(readGamepadButton(pad, 'a2+')).toBe(0.7);
    expect(readGamepadButton(pad, 'a0-')).toBe(1);
    expect(readGamepadAxis(pad, '-0')).toBe(1);
    expect(readGamepadAxis(pad, '1')).toBe(0.04);
    for (const binding of ['_', 'b20', 'b-1', 'a20>', 'a1', '<script>'])
      expect(readGamepadButton(pad, binding)).toBeNull();
    expect(readGamepadAxis(pad, 'NaN')).toBeNull();
    expect(readGamepadAxis(pad, '99')).toBeNull();
    expect(gamepadBindings('b2', ['b0', 'b1'])).toEqual(['b2', '_']);
  });
  it('only suggests appearance from identity and bounds trails without duplicating resting points', () => {
    expect(identifyGamepad('DualSense (Vendor: 054c Product: 0ce6)')).toBe(
      'playstation',
    );
    expect(identifyGamepad('Nintendo Switch Pro Controller')).toBe('nintendo');
    expect(identifyGamepad('Xbox Wireless Controller')).toBe('xbox');
    expect(identifyGamepad('8BitDo')).toBe('generic');
    let trail = [{ x: 0, y: 0 }];
    expect(appendGamepadTrail(trail, { x: 0, y: 0 })).toBe(trail);
    for (let i = 0; i < 150; i++)
      trail = appendGamepadTrail(trail, { x: i / 150, y: 0 });
    expect(trail).toHaveLength(120);
    expect(trail.at(-1)?.x).toBe(149 / 150);
  });
});
