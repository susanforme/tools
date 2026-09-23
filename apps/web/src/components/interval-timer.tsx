import { Metric, NumberField } from './calculator-ui';
import { PracticalText } from './practical-ui';
import { Button } from './ui/button';
import {
  ArrayParam,
  NumberParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { intervalPosition, type IntervalStage } from '@/lib/electrical-baking';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
export function IntervalTimer({
  onStart,
  onComplete,
}: {
  onStart: () => void;
  onComplete: (name: string) => void;
}) {
  const { t } = useTranslation();
  const label = (key: string) => t(`batch3Calc.${key}`);
  const [q, set] = useQueryParams<{
    stageNames: string[];
    stageSeconds: string[];
    rounds: number;
  }>({ stageNames: ArrayParam, stageSeconds: ArrayParam, rounds: NumberParam });
  const stages: IntervalStage[] = (q.stageSeconds ?? ['20', '10']).map(
    (seconds, i) => ({
      seconds: Number(seconds),
      name:
        q.stageNames?.[i] ?? t(i === 0 ? 'batch3Calc.work' : 'batch3Calc.rest'),
    }),
  );
  const rounds = q.rounds ?? 8;
  const [running, setRunning] = useState(false),
    [elapsed, setElapsed] = useState(0);
  const baseline = useRef(0),
    saved = useRef(0),
    lastSignal = useRef('');
  const config = JSON.stringify({ stages, rounds });
  const configRef = useRef(config);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  let position: ReturnType<typeof intervalPosition> | null = null;
  try {
    position = intervalPosition(stages, rounds, elapsed);
  } catch {
    /* 输入错误在下方显示 */
  }
  useEffect(() => {
    if (configRef.current !== config) {
      configRef.current = config;
      setRunning(false);
      setElapsed(0);
      saved.current = 0;
      lastSignal.current = '';
    }
  }, [config]);
  useEffect(() => {
    if (!running) return;
    const snapshot = JSON.parse(config) as {
      stages: IntervalStage[];
      rounds: number;
    };
    const tick = () => {
      const next = saved.current + (Date.now() - baseline.current) / 1000;
      const current = intervalPosition(
        snapshot.stages,
        snapshot.rounds,
        Math.max(0, next),
      );
      setElapsed(Math.min(next, current.total));
      const signal = current.done
        ? 'done'
        : `${current.round}:${current.index}`;
      if (lastSignal.current && lastSignal.current !== signal)
        completeRef.current(
          current.done
            ? t('batch3Calc.done')
            : snapshot.stages[current.index].name,
        );
      lastSignal.current = signal;
      if (current.done) {
        saved.current = current.total;
        setRunning(false);
      }
    };
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [running, config, t]);
  const update = (next: IntervalStage[]) =>
    set({
      stageNames: next.map((s) => s.name),
      stageSeconds: next.map((s) => String(s.seconds)),
    });
  const reset = () => {
    setRunning(false);
    setElapsed(0);
    saved.current = 0;
    lastSignal.current = '';
  };
  return (
    <div className="space-y-4">
      <fieldset disabled={running} className="space-y-3">
        <Button
          variant="outline"
          onClick={() => {
            reset();
            set({
              stageNames: [label('work'), label('rest')],
              stageSeconds: ['20', '10'],
              rounds: 8,
            });
          }}
        >
          {label('tabata')}
        </Button>
        <NumberField
          label={label('rounds')}
          value={rounds}
          min={1}
          max={100}
          step={1}
          onChange={(rounds) => set({ rounds })}
        />
        {stages.map((stage, index) => (
          <div
            className="grid gap-3 rounded-lg border p-3 md:grid-cols-3"
            key={index}
          >
            <PracticalText
              label={label('stage')}
              value={stage.name}
              onChange={(name) =>
                update(stages.map((s, i) => (i === index ? { ...s, name } : s)))
              }
            />
            <NumberField
              label={label('seconds')}
              value={stage.seconds}
              min={1}
              max={86400}
              step={1}
              onChange={(seconds) =>
                update(
                  stages.map((s, i) => (i === index ? { ...s, seconds } : s)),
                )
              }
            />
            <Button
              variant="outline"
              className="self-end"
              disabled={stages.length <= 1}
              onClick={() => update(stages.filter((_, i) => i !== index))}
            >
              {label('remove')}
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          disabled={stages.length >= 20}
          onClick={() =>
            update([...stages, { name: label('work'), seconds: 30 }])
          }
        >
          {label('add')}
        </Button>
      </fieldset>
      {!position && (
        <p role="alert" className="text-destructive">
          {label('invalid')}
        </p>
      )}
      {position && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <Metric
              label={
                position.done ? label('done') : stages[position.index].name
              }
              value={`${Math.floor(Math.ceil(position.remaining) / 60)
                .toString()
                .padStart(
                  2,
                  '0',
                )}:${(Math.ceil(position.remaining) % 60).toString().padStart(2, '0')}`}
            />
            <Metric
              label={label('rounds')}
              value={t('batch3Calc.roundProgress', {
                round: position.round,
                total: rounds,
              })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (running) {
                  saved.current += Math.max(
                    0,
                    (Date.now() - baseline.current) / 1000,
                  );
                  setElapsed(saved.current);
                  setRunning(false);
                } else {
                  if (position.done) {
                    saved.current = 0;
                    setElapsed(0);
                    lastSignal.current = '';
                  }
                  onStart();
                  baseline.current = Date.now();
                  setRunning(true);
                }
              }}
            >
              {label(running ? 'pause' : 'start')}
            </Button>
            <Button variant="outline" onClick={reset}>
              {label('reset')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
