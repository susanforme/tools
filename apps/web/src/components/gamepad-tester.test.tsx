// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GamepadTester } from './gamepad-tester';

const mocks = vi.hoisted(() => ({
  t: (key: string) => key,
  query: {} as Record<string, string>,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mocks.t }) }));
vi.mock('@/hooks/useQueryParams', () => ({
  StringParam: {},
  useQueryParams: () => [mocks.query, vi.fn()],
}));

let pads: (Gamepad | null)[] = [];
let nextFrame = 0;
let frames = new Map<number, FrameRequestCallback>();
function step() {
  const callbacks = [...frames.values()];
  frames.clear();
  act(() => callbacks.forEach((callback) => callback(performance.now())));
}
function controller(mapping: GamepadMappingType = 'standard') {
  return {
    id: 'Xbox Wireless Controller',
    index: 0,
    mapping,
    connected: true,
    timestamp: 1,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({
      value: 0,
      pressed: false,
      touched: false,
    })),
    hapticActuators: [],
    vibrationActuator: {
      pulse: vi.fn(async () => true),
      playEffect: vi.fn(async () => 'complete' as const),
      reset: vi.fn(async () => 'complete' as const),
    } satisfies GamepadHapticActuator,
  };
}

beforeEach(() => {
  pads = [];
  frames = new Map();
  mocks.query = {};
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  Object.defineProperty(navigator, 'getGamepads', {
    configurable: true,
    value: () => pads,
  });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'getGamepads');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('live gamepad feedback', () => {
  it('updates the SVG from current input, handles disconnect/reconnect, and cleans up frames', () => {
    pads = [controller()];
    const view = render(<GamepadTester />);
    fireEvent.click(screen.getByText('gamepad.start'));
    const moving = controller();
    moving.axes = [0.5, -0.25, 0, 0];
    moving.buttons[0] = { value: 1, pressed: true, touched: true };
    moving.buttons[6] = { value: 0.63, pressed: true, touched: true };
    pads = [moving];
    step();
    const svg = screen.getByRole('img', { name: 'gamepad.diagram' });
    expect(svg.querySelector('[data-brand="xbox"] path')).not.toBeNull();
    expect(svg.querySelector('circle[cx="155.5"][cy="168.75"]')).not.toBeNull();
    expect(svg.querySelector('rect[width="54.18"]')).not.toBeNull();
    expect(
      svg.querySelector('circle[cx="454"][cy="210"]')?.getAttribute('class'),
    ).toContain('fill-primary');
    mocks.query = { layout: 'playstation' };
    view.rerender(<GamepadTester />);
    expect(svg.querySelector('[data-brand="playstation"] path')).not.toBeNull();
    expect(svg.querySelector('[data-brand="xbox"]')).toBeNull();
    pads = [];
    step();
    expect(screen.getByText('gamepad.disconnected')).toBeTruthy();
    pads = [controller()];
    step();
    expect(screen.queryByText('gamepad.disconnected')).toBeNull();
    view.unmount();
    expect(frames.size).toBe(0);
  });
  it('leaves unknown mappings raw while an explicit manual mapping drives the diagram', () => {
    pads = [controller('')];
    const view = render(<GamepadTester />);
    fireEvent.click(screen.getByText('gamepad.start'));
    expect(screen.queryByRole('img', { name: 'gamepad.diagram' })).toBeNull();
    expect(screen.getByText('gamepad.nonstandard')).toBeTruthy();
    mocks.query = {
      mapping: 'custom',
      controller: '0:Xbox Wireless Controller',
      buttons: 'b2',
      axes: '2,3,0,1',
    };
    const custom = controller('');
    custom.buttons[2] = { value: 1, pressed: true, touched: true };
    custom.axes = [0, 0, 1, 0];
    pads = [custom];
    view.rerender(<GamepadTester />);
    step();
    const svg = screen.getByRole('img', { name: 'gamepad.diagram' });
    expect(svg.querySelector('circle[cx="166"][cy="174"]')).not.toBeNull();
    expect(
      svg.querySelector('circle[cx="454"][cy="210"]')?.getAttribute('class'),
    ).toContain('fill-primary');
  });
  it('does not apply a custom mapping to a different controller', () => {
    mocks.query = {
      mapping: 'custom',
      controller: '0:Other controller',
      buttons: 'b0',
      axes: '0,1,2,3',
    };
    pads = [controller('')];
    render(<GamepadTester />);
    fireEvent.click(screen.getByText('gamepad.start'));
    expect(screen.queryByRole('img', { name: 'gamepad.diagram' })).toBeNull();
  });
  it('reports an unsupported environment and does not schedule polling', () => {
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: undefined,
    });
    render(<GamepadTester />);
    fireEvent.click(screen.getByText('gamepad.start'));
    expect(screen.getByRole('alert').textContent).toBe('gamepad.unsupported');
    expect(frames.size).toBe(0);
  });
});
