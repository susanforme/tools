import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { boundedNumber } from '@/lib/focus-tools';
import { cn } from '@/lib/utils';
import { createFileRoute } from '@tanstack/react-router';
import { Maximize, Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/teleprompter')({
  component: TeleprompterPage,
});
const FONT_SIZES = [
  'text-2xl',
  'text-[32px]',
  'text-[40px]',
  'text-5xl',
  'text-[64px]',
  'text-[80px]',
] as const;
const FONT_LABELS = [24, 32, 40, 48, 64, 80];
const PARAMS = { speed: NumberParam, font: NumberParam, mirror: StringParam };

function TeleprompterPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    speed: number;
    font: number;
    mirror: string;
  }>(PARAMS);
  const speed = boundedNumber(query.speed, 40, 5, 150);
  const font = Math.round(boundedNumber(query.font, 3, 0, 5));
  const mirrored = query.mirror === '1';
  const [script, setScript] = useState('');
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fullscreenChanged = () =>
      setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', fullscreenChanged);
    return () =>
      document.removeEventListener('fullscreenchange', fullscreenChanged);
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const element = event.target;
      if (
        element instanceof HTMLElement &&
        (element.closest(
          'input, textarea, button, [role="slider"], [role="checkbox"], [role="combobox"]',
        ) ||
          element.isContentEditable)
      )
        return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (script.trim()) setPlaying((value) => !value);
      }
      if (event.code === 'Home') {
        event.preventDefault();
        setPlaying(false);
        scrollRef.current?.scrollTo({ top: 0 });
      }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [script]);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!playing || !viewport) return;
    let frame = 0;
    let previous = 0;
    let offset = viewport.scrollTop;
    const tick = (now: number) => {
      if (previous) offset += speed * Math.min((now - previous) / 1000, 0.1);
      previous = now;
      viewport.scrollTop = offset;
      if (
        viewport.scrollTop >=
        viewport.scrollHeight - viewport.clientHeight - 1
      ) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, font, script]);

  const toggleFullscreen = async () => {
    setError(null);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (stageRef.current?.requestFullscreen)
        await stageRef.current.requestFullscreen();
      else setError(t('focusTools.fullscreenUnavailable'));
    } catch (cause) {
      setError(
        t('focusTools.operationFailed', { message: (cause as Error).message }),
      );
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('teleprompter.title')}</h1>
      <div className="space-y-2">
        <Label htmlFor="prompt-script">{t('teleprompter.script')}</Label>
        <Textarea
          id="prompt-script"
          value={script}
          onChange={(event) => {
            setPlaying(false);
            setScript(event.target.value);
            scrollRef.current?.scrollTo({ top: 0 });
          }}
          placeholder={t('teleprompter.placeholder')}
          className="min-h-36"
        />
      </div>
      <div
        ref={stageRef}
        className="flex flex-col gap-4 rounded-xl border bg-background p-4 [&:fullscreen]:h-dvh [&:fullscreen]:rounded-none [&:fullscreen]:p-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={!script.trim()}
            onClick={() => {
              if (
                !playing &&
                scrollRef.current &&
                scrollRef.current.scrollTop >=
                  scrollRef.current.scrollHeight -
                    scrollRef.current.clientHeight -
                    1
              )
                scrollRef.current.scrollTop = 0;
              setPlaying(!playing);
            }}
          >
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {t(playing ? 'focusTools.pause' : 'focusTools.start')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setPlaying(false);
              scrollRef.current?.scrollTo({ top: 0 });
            }}
          >
            <RotateCcw className="h-4 w-4" />
            {t('focusTools.reset')}
          </Button>
          <Button variant="outline" onClick={() => void toggleFullscreen()}>
            <Maximize className="h-4 w-4" />
            {t(
              fullscreen
                ? 'focusTools.exitFullscreen'
                : 'focusTools.fullscreen',
            )}
          </Button>
          <div className="flex items-center gap-2">
            <Checkbox
              id="prompt-mirror"
              checked={mirrored}
              onCheckedChange={(value) =>
                setQuery({ mirror: value === true ? '1' : '0' })
              }
            />
            <Label htmlFor="prompt-mirror">{t('teleprompter.mirror')}</Label>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <Label id="prompt-speed-label">
              {t('teleprompter.speed', { speed })}
            </Label>
            <Input
              type="range"
              className="h-5 cursor-pointer border-0 px-0 accent-primary shadow-none"
              aria-labelledby="prompt-speed-label"
              value={speed}
              min={5}
              max={150}
              step={5}
              onChange={(event) =>
                setQuery({ speed: Number(event.target.value) })
              }
            />
          </div>
          <div className="space-y-3">
            <Label id="prompt-font-label">
              {t('teleprompter.font', { font: FONT_LABELS[font] })}
            </Label>
            <Input
              type="range"
              className="h-5 cursor-pointer border-0 px-0 accent-primary shadow-none"
              aria-labelledby="prompt-font-label"
              value={font}
              min={0}
              max={5}
              step={1}
              onChange={(event) =>
                setQuery({ font: Number(event.target.value) })
              }
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('teleprompter.shortcuts')}
        </p>
        <div
          className={cn(
            'relative min-h-0 overflow-hidden rounded-lg bg-black text-white',
            fullscreen ? 'flex-1' : 'h-[55vh]',
          )}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-1/3 z-10 border-t border-white/25"
          />
          <div
            ref={scrollRef}
            tabIndex={0}
            role="region"
            aria-label={t('teleprompter.preview')}
            onWheel={() => setPlaying(false)}
            onTouchStart={() => setPlaying(false)}
            className="h-full overflow-y-auto overscroll-contain px-6 md:px-14"
          >
            <div
              className={cn(
                'whitespace-pre-wrap break-words py-[25vh] leading-relaxed',
                FONT_SIZES[font],
                mirrored && '-scale-x-100',
              )}
            >
              {script || t('teleprompter.placeholder')}
            </div>
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
