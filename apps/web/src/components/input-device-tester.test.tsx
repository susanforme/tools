// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { KEYBOARD_KEYS } from '@/lib/keyboard-layout';
import { InputDeviceTester } from './input-device-tester';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('renders all 104 physical keys without overlapping keycaps', () => {
  expect(KEYBOARD_KEYS).toHaveLength(104);
  expect(new Set(KEYBOARD_KEYS.map((key) => key.code)).size).toBe(104);
  for (const key of KEYBOARD_KEYS) {
    expect(key.x + key.width).toBeLessThan(1152);
    expect(key.y + key.height).toBeLessThan(378);
    for (const other of KEYBOARD_KEYS) {
      if (key === other) continue;
      expect(
        key.x < other.x + other.width &&
          key.x + key.width > other.x &&
          key.y < other.y + other.height &&
          key.y + key.height > other.y,
      ).toBe(false);
    }
  }
});

it('starts automatically, tracks input, resumes after focus and stops on unmount', () => {
  vi.useFakeTimers();
  let now = 100;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const { container, unmount } = render(
    <StrictMode>
      <InputDeviceTester />
    </StrictMode>,
  );
  const surface = screen.getByRole('region', { name: 'inputTester.surface' });
  const pad = screen.getByRole('region', { name: 'inputTester.mouseArea' });
  const key = (code: string) =>
    container.querySelector(`[data-code="${code}"]`)!;
  const mouseButton = (index: number) =>
    container.querySelector(`[data-mouse-button="${index}"]`)!;
  const metric = (label: string) =>
    screen.getByText(`inputTester.${label}`).nextElementSibling!.textContent;
  expect(
    screen.queryByRole('button', { name: 'inputTester.start' }),
  ).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('inputTester.listening');
  fireEvent.keyDown(surface, { code: 'ShiftLeft', key: 'Shift' });
  fireEvent.keyDown(surface, { code: 'ShiftRight', key: 'Shift' });
  fireEvent.keyDown(surface, { code: 'Digit1', key: '!' });
  fireEvent.keyDown(surface, { code: 'Numpad1', key: 'End' });
  fireEvent.keyDown(surface, { code: 'Numpad1', key: 'End', repeat: true });
  expect(key('ShiftLeft').getAttribute('data-pressed')).toBe('true');
  expect(key('ShiftRight').getAttribute('data-pressed')).toBe('true');
  expect(key('Digit1').getAttribute('data-pressed')).toBe('true');
  expect(key('Numpad1').getAttribute('data-pressed')).toBe('true');
  expect(metric('keyPresses')).toBe('4');
  expect(metric('repeats')).toBe('1');
  expect(metric('peak')).toBe('4');
  now = 175;
  fireEvent.keyUp(window, { code: 'Numpad1', key: 'End' });
  expect(key('Numpad1').getAttribute('data-pressed')).toBe('false');
  expect(key('Numpad1').getAttribute('data-tested')).toBe('true');
  expect(screen.getByText(/75 ms/)).toBeTruthy();
  const input = document.createElement('input');
  document.body.append(input);
  const outside = new KeyboardEvent('keydown', {
    code: 'Space',
    key: ' ',
    cancelable: true,
  });
  input.dispatchEvent(outside);
  input.remove();
  expect(outside.defaultPrevented).toBe(false);
  expect(fireEvent.keyDown(surface, { code: 'Tab', key: 'Tab' })).toBe(true);

  // 同时按下五键，松开其中一个不能释放其他键；区域外 mouseup 仍复位。
  for (const [index, buttons] of [
    [0, 1],
    [2, 3],
    [1, 7],
    [3, 15],
    [4, 31],
  ]) {
    fireEvent.mouseDown(pad, { button: index, buttons });
    expect(mouseButton(index).getAttribute('data-pressed')).toBe('true');
    expect(screen.getByTestId(`mouse-count-${index}`).textContent).toBe('1');
  }
  fireEvent.mouseUp(window, { button: 2, buttons: 29 });
  expect(mouseButton(2).getAttribute('data-pressed')).toBe('false');
  expect(mouseButton(0).getAttribute('data-pressed')).toBe('true');
  fireEvent.mouseUp(window, { buttons: 0 });
  expect(mouseButton(0).getAttribute('data-pressed')).toBe('false');
  now = 225;
  fireEvent.mouseDown(pad, { button: 0, buttons: 1 });
  expect(metric('clickInterval')).toBe('50 ms');
  fireEvent.doubleClick(pad, { button: 0 });
  expect(metric('doubleClicks')).toBe('1');
  expect(fireEvent.contextMenu(pad)).toBe(false);
  expect(fireEvent.contextMenu(document.body)).toBe(true);
  expect(fireEvent.wheel(pad, { deltaY: -100, deltaX: 10 })).toBe(false);
  expect(screen.getByTestId('mouse-wheel').getAttribute('data-direction')).toBe(
    '-1',
  );
  act(() => vi.advanceTimersByTime(181));
  expect(screen.getByTestId('mouse-wheel').getAttribute('data-direction')).toBe(
    '0',
  );

  vi.spyOn(pad, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 640,
    bottom: 240,
    width: 640,
    height: 240,
    toJSON: () => ({}),
  });
  fireEvent.mouseMove(pad, { clientX: 10, clientY: 10, buttons: 1 });
  fireEvent.mouseMove(pad, { clientX: 13, clientY: 14, buttons: 1 });
  act(() => vi.advanceTimersByTime(20));
  expect(metric('distance')).toBe('5 px');
  // 移动帧不能用过期的 buttons 快照覆盖其后发生的按下事件。
  fireEvent.mouseMove(pad, { clientX: 14, clientY: 15, buttons: 0 });
  fireEvent.mouseDown(pad, { button: 0, buttons: 1 });
  act(() => vi.advanceTimersByTime(20));
  expect(mouseButton(0).getAttribute('data-pressed')).toBe('true');

  fireEvent.blur(window);
  expect(screen.getByRole('status').textContent).toBe('inputTester.paused');
  const countBeforeFocus = metric('keyPresses');
  fireEvent.keyDown(surface, { code: 'KeyZ', key: 'z' });
  expect(metric('keyPresses')).toBe(countBeforeFocus);
  fireEvent.focus(window);
  fireEvent.keyDown(surface, { code: 'KeyZ', key: 'z' });
  expect(key('KeyZ').getAttribute('data-pressed')).toBe('true');
  fireEvent.keyUp(surface, { code: 'KeyZ', key: 'z' });
  expect(container.querySelectorAll('[data-pressed="true"]')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'inputTester.reset' }));
  expect(metric('keyPresses')).toBe('0');
  expect(metric('distance')).toBe('0 px');
  expect(container.querySelectorAll('[data-tested="true"]')).toHaveLength(0);
  fireEvent.focus(window);
  fireEvent.keyDown(surface, { code: 'Escape', key: 'Escape' });
  expect(key('Escape').getAttribute('data-tested')).toBe('true');
  expect(screen.getByRole('status').textContent).toBe('inputTester.listening');
  fireEvent.keyUp(surface, { code: 'Escape', key: 'Escape' });
  fireEvent.keyDown(document.body, { code: 'KeyA', key: 'a' });
  expect(key('KeyA').getAttribute('data-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'inputTester.reset' }));
  expect(metric('keyPresses')).toBe('0');
  expect(container.querySelectorAll('[data-pressed="true"]')).toHaveLength(0);
  fireEvent.keyDown(surface, { code: 'KeyA', key: 'a' });
  expect(metric('keyPresses')).toBe('1');
  // 清空 jsdom 聚焦行为排入的任务，再验证本次帧和滚轮计时器的清理。
  act(() => vi.runOnlyPendingTimers());
  fireEvent.mouseMove(pad, { clientX: 20, clientY: 20 });
  fireEvent.wheel(pad, { deltaY: 10 });
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  expect(fireEvent.keyDown(surface, { code: 'Space', key: ' ' })).toBe(true);
});
