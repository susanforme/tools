import { ChoiceField } from '@/components/calculator-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  StringParam,
  useQueryParams,
  withDefault,
} from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Maximize } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/screen-test')({
  component: ScreenTestPage,
});
const PATTERNS = [
  'black',
  'white',
  'red',
  'green',
  'blue',
  'gray',
  'grayscale',
  'gradient',
  'custom',
] as const;
const COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#00ff00',
  blue: '#0000ff',
  gray: '#808080',
};

function ScreenTestPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{ pattern: string; color: string }>({
    pattern: withDefault<string>(StringParam, 'black'),
    color: withDefault<string>(StringParam, '#808080'),
  });
  const pattern = PATTERNS.includes(query.pattern as (typeof PATTERNS)[number])
    ? (query.pattern ?? 'black')
    : 'black';
  const color = /^#[\da-f]{6}$/i.test(query.color ?? '')
    ? query.color!
    : '#808080';
  const target = useRef<HTMLDivElement>(null);
  const gradientId = useId();
  const [full, setFull] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = (direction: number) =>
    setQuery({
      pattern:
        PATTERNS[
          (PATTERNS.indexOf(pattern as (typeof PATTERNS)[number]) +
            direction +
            PATTERNS.length) %
            PATTERNS.length
        ],
    });
  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement === target.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const enter = async () => {
    setError(null);
    try {
      if (!target.current?.requestFullscreen)
        throw new Error(t('screenTest.unsupported'));
      await target.current.requestFullscreen();
      target.current.focus();
    } catch (cause) {
      setError(t('screenTest.error', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('screenTest.title')}</h1>
      <div className="flex flex-wrap items-end gap-3">
        <ChoiceField
          label={t('screenTest.pattern')}
          value={pattern}
          onChange={(value) => setQuery({ pattern: value })}
          options={PATTERNS.map((value) => ({
            value,
            label: t(`screenTest.${value}`),
          }))}
        />
        <div className="space-y-1.5">
          <Label htmlFor="test-color">{t('screenTest.custom')}</Label>
          <Input
            id="test-color"
            type="color"
            value={color}
            className="w-20"
            onChange={(event) =>
              setQuery({ color: event.target.value, pattern: 'custom' })
            }
          />
        </div>
        <Button
          variant="outline"
          onClick={() => next(-1)}
          aria-label={t('screenTest.previous')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={() => next(1)}
          aria-label={t('screenTest.next')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button onClick={() => void enter()}>
          <Maximize className="h-4 w-4" />
          {t('screenTest.fullscreen')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('screenTest.controls')}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div
        ref={target}
        role="button"
        tabIndex={0}
        aria-label={t('screenTest.preview')}
        className={`overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring ${full ? 'h-screen w-screen cursor-none' : 'h-[55vh] rounded-lg border cursor-pointer'}`}
        onClick={() => next(1)}
        onKeyDown={(event) => {
          if (['ArrowRight', 'ArrowDown', ' ', 'Enter'].includes(event.key)) {
            event.preventDefault();
            next(1);
          }
          if (['ArrowLeft', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            next(-1);
          }
        }}
      >
        <svg
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          viewBox="0 0 1000 500"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId}>
              <stop offset="0%" stopColor="#000000" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
          </defs>
          {pattern === 'grayscale' ? (
            Array.from({ length: 16 }, (_, i) => (
              <rect
                key={i}
                x={i * 62.5}
                width={62.5}
                height={500}
                fill={`rgb(${i * 17},${i * 17},${i * 17})`}
              />
            ))
          ) : (
            <rect
              width={1000}
              height={500}
              fill={
                pattern === 'gradient'
                  ? `url(#${gradientId})`
                  : pattern === 'custom'
                    ? color
                    : COLORS[pattern]
              }
            />
          )}
        </svg>
      </div>
    </div>
  );
}
