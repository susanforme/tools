import { KEYBOARD_KEYS } from '@/lib/keyboard-layout';
import { cn } from '@/lib/utils';
import { Keyboard, Mouse, RotateCcw } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

interface KeyboardState {
  pressed: string[];
  counts: Record<string, number>;
  total: number;
  repeats: number;
  peak: number;
  last: { code: string; key: string; duration: number | null } | null;
}
interface Point {
  x: number;
  y: number;
}
interface MouseState {
  buttons: number;
  counts: number[];
  doubleClicks: number;
  interval: number | null;
  wheel: Point;
  scrolls: Point;
  distance: number;
  position: Point | null;
  trail: Point[];
}
const EMPTY_KEYBOARD: KeyboardState = {
  pressed: [],
  counts: {},
  total: 0,
  repeats: 0,
  peak: 0,
  last: null,
};
const EMPTY_MOUSE: MouseState = {
  buttons: 0,
  counts: [0, 0, 0, 0, 0],
  doubleClicks: 0,
  interval: null,
  wheel: { x: 0, y: 0 },
  scrolls: { x: 0, y: 0 },
  distance: 0,
  position: null,
  trail: [],
};
const MOUSE_BUTTONS = [
  { bit: 1, name: 'left' },
  { bit: 4, name: 'middle' },
  { bit: 2, name: 'right' },
  { bit: 8, name: 'back' },
  { bit: 16, name: 'forward' },
] as const;

