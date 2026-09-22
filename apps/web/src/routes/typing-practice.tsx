import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { TYPING_PRESETS, typingStats } from '@/lib/typing-practice';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/typing-practice')({
  component: TypingPracticePage,
});
type Score = { date: string; cpm: number; accuracy: number; seconds: number };
const STORAGE_KEY = 'tools-typing-scores';
function TypingPracticePage() {
  const { t } = useTranslation();
  const [queryMode, setMode] = useQueryParam<string>('mode', StringParam, 'zh');
  const mode = ['zh', 'en', 'custom'].includes(queryMode) ? queryMode : 'zh';
  const [custom, setCustom] = useState('');
  const [retry, setRetry] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [committed, setCommitted] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [scores, setScores] = useState<Score[]>([]);
  const [error, setError] = useState<string | null>(null);
  const started = useRef<number | null>(null);
  const composing = useRef(false);
  const saved = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const target =
    retry ??
    (mode === 'custom' ? custom.trim() : TYPING_PRESETS[mode as 'zh' | 'en']);
  const stats = typingStats(target, committed, elapsed);
  const expectedChars = Array.from(target.normalize('NFC'));
  const actualChars = Array.from(committed.normalize('NFC'));
  const reset = () => {
    started.current = null;
    saved.current = false;
    composing.current = false;
    setInput('');
    setCommitted('');
    setElapsed(0);
    setDone(false);
  };
  useEffect(() => {
    reset();
    setRetry(null);
  }, [mode]);
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? '[]',
      );
      if (Array.isArray(stored))
        setScores(
          stored
            .filter(
              (v: unknown): v is Score =>
                typeof v === 'object' &&
                v !== null &&
                'date' in v &&
                typeof v.date === 'string' &&
                'cpm' in v &&
                typeof v.cpm === 'number' &&
                'accuracy' in v &&
                typeof v.accuracy === 'number' &&
                'seconds' in v &&
                typeof v.seconds === 'number',
            )
            .slice(0, 20),
        );
    } catch {
      setError(t('typingPractice.storageError'));
    }
  }, [t]);
  useEffect(() => {
    if (done) return;
    const timer = window.setInterval(() => {
      if (started.current !== null)
        setElapsed(performance.now() - started.current);
    }, 100);
    return () => window.clearInterval(timer);
  }, [done]);
  function begin() {
    if (started.current === null && target) started.current = performance.now();
  }
  function commit(value: string) {
    if (saved.current) return;
    begin();
    setCommitted(value);
    const duration =
      started.current === null ? 0 : performance.now() - started.current;
    if (!typingStats(target, value, duration).complete) return;
    saved.current = true;
    setElapsed(duration);
    setDone(true);
    const result = typingStats(target, value, duration);
    const next = [
      {
        date: new Date().toISOString(),
        cpm: result.cpm,
        accuracy: result.accuracy,
        seconds: duration / 1000,
      },
      ...scores,
    ].slice(0, 20);
    setScores(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setError(t('typingPractice.storageError'));
    }
  }
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('typingPractice.title')}</h1>
      <div className="flex flex-wrap gap-2">
        <Select value={mode} onValueChange={(v) => setMode(v)}>
          <SelectTrigger className="w-44" aria-label={t('typingPractice.mode')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['zh', 'en', 'custom'].map((v) => (
              <SelectItem key={v} value={v}>
                {t(`typingPractice.${v}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => {
            reset();
            setRetry(null);
            textarea.current?.focus();
          }}
        >
          {t('typingPractice.restart')}
        </Button>
        <Button
          variant="outline"
          disabled={!done || !stats.mistakes}
          onClick={() => {
            setRetry(stats.mistakes.repeat(3));
            reset();
            textarea.current?.focus();
          }}
        >
          {t('typingPractice.retry')}
        </Button>
      </div>
      {mode === 'custom' && !retry && (
        <div className="space-y-2">
          <Label htmlFor="typing-custom">
            {t('typingPractice.customText')}
          </Label>
          <Textarea
            id="typing-custom"
            value={custom}
            maxLength={5000}
            disabled={started.current !== null && !done}
            onChange={(e) => {
              setCustom(e.target.value);
              reset();
            }}
          />
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border p-3">
          <p className="text-sm text-muted-foreground">
            {t('typingPractice.time')}
          </p>
          <strong>{(elapsed / 1000).toFixed(1)} s</strong>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-sm text-muted-foreground">
            {t('typingPractice.speed')}
          </p>
          <strong>{Math.round(stats.cpm)}</strong>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-sm text-muted-foreground">
            {t('typingPractice.accuracy')}
          </p>
          <strong>{stats.accuracy.toFixed(1)}%</strong>
        </div>
      </div>
      <div
        className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-4 text-lg leading-loose"
        aria-label={t('typingPractice.reference')}
      >
        {expectedChars.map((char, i) => (
          <span
            key={i}
            className={
              i < actualChars.length
                ? actualChars[i] === char
                  ? 'bg-primary/10 text-primary'
                  : 'bg-destructive/20 text-destructive underline'
                : i === actualChars.length
                  ? 'border-b-2 border-primary'
                  : ''
            }
          >
            {char}
          </span>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="typing-input">
          {done ? t('typingPractice.completed') : t('typingPractice.input')}
        </Label>
        <Textarea
          ref={textarea}
          id="typing-input"
          value={input}
          disabled={!target || done}
          spellCheck={false}
          autoComplete="off"
          className="min-h-32"
          onPaste={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          onCompositionStart={() => {
            composing.current = true;
            begin();
          }}
          onCompositionEnd={(e) => {
            composing.current = false;
            commit(e.currentTarget.value);
          }}
          onChange={(e) => {
            setInput(e.target.value);
            if (!composing.current) commit(e.target.value);
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('typingPractice.history')}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              try {
                localStorage.removeItem(STORAGE_KEY);
                setScores([]);
              } catch {
                setError(t('typingPractice.storageError'));
              }
            }}
          >
            {t('typingPractice.clearHistory')}
          </Button>
        </div>
        {scores.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('typingPractice.noHistory')}
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {scores.map((score, i) => (
              <li
                key={`${score.date}-${i}`}
                className="flex flex-wrap justify-between gap-2 rounded border px-3 py-2"
              >
                <span>{new Date(score.date).toLocaleString()}</span>
                <span>
                  {Math.round(score.cpm)} {t('typingPractice.speed')} ·{' '}
                  {score.accuracy.toFixed(1)}% · {score.seconds.toFixed(1)} s
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
