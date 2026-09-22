import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import {
  appendGamepadTrail,
  gamepadBindings,
  GAMEPAD_LABELS,
  GAMEPAD_LAYOUTS,
  identifyGamepad,
  readGamepadAxis,
  readGamepadButton,
  STANDARD_AXES,
  STANDARD_BUTTONS,
  type GamepadLayout,
  type GamepadSnapshot,
  type StickPoint,
} from '@/lib/gamepad';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GamepadDiagram, GamepadStickPlot } from './gamepad-diagram';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const QUERY = {
  layout: StringParam,
  mapping: StringParam,
  buttons: StringParam,
  axes: StringParam,
  controller: StringParam,
};

export function GamepadTester() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    layout: string;
    mapping: string;
    buttons: string;
    axes: string;
    controller: string;
  }>(QUERY);
  const [active, setActive] = useState(false);
  const [pads, setPads] = useState<GamepadSnapshot[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState(false);
  const pad = pads.find((item) => item.index === selected) ?? pads[0] ?? null;
  const padKey = pad ? `${pad.index}:${pad.id}` : null;
  const detected = identifyGamepad(pad?.id ?? '');
  const layout: GamepadLayout =
    GAMEPAD_LAYOUTS.some((item) => item === query.layout) &&
    query.layout !== 'auto'
      ? (query.layout as GamepadLayout)
      : detected;
  const mapping =
    query.mapping === 'custom' && query.controller === padKey
      ? 'custom'
      : query.mapping === 'raw' || pad?.mapping !== 'standard'
        ? 'raw'
        : 'standard';
  const customButtons = gamepadBindings(
    query.buttons,
    Array<string>(17).fill('_'),
  );
  const customAxes = gamepadBindings(query.axes, Array<string>(4).fill('_'));
  const buttonBindings =
    mapping === 'standard' ? STANDARD_BUTTONS : customButtons;
  const axisBindings = mapping === 'standard' ? STANDARD_AXES : customAxes;

  useEffect(() => {
    if (!active) return;
    if (
      !window.isSecureContext ||
      typeof navigator.getGamepads !== 'function'
    ) {
      setError(t('gamepad.unsupported'));
      setActive(false);
      return;
    }
    let frame = 0;
    let previous = '';
    const read = () => {
      try {
        const current = Array.from(navigator.getGamepads())
          .filter((item): item is Gamepad => item !== null && item.connected)
          .map((item) => ({
            id: item.id,
            index: item.index,
            mapping: item.mapping,
            axes: [...item.axes],
            buttons: item.buttons.map(({ value, pressed, touched }) => ({
              value,
              pressed,
              touched,
            })),
          }));
        const signature = JSON.stringify(current);
        if (signature !== previous) {
          previous = signature;
          setPads(current);
          if (current.length) setSeen(true);
        }
        return true;
      } catch (e) {
        setError(t('gamepad.failed', { message: (e as Error).message }));
        setPads([]);
        setActive(false);
        return false;
      }
    };
    const tick = () => {
      if (read()) frame = requestAnimationFrame(tick);
    };
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) tick();
    };
    const onConnection = () => {
      read();
    };
    if (!document.hidden) tick();
    window.addEventListener('gamepadconnected', onConnection);
    window.addEventListener('gamepaddisconnected', onConnection);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('gamepadconnected', onConnection);
      window.removeEventListener('gamepaddisconnected', onConnection);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active, t]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('gamepad.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('gamepad.description')}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Button
          onClick={() => {
            setError(null);
            setPads([]);
            setActive((value) => !value);
          }}
        >
          {t(active ? 'gamepad.stop' : 'gamepad.start')}
        </Button>
        {pad && (
          <div className="space-y-1 min-w-0 max-w-full">
            <Label htmlFor="gamepad-device">{t('gamepad.device')}</Label>
            <Select
              value={String(pad.index)}
              onValueChange={(value) => setSelected(Number(value))}
            >
              <SelectTrigger id="gamepad-device" className="max-w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pads.map((item) => (
                  <SelectItem key={item.index} value={String(item.index)}>
                    #{item.index + 1} {item.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="gamepad-layout">{t('gamepad.layout')}</Label>
          <Select
            value={
              GAMEPAD_LAYOUTS.some((item) => item === query.layout)
                ? query.layout
                : 'auto'
            }
            onValueChange={(value) => setQuery({ layout: value })}
          >
            <SelectTrigger id="gamepad-layout">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GAMEPAD_LAYOUTS.map((item) => (
                <SelectItem key={item} value={item}>
                  {t(`gamepad.${item}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {pad && (
          <div className="space-y-1">
            <Label htmlFor="gamepad-mapping">{t('gamepad.mapping')}</Label>
            <Select
              value={mapping}
              onValueChange={(value) =>
                setQuery({
                  mapping: value,
                  controller: padKey ?? undefined,
                  ...(query.controller !== padKey
                    ? {
                        buttons: Array<string>(17).fill('_').join(','),
                        axes: '_,_,_,_',
                      }
                    : {}),
                })
              }
            >
              <SelectTrigger id="gamepad-mapping">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pad.mapping === 'standard' && (
                  <SelectItem value="standard">
                    {t('gamepad.standard')}
                  </SelectItem>
                )}
                <SelectItem value="raw">{t('gamepad.raw')}</SelectItem>
                <SelectItem value="custom">{t('gamepad.custom')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2"
        >
          {error}
        </p>
      )}
      {!pad && (
        <Card>
          <CardContent className="py-6 text-center">
            <p role="status">
              {t(
                active
                  ? seen
                    ? 'gamepad.disconnected'
                    : 'gamepad.waiting'
                  : 'gamepad.paused',
              )}
            </p>
            <GamepadDiagram
              layout={layout}
              buttons={Array<null>(17).fill(null)}
              axes={Array<null>(4).fill(null)}
            />
          </CardContent>
        </Card>
      )}
      {pad && (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">
              {t(`gamepad.${pad.mapping === 'standard' ? 'standard' : 'raw'}`)}
            </Badge>
            <span className="text-muted-foreground">
              {t('gamepad.detected', { layout: t(`gamepad.${detected}`) })}
            </span>
          </div>
          {pad.mapping !== 'standard' && (
            <p className="text-sm text-muted-foreground">
              {t('gamepad.nonstandard')}
            </p>
          )}
          {mapping === 'custom' && (
            <details className="rounded-lg border p-4">
              <summary className="cursor-pointer font-medium">
                {t('gamepad.bindingTitle')}
              </summary>
              <p className="text-sm text-muted-foreground my-3">
                {t('gamepad.customHint')}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {customButtons.map((binding, index) => (
                  <div key={index} className="space-y-1">
                    <Label htmlFor={`gamepad-bind-${index}`}>
                      {GAMEPAD_LABELS[layout][index]}
                    </Label>
                    <Select
                      value={binding}
                      onValueChange={(value) =>
                        setQuery({
                          buttons: customButtons
                            .map((item, i) => (i === index ? value : item))
                            .join(','),
                        })
                      }
                    >
                      <SelectTrigger
                        id={`gamepad-bind-${index}`}
                        className="w-full"
                      >
                        <SelectValue placeholder={t('gamepad.unbound')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_">
                          {t('gamepad.unbound')}
                        </SelectItem>
                        {pad.buttons.map((_, i) => (
                          <SelectItem key={`b${i}`} value={`b${i}`}>
                            {t('gamepad.button', { index: i })}
                          </SelectItem>
                        ))}
                        {pad.axes.flatMap((_, i) =>
                          (['+', '-', '>', '<'] as const).map((suffix, n) => (
                            <SelectItem
                              key={`a${i}${suffix}`}
                              value={`a${i}${suffix}`}
                            >
                              {t('gamepad.axis', { index: i })} ·{' '}
                              {t(
                                `gamepad.${['positive', 'negative', 'forward', 'reverse'][n]}`,
                              )}
                            </SelectItem>
                          )),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {customAxes.map((binding, index) => (
                  <div key={`axis-${index}`} className="space-y-1">
                    <Label htmlFor={`gamepad-axis-${index}`}>
                      {t(
                        index < 2 ? 'gamepad.leftStick' : 'gamepad.rightStick',
                      )}{' '}
                      ·{' '}
                      {t(
                        index % 2 === 0
                          ? 'gamepad.horizontal'
                          : 'gamepad.vertical',
                      )}
                    </Label>
                    <Select
                      value={binding}
                      onValueChange={(value) =>
                        setQuery({
                          axes: customAxes
                            .map((item, i) => (i === index ? value : item))
                            .join(','),
                        })
                      }
                    >
                      <SelectTrigger
                        id={`gamepad-axis-${index}`}
                        className="w-full"
                      >
                        <SelectValue placeholder={t('gamepad.unbound')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_">
                          {t('gamepad.unbound')}
                        </SelectItem>
                        {pad.axes.flatMap((_, i) =>
                          ['', '-'].map((sign) => (
                            <SelectItem
                              key={`${sign}${i}`}
                              value={`${sign}${i}`}
                            >
                              {t('gamepad.axis', { index: i })}
                              {sign ? ` · ${t('gamepad.inverted')}` : ''}
                            </SelectItem>
                          )),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() =>
                  setQuery({
                    buttons: Array<string>(17).fill('_').join(','),
                    axes: '_,_,_,_',
                  })
                }
              >
                {t('gamepad.resetMapping')}
              </Button>
            </details>
          )}
          {mapping !== 'raw' && (
            <GamepadFeedback
              key={`${pad.index}:${pad.id}:${mapping}:${query.buttons}:${query.axes}`}
              pad={pad}
              layout={layout}
              buttonBindings={buttonBindings}
              axisBindings={axisBindings}
            />
          )}
          <Card>
            <CardContent className="py-4 space-y-4">
              <h2 className="font-semibold">{t('gamepad.raw')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {pad.buttons.map((button, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-md border p-2 text-sm',
                      button.pressed && 'border-primary bg-primary/10',
                    )}
                  >
                    <div className="flex justify-between">
                      <span>B{i}</span>
                      <span className="font-mono">
                        {button.value.toFixed(3)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t(
                        button.pressed ? 'gamepad.pressed' : 'gamepad.released',
                      )}
                      {button.touched ? ` · ${t('gamepad.touched')}` : ''}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {pad.axes.map((value, i) => (
                  <div
                    key={i}
                    className="rounded-md border p-2 text-sm flex justify-between"
                  >
                    <span>A{i}</span>
                    <span className="font-mono">{value.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function GamepadFeedback({
  pad,
  layout,
  buttonBindings,
  axisBindings,
}: {
  pad: GamepadSnapshot;
  layout: GamepadLayout;
  buttonBindings: string[];
  axisBindings: string[];
}) {
  const { t } = useTranslation();
  const [trails, setTrails] = useState<StickPoint[][]>([[], []]);
  const [recording, setRecording] = useState(false);
  const [rest, setRest] = useState<{ mean: number; peak: number }[] | null>(
    null,
  );
  const buttons = buttonBindings.map((binding) =>
    readGamepadButton(pad, binding),
  );
  const axes = axisBindings.map((binding) => readGamepadAxis(pad, binding));
  const latest = useRef(axes);
  useEffect(() => {
    latest.current = axes;
  });
  const [lx, ly, rx, ry] = axes;
  useEffect(() => {
    setTrails((previous) =>
      previous.map((trail, i) => {
        const x = i === 0 ? lx : rx;
        const y = i === 0 ? ly : ry;
        return x !== null && x !== undefined && y !== null && y !== undefined
          ? appendGamepadTrail(trail, { x, y })
          : trail;
      }),
    );
  }, [lx, ly, rx, ry]);
  useEffect(() => {
    if (!recording) return;
    const start = performance.now();
    const values = [
      { sum: 0, peak: 0, count: 0 },
      { sum: 0, peak: 0, count: 0 },
    ];
    let frame = 0;
    const tick = (now: number) => {
      values.forEach((value, i) => {
        const x = latest.current[i * 2];
        const y = latest.current[i * 2 + 1];
        if (x === null || y === null || x === undefined || y === undefined)
          return;
        const radius = Math.hypot(x, y);
        value.sum += radius;
        value.peak = Math.max(value.peak, radius);
        value.count++;
      });
      if (now - start >= 2000) {
        setRest(
          values.map(({ sum, peak, count }) => ({
            mean: count ? sum / count : 0,
            peak,
          })),
        );
        setRecording(false);
      } else frame = requestAnimationFrame(tick);
    };
    const cancel = () => {
      if (document.hidden) {
        setRecording(false);
        cancelAnimationFrame(frame);
      }
    };
    frame = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', cancel);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', cancel);
    };
  }, [recording]);

  return (
    <Card>
      <CardContent className="py-4 space-y-4">
        <GamepadDiagram layout={layout} buttons={buttons} axes={axes} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setTrails([[], []])}>
            {t('gamepad.clear')}
          </Button>
          <Button
            variant="outline"
            disabled={recording || axes.every((value) => value === null)}
            onClick={() => {
              setRest(null);
              setRecording(true);
            }}
          >
            {t(recording ? 'gamepad.recording' : 'gamepad.rest')}
          </Button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {[0, 1].map((i) => {
            const x = axes[i * 2];
            const y = axes[i * 2 + 1];
            const valid =
              x !== null && x !== undefined && y !== null && y !== undefined;
            const label = t(
              i === 0 ? 'gamepad.leftStick' : 'gamepad.rightStick',
            );
            return (
              <div key={i} className="rounded-lg border p-4 space-y-2">
                <h2 className="font-semibold">{label}</h2>
                {valid ? (
                  <>
                    <GamepadStickPlot
                      point={{ x, y }}
                      trail={trails[i]}
                      label={label}
                    />
                    <p className="text-sm font-mono">
                      X {x.toFixed(4)} / Y {y.toFixed(4)}
                    </p>
                    <p className="text-sm">
                      {t('gamepad.displacement')}：
                      {(Math.hypot(x, y) * 100).toFixed(2)}%
                    </p>
                    {rest && (
                      <p className="text-sm">
                        {t('gamepad.restResult')}：
                        {(rest[i].mean * 100).toFixed(2)}% · {t('gamepad.peak')}
                        ：{(rest[i].peak * 100).toFixed(2)}%
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('gamepad.unbound')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {t('gamepad.driftHint')}
        </p>
      </CardContent>
    </Card>
  );
}
