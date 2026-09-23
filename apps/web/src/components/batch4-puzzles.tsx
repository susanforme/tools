import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  type PuzzlePage,
  type PuzzleRequest,
  type PuzzleMode,
} from '@/lib/batch4-puzzles';
import {
  printLines,
  sheetImages,
  studySheet,
  type StudySheet,
} from '@/lib/study-print';
import { ChoiceField, NumberField } from './calculator-ui';
import { PracticalPuzzles } from './practical-puzzles';
import { PracticalText } from './practical-ui';
import { StudyPreview } from './study-tools-ui';
import { Button } from './ui/button';
const createWorker = () =>
  new Worker(new URL('../workers/batch4-puzzles.worker.ts', import.meta.url), {
    type: 'module',
  });
function drawGrid(
  ctx: CanvasRenderingContext2D,
  page: PuzzlePage,
  answer: boolean,
) {
  const n = page.size,
    cell = 140 / n,
    left = page.mode === 'nonogram' ? 50 : 35,
    top = page.mode === 'nonogram' ? 65 : 35;
  const path = new Set(page.path);
  const starts = new Map(
    page.clues.map((c) => [c.row * n + c.column, c.number]),
  );
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  page.grid.forEach((value, i) => {
    const x = left + (i % n) * cell,
      y = top + Math.floor(i / n) * cell;
    ctx.fillStyle =
      page.mode === 'maze'
        ? value === '#'
          ? '#111827'
          : answer && path.has(i)
            ? '#93c5fd'
            : '#fff'
        : page.mode === 'crossword'
          ? value
            ? '#fff'
            : '#111827'
          : answer && value === '1'
            ? '#111827'
            : '#fff';
    ctx.fillRect(x, y, cell, cell);
    if (page.mode !== 'maze') {
      ctx.lineWidth = 0.15;
      ctx.strokeStyle = '#9ca3af';
      ctx.strokeRect(x, y, cell, cell);
    }
    if (page.mode === 'crossword' && value) {
      ctx.fillStyle = '#111827';
      if (starts.has(i)) {
        ctx.font = `${cell * 0.23}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(String(starts.get(i)), x + 0.3, y + 0.2);
      }
      if (answer) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${cell * 0.6}px sans-serif`;
        ctx.fillText(value, x + cell / 2, y + cell * 0.6);
      }
    }
  });
  if (page.mode === 'nonogram') {
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.min(4, cell * 0.4)}px sans-serif`;
    page.rows.forEach((clues, y) =>
      ctx.fillText(clues.join(' ') || '0', left - 2, top + (y + 0.5) * cell),
    );
    ctx.textAlign = 'center';
    page.columns.forEach((clues, x) => {
      const values = clues.length ? clues : [0];
      values.forEach((value, i) =>
        ctx.fillText(
          String(value),
          left + (x + 0.5) * cell,
          top - 3 - (values.length - 1 - i) * 5,
        ),
      );
    });
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}
export function PuzzleBook() {
  const { t } = useTranslation();
  const [q, setQ] = useQueryParams<{
    puzzle: string;
    difficulty: string;
    seed: number;
    count: number;
    answer: number;
  }>({
    puzzle: StringParam,
    difficulty: StringParam,
    seed: NumberParam,
    count: NumberParam,
    answer: NumberParam,
  });
  const mode = ['maze', 'crossword', 'nonogram'].includes(q.puzzle ?? '')
    ? (q.puzzle as PuzzleMode)
    : 'wordSearch';
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-5">
        <ChoiceField
          label={t('batch4Science.puzzleMode')}
          value={mode}
          options={['wordSearch', 'maze', 'crossword', 'nonogram'].map(
            (value) => ({ value, label: t(`batch4Science.${value}`) }),
          )}
          onChange={(puzzle) => setQ({ puzzle })}
        />
      </div>
      {mode === 'wordSearch' ? (
        <PracticalPuzzles kind="word-search" />
      ) : (
        <PuzzleGenerator
          key={mode}
          mode={mode}
          difficulty={q.difficulty ?? 'easy'}
          seed={q.seed ?? 42}
          count={q.count ?? 1}
          answer={q.answer === 1}
          onChange={setQ}
        />
      )}
    </>
  );
}
function PuzzleGenerator({
  mode,
  difficulty,
  seed,
  count,
  answer,
  onChange,
}: {
  mode: PuzzleMode;
  difficulty: string;
  seed: number;
  count: number;
  answer: boolean;
  onChange: (value: {
    difficulty?: string;
    seed?: number;
    count?: number;
    answer?: number;
  }) => void;
}) {
  const { t } = useTranslation();
  const [words, setWords] = useState(
    'REACT | A UI library\nCANVAS | A drawing surface\nBROWSER | An app for websites\nSCRIPT | A computer program\nARRAY | An ordered collection\nSTATE | Current application data',
  );
  const [page, setPage] = useState(0);
  const [booklet, setBooklet] = useState<{
    images: string[];
    name: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const worker = useBoundedWorker<PuzzleRequest, PuzzlePage[]>(
    createWorker,
    25000,
  );
  useEffect(() => {
    worker.clear();
    setPage(0);
    setBooklet(null);
    setError(null);
  }, [mode, difficulty, seed, count, words, worker.clear]);
  const result = worker.result?.[page];
  const images = useMemo(() => {
    if (!result) return [];
    const sheet = studySheet();
    drawGrid(sheet.context, result, answer);
    return sheetImages([sheet]);
  }, [result, answer]);
  const print = (solutions: boolean) => {
    try {
      if (!worker.result) return;
      const sheets: StudySheet[] = [];
      for (let i = 0; i < worker.result.length; i++) {
        const puzzle = worker.result[i];
        let sheet = studySheet();
        sheets.push(sheet);
        sheet.context.font = '6px sans-serif';
        sheet.context.fillText(
          `${t(`batch4Science.${mode}`)} · ${t('batch4Science.puzzleNumber', { number: i + 1 })}`,
          15,
          15,
        );
        drawGrid(sheet.context, puzzle, solutions);
        let y = mode === 'nonogram' ? 220 : 185;
        if (mode === 'crossword')
          for (const direction of ['across', 'down'] as const) {
            const lines = [
              t(`batch4Science.${direction}`),
              ...puzzle.clues
                .filter((c) => c.direction === direction)
                .map(
                  (c) =>
                    `${c.number}. ${c.clue}${solutions ? ` — ${c.word}` : ''}`,
                ),
            ];
            for (const line of lines)
              for (const part of printLines(sheet.context, line, 178, 3.5)) {
                if (y > 278) {
                  sheet = studySheet();
                  sheets.push(sheet);
                  y = 18;
                }
                sheet.context.font = '3.5px sans-serif';
                sheet.context.fillText(part, 16, y);
                y += 5.5;
              }
          }
        if (sheets.length > 100) throw new Error('puzzleInvalid');
      }
      setBooklet({
        images: sheetImages(sheets),
        name: `${mode}-${solutions ? 'answers' : 'questions'}.pdf`,
      });
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t(`batch4Science.${mode}`)}</h1>
      <div className="grid gap-3 md:grid-cols-3">
        <ChoiceField
          label={t('batch4Science.difficulty')}
          value={difficulty}
          options={['easy', 'medium', 'hard'].map((value) => ({
            value,
            label: t(`batch4Science.${value}`),
          }))}
          onChange={(difficulty) => onChange({ difficulty })}
        />
        <NumberField
          label={t('batch4Science.seed')}
          value={seed}
          min={0}
          max={4294967295}
          step={1}
          onChange={(seed) => onChange({ seed })}
        />
        <NumberField
          label={t('batch4Science.count')}
          value={count}
          min={1}
          max={12}
          step={1}
          onChange={(count) => onChange({ count })}
        />
      </div>
      {mode === 'crossword' && (
        <>
          <PracticalText
            multiline
            label={t('batch4Science.words')}
            value={words}
            onChange={setWords}
            maxLength={10000}
          />
          <p className="text-sm text-muted-foreground">
            {t('batch4Science.crosswordHint')}
          </p>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={worker.busy}
          onClick={() => worker.run({ mode, difficulty, seed, count, words })}
        >
          {t('batch4Science.generate')}
        </Button>
        {worker.busy && (
          <Button variant="outline" onClick={worker.cancel}>
            {t('batch4Science.cancel')}
          </Button>
        )}
      </div>
      {(worker.error || error) && (
        <p role="alert" className="text-destructive">
          {t(
            `batch4Science.${['generationFailed', 'TIMEOUT', 'CANCELLED', 'WORKER_ERROR'].includes(worker.error ?? '') ? worker.error : 'puzzleInvalid'}`,
          )}
        </p>
      )}
      {result && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => onChange({ answer: answer ? 0 : 1 })}
            >
              {t('batch4Science.showAnswer')}
            </Button>
            <Button variant="outline" onClick={() => print(false)}>
              {t('batch4Science.questions')}
            </Button>
            <Button variant="outline" onClick={() => print(true)}>
              {t('batch4Science.answers')}
            </Button>
            <ChoiceField
              label={t('batch4Science.puzzleMode')}
              value={String(page)}
              options={worker.result!.map((_, i) => ({
                value: String(i),
                label: t('batch4Science.puzzleNumber', { number: i + 1 }),
              }))}
              onChange={(v) => setPage(+v)}
            />
          </div>
          <img
            src={images[0]}
            alt={t(`batch4Science.${mode}`)}
            className="mx-auto w-full max-w-xl border"
          />
          {result.unplaced.length > 0 && (
            <p>
              {t('batch4Science.unplaced', {
                words: result.unplaced.join(', '),
              })}
            </p>
          )}
          {mode === 'crossword' && (
            <div className="grid gap-3 md:grid-cols-2">
              {(['across', 'down'] as const).map((direction) => (
                <section key={direction}>
                  <h2 className="font-semibold">
                    {t(`batch4Science.${direction}`)}
                  </h2>
                  <ul>
                    {result.clues
                      .filter((c) => c.direction === direction)
                      .map((c) => (
                        <li key={c.number}>
                          {c.number}. {c.clue}
                          {answer && ` — ${c.word}`}
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
      {booklet && (
        <StudyPreview
          key={booklet.name + booklet.images.length}
          images={booklet.images}
          filename={booklet.name}
        />
      )}
    </div>
  );
}