export function InputDeviceTester() {
  const { t } = useTranslation();
  const [active, setActive] = useState(true);
  const [session, setSession] = useState(0);
  const [keyboard, setKeyboard] = useState<KeyboardState>(EMPTY_KEYBOARD);
  const [mouse, setMouse] = useState<MouseState>(EMPTY_MOUSE);
  const surface = useRef<HTMLDivElement>(null);
  const mousePad = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let listening = !document.hidden;
    setActive(listening);
    surface.current?.focus({ preventScroll: true });
    const held = new Map<string, number>();
    const lastDown: Array<number | null> = [null, null, null, null, null];
    let previous: Point | null = null;
    let frame = 0;
    let wheelTimer = 0;
    let pendingDistance = 0;
    let pendingPoint: Point | null = null;
    let pendingPosition: Point | null = null;
    const inMousePad = (target: EventTarget | null) =>
      target instanceof Node && !!mousePad.current?.contains(target);
    const isControl = (target: EventTarget | null) =>
      target instanceof Element &&
      !!target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), button, a, [role="combobox"], [role="textbox"]',
      );
    const pause = () => {
      listening = false;
      held.clear();
      lastDown.fill(null);
      previous = null;
      pendingDistance = 0;
      cancelAnimationFrame(frame);
      frame = 0;
      clearTimeout(wheelTimer);
      setActive(false);
      setKeyboard((prev) => ({ ...prev, pressed: [] }));
      setMouse((prev) => ({ ...prev, buttons: 0, wheel: { x: 0, y: 0 } }));
    };
    const resume = () => {
      listening = !document.hidden;
      setActive(listening);
    };
    const onVisibility = () => {
      if (document.hidden) pause();
      else resume();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!listening || isControl(event.target)) return;
      // 保留 Tab 导航和 Esc，避免自动检测阻断键盘访问页面控件。
      if (event.key !== 'Tab' && event.key !== 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
      const code = event.code || event.key;
      if (event.repeat || held.has(code)) {
        setKeyboard((prev) => ({ ...prev, repeats: prev.repeats + 1 }));
        return;
      }
      held.set(code, performance.now());
      const pressed = [...held.keys()];
      setKeyboard((prev) => ({
        ...prev,
        pressed,
        counts: { ...prev.counts, [code]: (prev.counts[code] ?? 0) + 1 },
        total: prev.total + 1,
        peak: Math.max(prev.peak, pressed.length),
        last: { code, key: event.key, duration: null },
      }));
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const code = event.code || event.key;
      const since = held.get(code);
      if (since === undefined) return;
      if (
        !isControl(event.target) &&
        event.key !== 'Tab' &&
        event.key !== 'Escape'
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
      held.delete(code);
      // macOS 的 Command 组合键可能不发送其他键的 keyup，松开 Command 时复位。
      if (code === 'MetaLeft' || code === 'MetaRight') held.clear();
      const duration = Math.round(performance.now() - since);
      const pressed = [...held.keys()];
      setKeyboard((prev) => ({
        ...prev,
        pressed,
        last: { code, key: event.key, duration },
      }));
    };
    const onMouseDown = (event: MouseEvent) => {
      if (!listening) return;
      if (inMousePad(event.target)) {
        event.preventDefault();
        surface.current?.focus({ preventScroll: true });
      }
      const button = event.button;
      if (button < 0 || button >= MOUSE_BUTTONS.length) return;
      const now = performance.now();
      const last = lastDown[button];
      lastDown[button] = now;
      setMouse((prev) => ({
        ...prev,
        buttons: event.buttons,
        counts: prev.counts.map(
          (count, index) => count + Number(index === button),
        ),
        interval: last === null ? null : Math.round(now - last),
      }));
    };
    // mousedown/up 可捕获组合按键中的每一次变化，pointerdown 只报告首次按下。
    const onMouseUp = (event: MouseEvent) => {
      setMouse((prev) => ({ ...prev, buttons: prev.buttons & event.buttons }));
    };
    const onMouseMove = (event: MouseEvent) => {
      if (!listening) return;
      setMouse((prev) =>
        prev.buttons === (prev.buttons & event.buttons)
          ? prev
          : { ...prev, buttons: prev.buttons & event.buttons },
      );
      if (!inMousePad(event.target)) {
        previous = null;
        return;
      }
      const rect = mousePad.current!.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const position = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      if (previous)
        pendingDistance += Math.hypot(
          position.x - previous.x,
          position.y - previous.y,
        );
      previous = position;
      pendingPosition = position;
      pendingPoint = {
        x: (position.x / rect.width) * 640,
        y: (position.y / rect.height) * 240,
      };
      // 合并高频移动事件，每帧最多渲染一次，轨迹保留最近 60 个点。
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          const distance = pendingDistance;
          const point = pendingPoint!;
          const position = pendingPosition;
          pendingDistance = 0;
          setMouse((prev) => ({
            ...prev,
            position,
            distance: prev.distance + distance,
            trail: [...prev.trail.slice(-59), point],
          }));
        });
    };
    const onWheel = (event: WheelEvent) => {
      if (!listening) return;
      if (inMousePad(event.target)) event.preventDefault();
      const x = Math.sign(event.deltaX);
      const y = Math.sign(event.deltaY);
      setMouse((prev) => ({
        ...prev,
        wheel: { x, y },
        scrolls: {
          x: prev.scrolls.x + Number(x !== 0),
          y: prev.scrolls.y + Number(y !== 0),
        },
      }));
      clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(
        () => setMouse((prev) => ({ ...prev, wheel: { x: 0, y: 0 } })),
        180,
      );
    };
    const preventMouseAction = (event: MouseEvent) => {
      if (listening && inMousePad(event.target)) event.preventDefault();
    };
    const onDoubleClick = (event: MouseEvent) => {
      if (listening && event.button === 0)
        setMouse((prev) => ({ ...prev, doubleClicks: prev.doubleClicks + 1 }));
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('mouseup', onMouseUp, true);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('contextmenu', preventMouseAction);
    window.addEventListener('auxclick', preventMouseAction);
    window.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('blur', pause);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('mouseup', onMouseUp, true);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('contextmenu', preventMouseAction);
      window.removeEventListener('auxclick', preventMouseAction);
      window.removeEventListener('dblclick', onDoubleClick);
      window.removeEventListener('blur', pause);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(frame);
      clearTimeout(wheelTimer);
    };
  }, [session]);

  const tested = KEYBOARD_KEYS.filter(
    (key) => keyboard.counts[key.code],
  ).length;
  const reset = () => {
    setKeyboard(EMPTY_KEYBOARD);
    setMouse(EMPTY_MOUSE);
    setSession((prev) => prev + 1);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Keyboard className="h-5 w-5 text-primary" />
          {t('inputTester.title')}
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant={active ? 'default' : 'secondary'} role="status">
            {t(active ? 'inputTester.listening' : 'inputTester.paused')}
          </Badge>
          <Button size="sm" variant="outline" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            {t('inputTester.reset')}
          </Button>
        </div>
      </div>
      <p id="input-test-instructions" className="text-sm text-muted-foreground">
        {t('inputTester.instructions')}
      </p>
      <div
        ref={surface}
        tabIndex={0}
        role="region"
        aria-label={t('inputTester.surface')}
        aria-describedby="input-test-instructions"
        className="space-y-5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
      >
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold">
                <Keyboard className="h-4 w-4" />
                {t('inputTester.keyboard')}
              </h2>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>
                  {t('inputTester.coverage', {
                    count: tested,
                    total: KEYBOARD_KEYS.length,
                  })}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  {t('inputTester.pressed')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full border border-primary bg-primary/20" />
                  {t('inputTester.tested')}
                </span>
              </div>
            </div>
            <div className="overflow-x-auto pb-1">
              <KeyboardDrawing
                keyboard={keyboard}
                label={t('inputTester.keyboard')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric
                label={t('inputTester.keyPresses')}
                value={keyboard.total}
              />
              <Metric
                label={t('inputTester.held')}
                value={keyboard.pressed.length}
              />
              <Metric label={t('inputTester.peak')} value={keyboard.peak} />
              <Metric
                label={t('inputTester.repeats')}
                value={keyboard.repeats}
              />
            </div>
            <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {t('inputTester.lastKey')}
              </span>
              <span className="font-mono font-medium" data-testid="last-key">
                {keyboard.last
                  ? `${keyboard.last.code} · ${keyboard.last.key === ' ' ? 'Space' : keyboard.last.key}`
                  : '—'}
              </span>
              {keyboard.last?.duration !== null && keyboard.last && (
                <span className="ml-auto text-muted-foreground">
                  {t('inputTester.holdTime')} {keyboard.last.duration} ms
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('inputTester.keyboardLimit')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <Mouse className="h-4 w-4" />
              {t('inputTester.mouse')}
            </h2>
            <div
              ref={mousePad}
              role="region"
              aria-label={t('inputTester.mouseArea')}
              className="relative grid min-h-72 select-none items-center gap-4 overflow-hidden rounded-xl border border-dashed border-primary/30 bg-muted/30 p-4 md:grid-cols-[200px_1fr] md:p-6"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 640 240"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 h-full w-full text-primary/40"
              >
                <polyline
                  points={mouse.trail
                    .map((point) => `${point.x},${point.y}`)
                    .join(' ')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {mouse.trail.at(-1) && (
                  <circle
                    cx={mouse.trail.at(-1)!.x}
                    cy={mouse.trail.at(-1)!.y}
                    r="4"
                    fill="currentColor"
                  />
                )}
              </svg>
              <MouseDrawing mouse={mouse} />
              <div className="pointer-events-none relative space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t('inputTester.mouseHint')}
                </p>
                <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
                  {MOUSE_BUTTONS.map((button, index) => (
                    <div
                      key={button.name}
                      className={cn(
                        'rounded-lg border bg-background/80 px-2 py-3 text-center transition-colors',
                        mouse.buttons & button.bit
                          ? 'border-primary text-primary'
                          : 'border-border',
                      )}
                    >
                      <div className="text-xs text-muted-foreground">
                        {t(`inputTester.buttons.${button.name}`)}
                      </div>
                      <div
                        className="mt-1 font-mono text-lg font-semibold tabular-nums"
                        data-testid={`mouse-count-${index}`}
                      >
                        {mouse.counts[index]}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                  <span>
                    {t('inputTester.verticalWheel')}: {mouse.scrolls.y}{' '}
                    {mouse.wheel.y < 0 ? '↑' : mouse.wheel.y > 0 ? '↓' : ''}
                  </span>
                  <span>
                    {t('inputTester.horizontalWheel')}: {mouse.scrolls.x}{' '}
                    {mouse.wheel.x < 0 ? '←' : mouse.wheel.x > 0 ? '→' : ''}
                  </span>
                  <span>
                    {t('inputTester.position')}:{' '}
                    {mouse.position
                      ? `${Math.round(mouse.position.x)}, ${Math.round(mouse.position.y)}`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Metric
                label={t('inputTester.doubleClicks')}
                value={mouse.doubleClicks}
              />
              <Metric
                label={t('inputTester.clickInterval')}
                value={mouse.interval === null ? '—' : `${mouse.interval} ms`}
              />
              <Metric
                label={t('inputTester.distance')}
                value={`${Math.round(mouse.distance)} px`}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('inputTester.mouseLimit')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}

const KeyboardDrawing = memo(function KeyboardDrawing({
  keyboard,
  label,
}: {
  keyboard: KeyboardState;
  label: string;
}) {
  return (
    <svg
      viewBox="0 0 1152 378"
      role="img"
      aria-label={label}
      className="w-full min-w-[760px] select-none"
    >
      <rect
        x="1"
        y="5"
        width="1150"
        height="372"
        rx="18"
        className="fill-border"
      />
      <rect
        x="1"
        y="1"
        width="1150"
        height="368"
        rx="18"
        className="fill-muted stroke-border"
      />
      {KEYBOARD_KEYS.map((key) => {
        const pressed = keyboard.pressed.includes(key.code);
        const tested = !!keyboard.counts[key.code];
        return (
          <g
            key={key.code}
            data-code={key.code}
            data-pressed={pressed}
            data-tested={tested}
          >
            <title>
              {key.code}: {keyboard.counts[key.code] ?? 0}
            </title>
            <rect
              x={key.x}
              y={key.y + 4}
              width={key.width}
              height={key.height}
              rx="6"
              className={cn('fill-border', tested && 'fill-primary/30')}
            />
            <g
              className={cn(
                'transition-transform duration-75 ease-out motion-reduce:transition-none',
                pressed && 'translate-y-[3px] motion-reduce:translate-y-0',
              )}
            >
              <rect
                x={key.x}
                y={key.y}
                width={key.width}
                height={key.height}
                rx="6"
                className={cn(
                  'fill-background stroke-border transition-colors duration-75 motion-reduce:transition-none',
                  tested && 'fill-primary/10 stroke-primary/40',
                  pressed && 'fill-primary stroke-primary',
                )}
              />
              <text
                x={key.x + key.width / 2}
                y={key.y + key.height / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                className={cn(
                  'pointer-events-none fill-foreground font-mono text-[11px] font-medium',
                  pressed && 'fill-primary-foreground',
                )}
              >
                {key.label}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
});

function MouseDrawing({ mouse }: { mouse: MouseState }) {
  const { t } = useTranslation();
  const buttonClass = (bit: number) =>
    cn(
      'stroke-border transition-all duration-75 motion-reduce:transition-none',
      mouse.buttons & bit
        ? 'fill-primary translate-y-[2px] motion-reduce:translate-y-0'
        : 'fill-background',
    );
  return (
    <svg
      viewBox="0 0 200 284"
      role="img"
      aria-label={t('inputTester.mouse')}
      className="pointer-events-none relative mx-auto h-60 w-44 drop-shadow-md"
    >
      <path
        d="M100 0 V28"
        fill="none"
        strokeWidth="5"
        className="stroke-border"
      />
      <path
        d="M100 24 C49 24 25 61 25 118 L25 188 C25 241 49 268 100 268 C151 268 175 241 175 188 L175 118 C175 61 151 24 100 24Z"
        className="fill-muted stroke-border"
        strokeWidth="2"
      />
      <path
        data-mouse-button="0"
        data-pressed={!!(mouse.buttons & 1)}
        d="M95 30 C52 31 31 65 31 115 V133 H95Z"
        className={buttonClass(1)}
        strokeWidth="2"
      />
      <path
        data-mouse-button="2"
        data-pressed={!!(mouse.buttons & 2)}
        d="M105 30 C148 31 169 65 169 115 V133 H105Z"
        className={buttonClass(2)}
        strokeWidth="2"
      />
      <rect
        data-mouse-button="3"
        data-pressed={!!(mouse.buttons & 8)}
        x="17"
        y="149"
        width="10"
        height="41"
        rx="5"
        className={buttonClass(8)}
        strokeWidth="2"
      />
      <rect
        data-mouse-button="4"
        data-pressed={!!(mouse.buttons & 16)}
        x="17"
        y="100"
        width="10"
        height="41"
        rx="5"
        className={buttonClass(16)}
        strokeWidth="2"
      />
      <g
        data-testid="mouse-wheel"
        data-direction={mouse.wheel.y}
        className={cn(
          'transition-transform duration-75 motion-reduce:transition-none',
          mouse.wheel.y < 0 && '-translate-y-[3px]',
          mouse.wheel.y > 0 && 'translate-y-[3px]',
          mouse.wheel.x < 0 && '-translate-x-[3px]',
          mouse.wheel.x > 0 && 'translate-x-[3px]',
          'motion-reduce:translate-x-0',
          'motion-reduce:translate-y-0',
        )}
      >
        <rect
          data-mouse-button="1"
          data-pressed={!!(mouse.buttons & 4)}
          x="87"
          y="61"
          width="26"
          height="49"
          rx="12"
          className={cn(
            buttonClass(4),
            !(mouse.buttons & 4) &&
              (mouse.wheel.x !== 0 || mouse.wheel.y !== 0) &&
              'fill-primary/20 stroke-primary',
          )}
          strokeWidth="2"
        />
        <path
          d="M93 74 H107 M93 82 H107 M93 90 H107 M93 98 H107"
          fill="none"
          strokeWidth="2"
          className={
            mouse.buttons & 4
              ? 'stroke-primary-foreground'
              : 'stroke-muted-foreground'
          }
        />
      </g>
      <path
        d="M88 213 L100 225 L112 213"
        fill="none"
        strokeWidth="3"
        className="stroke-primary/30"
      />
    </svg>
  );
}
