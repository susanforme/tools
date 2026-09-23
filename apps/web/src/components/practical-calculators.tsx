import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrayParam,
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  RESISTOR_COLORS,
  TOLERANCE,
  TEMPERATURE,
  decodeBands,
  encodeBands,
  decodeSmd,
  clockRemaining,
  switchClock,
  type ClockState,
} from '@/lib/practical-resistor';
import { PracticalFrame, PracticalText } from './practical-ui';
import { ChoiceField, NumberField } from './calculator-ui';
import { Button } from './ui/button';
export function ResistorCode() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    count: number;
    mode: string;
    bands: string[];
  }>({ count: NumberParam, mode: StringParam, bands: ArrayParam });
  const count = [4, 5, 6].includes(query.count ?? 4) ? (query.count ?? 4) : 4,
    mode = query.mode ?? 'bands';
  const [ohms, setOhms] = useState('1000'),
    [smd, setSmd] = useState('102');
  const digits = count === 4 ? 2 : 3;
  let bands =
    query.bands?.length === count
      ? query.bands.map(Number)
      : count === 4
        ? [1, 0, 2, 10]
        : [1, 0, 0, 1, 10, ...(count === 6 ? [1] : [])];
  let output = '',
    error: string | null = null;
  try {
    if (mode === 'reverse') bands = encodeBands(Number(ohms), count);
    if (mode === 'smd') output = `${decodeSmd(smd)} Ω`;
    else {
      const result = decodeBands(bands);
      output = `${Number(result.value.toPrecision(10))} Ω ±${result.tolerance}%${result.temperature === null ? '' : ` · ${result.temperature} ppm/K`}`;
    }
  } catch (cause) {
    error = t(`studio20.${(cause as Error).message}`);
  }
  return (
    <PracticalFrame id="resistor-code" error={error}>
      <div className="grid gap-3 md:grid-cols-3">
        <ChoiceField
          label={t('studio20.mode')}
          value={mode}
          options={['bands', 'reverse', 'smd'].map((value) => ({
            value,
            label: t(`studio20.${value}`),
          }))}
          onChange={(mode) => setQuery({ mode })}
        />
        <ChoiceField
          label={t('studio20.bands')}
          value={String(count)}
          options={[4, 5, 6].map((n) => ({
            value: String(n),
            label: String(n),
          }))}
          onChange={(count) =>
            setQuery({ count: Number(count), bands: undefined })
          }
        />
        {mode === 'reverse' ? (
          <PracticalText
            label={t('studio20.ohms')}
            value={ohms}
            onChange={setOhms}
          />
        ) : mode === 'smd' ? (
          <PracticalText
            label={t('studio20.smd')}
            value={smd}
            onChange={setSmd}
          />
        ) : null}
      </div>
      {mode === 'bands' && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {bands.map((value, i) => (
            <ChoiceField
              key={i}
              label={`${t('studio20.band')} ${i + 1}`}
              value={String(value)}
              options={RESISTOR_COLORS.flatMap(([name], n) =>
                (
                  i < digits
                    ? n < 10 && (i !== 0 || n !== 0)
                    : i === digits
                      ? true
                      : i === digits + 1
                        ? TOLERANCE[n] !== undefined
                        : TEMPERATURE[n] !== undefined
                )
                  ? [{ value: String(n), label: t(`studio20.colors.${name}`) }]
                  : [],
              )}
              onChange={(value) =>
                setQuery({
                  bands: bands.map((n, j) =>
                    String(j === i ? Number(value) : n),
                  ),
                })
              }
            />
          ))}
        </div>
      )}
      {mode !== 'smd' && !error && (
        <svg
          viewBox="0 0 400 100"
          className="mx-auto w-full max-w-xl"
          role="img"
          aria-label={output}
        >
          <path d="M0 50H400" stroke="#9ca3af" strokeWidth="5" />
          <rect
            x="70"
            y="15"
            width="260"
            height="70"
            rx="20"
            fill="#fde68a"
            stroke="#92400e"
          />
          {bands.map((n, i) => (
            <rect
              key={i}
              x={95 + i * 34}
              y="16"
              width="18"
              height="68"
              fill={RESISTOR_COLORS[n]?.[1]}
            />
          ))}
        </svg>
      )}
      <output className="block text-center font-mono text-2xl">{output}</output>
    </PracticalFrame>
  );
}
export function ChessClock() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    minutes: number;
    increment: number;
    delay: number;
  }>({ minutes: NumberParam, increment: NumberParam, delay: NumberParam });
  const minutes = query.minutes ?? 5,
    increment = query.increment ?? 0,
    delay = query.delay ?? 0;
  const valid =
    Number.isFinite(minutes) &&
    minutes >= 0.1 &&
    minutes <= 180 &&
    Number.isFinite(increment) &&
    increment >= 0 &&
    increment <= 600 &&
    Number.isFinite(delay) &&
    delay >= 0 &&
    delay <= 600;
  const initial = (): ClockState => ({
    remaining: [minutes * 60000, minutes * 60000],
    active: 0,
    running: false,
    started: 0,
    delayLeft: delay * 1000,
    moves: [0, 0],
  });
  const [state, setState] = useState<ClockState>(initial),
    [now, setNow] = useState(0);
  const current = useRef(state);
  current.current = state;
  useEffect(() => {
    setState({
      remaining: [minutes * 60000, minutes * 60000],
      active: 0,
      running: false,
      started: 0,
      delayLeft: delay * 1000,
      moves: [0, 0],
    });
  }, [minutes, increment, delay]);
  useEffect(() => {
    if (!state.running) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (clockRemaining(current.current, time)[current.current.active] === 0)
        setState((old) => ({
          ...old,
          remaining: clockRemaining(old, time),
          running: false,
        }));
    }, 50);
    return () => clearInterval(timer);
  }, [state.running]);
  const switchTurn = () => {
    const time = Date.now();
    setNow(time);
    setState((old) => switchClock(old, time, increment * 1000, delay * 1000));
  };
  const switchRef = useRef(switchTurn);
  switchRef.current = switchTurn;
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.code === 'Space' &&
        !event.repeat &&
        !(
          event.target instanceof HTMLElement &&
          event.target.closest('input,textarea,select,button,[role="combobox"]')
        )
      ) {
        event.preventDefault();
        switchRef.current();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const remaining = clockRemaining(state, Math.max(now, state.started));
  const format = (ms: number) =>
    `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
  return (
    <PracticalFrame
      id="chess-clock"
      error={!valid ? t('studio20.invalid') : null}
    >
      <div className="grid gap-3 md:grid-cols-3">
        {(['minutes', 'increment', 'delay'] as const).map((key) => (
          <NumberField
            key={key}
            label={t(`studio20.${key}`)}
            value={
              key === 'minutes'
                ? minutes
                : key === 'increment'
                  ? increment
                  : delay
            }
            min={key === 'minutes' ? 0.1 : 0}
            max={key === 'minutes' ? 180 : 600}
            onChange={(value) => setQuery({ [key]: value })}
          />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {remaining.map((value, i) => (
          <Button
            key={i}
            className={`h-48 flex-col gap-4 ${state.active === i ? '' : 'opacity-60'}`}
            variant={state.active === i ? 'default' : 'outline'}
            disabled={!valid || !state.running || state.active !== i}
            onClick={switchTurn}
          >
            <span>
              {t(`studio20.player${i + 1}`)} · {t('studio20.moves')}:{' '}
              {state.moves[i]}
            </span>
            <span className="font-mono text-5xl">
              {format(Math.max(0, value))}
            </span>
            {value === 0 && <span>{t('studio20.flag')}</span>}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          disabled={!valid || remaining.includes(0)}
          onClick={() => {
            const time = Date.now();
            setNow(time);
            setState((old) =>
              old.running
                ? {
                    ...old,
                    remaining: clockRemaining(old, time),
                    delayLeft: Math.max(
                      0,
                      old.delayLeft - (time - old.started),
                    ),
                    running: false,
                  }
                : { ...old, started: time, running: true },
            );
          }}
        >
          {t(`studio20.${state.running ? 'pause' : 'start'}`)}
        </Button>
        <Button variant="outline" onClick={() => setState(initial())}>
          {t('studio20.reset')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t('studio20.clockHint')}</p>
    </PracticalFrame>
  );
}
