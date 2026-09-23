import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import {
  useQueryParams,
  StringParam,
  NumberParam,
} from '@/hooks/useQueryParams';
import {
  sudokuCandidates,
  type PuzzleTask,
  type processPuzzle,
} from '@/lib/practical-puzzles';
import { exportStudyPdf, sheetImages, studySheet } from '@/lib/study-print';
import { ChoiceField, NumberField } from './calculator-ui';
import { PracticalFrame, PracticalText } from './practical-ui';
import { Button } from './ui/button';
const createWorker = () =>
  new Worker(
    new URL('../workers/practical-puzzles.worker.ts', import.meta.url),
    { type: 'module' },
  );
const EMPTY = Array<number>(81).fill(0);
export function PracticalPuzzles({ kind }: { kind: 'sudoku' | 'word-search' }) {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    difficulty: string;
    size: number;
    diagonal: string;
    reverse: string;
  }>({
    difficulty: StringParam,
    size: NumberParam,
    diagonal: StringParam,
    reverse: StringParam,
  });
  const [board, setBoard] = useState(EMPTY),
    [givens, setGivens] = useState(EMPTY),
    [words, setWords] = useState('REACT\nTYPESCRIPT\nBROWSER\nCANVAS'),
    [show, setShow] = useState(false),
    [candidates, setCandidates] = useState(false),
    [error, setError] = useState<string | null>(null);
  const worker = useBoundedWorker<PuzzleTask, ReturnType<typeof processPuzzle>>(
    createWorker,
    20000,
  );
  useEffect(() => {
    worker.clear();
    setShow(false);
  }, [
    words,
    query.difficulty,
    query.size,
    query.diagonal,
    query.reverse,
    worker.clear,
  ]);
  useEffect(() => {
    if (worker.result?.kind === 'sudoku') {
      setBoard(worker.result.board);
      setGivens(worker.result.board);
    }
  }, [worker.result]);
  const result = worker.result;
  const print = async () => {
    try {
      const sheets = [false, true].map((answer) => {
        const sheet = studySheet(),
          ctx = sheet.context;
        ctx.font = '6px sans-serif';
        ctx.fillText(
          t(`studio20.tools.${kind}.title`) +
            ' · ' +
            t(`studio20.${answer ? 'solution' : 'puzzle'}`),
          15,
          15,
        );
        const size = result?.kind === 'words' ? result.size : 9,
          values =
            result?.kind === 'words'
              ? result.grid
              : result?.kind === 'sudoku'
                ? answer
                  ? result.solution
                  : result.board
                : board;
        const marked = new Set(
          result?.kind === 'words' && answer
            ? result.placements.flatMap((p) => p.cells)
            : [],
        );
        const cell = 180 / size;
        values.forEach((value, i) => {
          const x = 15 + (i % size) * cell,
            y = 35 + Math.floor(i / size) * cell;
          if (marked.has(i)) {
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(x, y, cell, cell);
          }
          ctx.strokeStyle = '#9ca3af';
          ctx.lineWidth = 0.2;
          ctx.strokeRect(x, y, cell, cell);
          ctx.fillStyle = '#111827';
          ctx.font = `${cell * 0.55}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(value || ''), x + cell / 2, y + cell / 2);
        });
        if (kind === 'sudoku') {
          ctx.lineWidth = 0.8;
          ctx.strokeStyle = '#111827';
          for (let n = 0; n <= 9; n += 3) {
            ctx.beginPath();
            ctx.moveTo(15 + n * 20, 35);
            ctx.lineTo(15 + n * 20, 215);
            ctx.moveTo(15, 35 + n * 20);
            ctx.lineTo(195, 35 + n * 20);
            ctx.stroke();
          }
        }
        if (result?.kind === 'words') {
          ctx.textAlign = 'left';
          ctx.font = '4px sans-serif';
          result.placements.forEach((p, i) =>
            ctx.fillText(
              p.word,
              15 + (i % 3) * 60,
              225 + Math.floor(i / 3) * 6,
            ),
          );
        }
        return sheet;
      });
      await exportStudyPdf(sheetImages(sheets), `${kind}.pdf`);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  return (
    <PracticalFrame id={kind} error={error || worker.error}>
      <div className="grid gap-3 md:grid-cols-3">
        {kind === 'sudoku' ? (
          <ChoiceField
            label={t('studio20.difficulty')}
            value={query.difficulty ?? 'easy'}
            options={['easy', 'medium', 'hard'].map((value) => ({
              value,
              label: t(`studio20.${value}`),
            }))}
            onChange={(difficulty) => setQuery({ difficulty })}
          />
        ) : (
          <>
            <NumberField
              label={t('studio20.size')}
              value={query.size ?? 15}
              min={5}
              max={30}
              onChange={(size) => setQuery({ size })}
            />
            {(['diagonal', 'reverse'] as const).map((key) => (
              <ChoiceField
                key={key}
                label={t(
                  `studio20.${key === 'reverse' ? 'reverseWords' : key}`,
                )}
                value={query[key] ?? 'yes'}
                options={['yes', 'no'].map((value) => ({
                  value,
                  label: t(`studio20.${value}`),
                }))}
                onChange={(value) => setQuery({ [key]: value })}
              />
            ))}
          </>
        )}
      </div>
      {kind === 'sudoku' && (
        <p className="text-sm text-muted-foreground">
          {t('studio20.sudokuDifficulty')}
        </p>
      )}
      {kind === 'word-search' && (
        <PracticalText
          label={t('studio20.words')}
          value={words}
          onChange={setWords}
          multiline
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={worker.busy}
          onClick={() => {
            setError(null);
            setShow(false);
            worker.run(
              kind === 'sudoku'
                ? { kind: 'generate', difficulty: query.difficulty ?? 'easy' }
                : {
                    kind: 'words',
                    source: words,
                    size: query.size ?? 15,
                    diagonal: query.diagonal !== 'no',
                    reverse: query.reverse !== 'no',
                  },
            );
          }}
        >
          {t('studio20.generate')}
        </Button>
        {worker.busy && (
          <Button variant="outline" onClick={worker.cancel}>
            {t('studio20.cancel')}
          </Button>
        )}
        {kind === 'sudoku' && (
          <>
            <Button
              variant="outline"
              disabled={worker.busy}
              onClick={() => worker.run({ kind: 'solve', board })}
            >
              {t('studio20.solve')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setCandidates(!candidates)}
            >
              {t('studio20.candidates')}
            </Button>
            <Button
              variant="outline"
              disabled={result?.kind !== 'sudoku' || !result.unique}
              onClick={() => {
                if (result?.kind === 'sudoku') {
                  const i = board.findIndex((n, i) => n !== result.solution[i]);
                  if (i >= 0)
                    setBoard(
                      board.map((n, j) => (j === i ? result.solution[i] : n)),
                    );
                }
              }}
            >
              {t('studio20.hint')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setBoard([...EMPTY]);
                setGivens([...EMPTY]);
                worker.clear();
                setShow(false);
              }}
            >
              {t('studio20.clear')}
            </Button>
          </>
        )}
        <Button
          variant="outline"
          disabled={!result}
          onClick={() => setShow(!show)}
        >
          {t('studio20.solution')}
        </Button>
        <Button
          variant="outline"
          disabled={!result}
          onClick={() => void print()}
        >
          {t('studio20.pdf')}
        </Button>
      </div>
      {result?.kind === 'sudoku' && (
        <p role="status">
          {t(`studio20.${result.unique ? 'unique' : 'notUnique'}`)}
        </p>
      )}
      {kind === 'sudoku' ? (
        <div className="grid max-w-lg grid-cols-9 border-2 border-foreground">
          {board.map((n, i) => (
            <div
              key={i}
              className={`relative aspect-square min-w-0 border border-border ${i % 3 === 2 && i % 9 !== 8 ? 'border-r-2 border-r-foreground' : ''} ${Math.floor(i / 9) % 3 === 2 && i < 54 ? 'border-b-2 border-b-foreground' : ''}`}
            >
              <input
                aria-label={`${Math.floor(i / 9) + 1}, ${(i % 9) + 1}`}
                inputMode="numeric"
                maxLength={1}
                className={`h-full w-full bg-transparent text-center text-lg ${givens[i] ? 'font-bold' : 'text-primary'}`}
                value={
                  show && result?.kind === 'sudoku'
                    ? result.solution[i]
                    : n || ''
                }
                readOnly={show || Boolean(givens[i])}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/^[1-9]?$/.test(value))
                    setBoard(
                      board.map((old, j) => (i === j ? Number(value) : old)),
                    );
                }}
              />
              {!n && candidates && !show && (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 text-center text-[8px] text-muted-foreground">
                  {sudokuCandidates(board, i).join('')}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        result?.kind === 'words' && (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="border-collapse text-center">
                <tbody>
                  {Array.from({ length: result.size }, (_, y) => (
                    <tr key={y}>
                      {result.grid
                        .slice(y * result.size, (y + 1) * result.size)
                        .map((letter, x) => (
                          <td
                            key={x}
                            className={`h-8 min-w-8 border font-mono ${show && result.placements.some((p) => p.cells.includes(y * result.size + x)) ? 'bg-yellow-200 text-black' : ''}`}
                          >
                            {letter}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>{result.placements.map((p) => p.word).join(' · ')}</p>
          </div>
        )
      )}
    </PracticalFrame>
  );
}
