import { ChoiceField, NumberField } from '@/components/calculator-ui';
import { StudyPreview } from '@/components/study-tools-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  generateMath,
  mathExpression,
  mathSheets,
  type MathProblem,
} from '@/lib/math-worksheet';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/math-worksheet')({
  component: MathWorksheetPage,
});
function MathWorksheetPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    min: number;
    max: number;
    count: number;
    operation: string;
    carry: string;
    missing: string;
  }>({
    min: NumberParam,
    max: NumberParam,
    count: NumberParam,
    operation: StringParam,
    carry: StringParam,
    missing: StringParam,
  });
  const options = {
    min: query.min ?? 0,
    max: query.max ?? 20,
    count: query.count ?? 20,
    operation: query.operation ?? 'add',
    carry: query.carry ?? 'any',
    missing: query.missing ?? 'answer',
  };
  const [problems, setProblems] = useState<MathProblem[]>([]);
  const [responses, setResponses] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [images, setImages] = useState<{
    exercises: string[];
    answers: string[];
  }>({ exercises: [], answers: [] });
  const [error, setError] = useState<string | null>(null);
  const score = problems.filter(
    (problem, i) =>
      responses[i]?.trim() &&
      Number(responses[i]) ===
        (problem.missing === 'left' ? problem.left : problem.answer),
  ).length;
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('mathWorksheet.title')}</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        {(['min', 'max', 'count'] as const).map((key) => (
          <NumberField
            key={key}
            label={t(`mathWorksheet.${key}`)}
            value={options[key]}
            onChange={(value) => setQuery({ [key]: value })}
            step={1}
          />
        ))}
        <ChoiceField
          label={t('mathWorksheet.operation')}
          value={options.operation}
          options={['add', 'subtract', 'multiply', 'divide', 'mixed'].map(
            (value) => ({ value, label: t(`mathWorksheet.${value}`) }),
          )}
          onChange={(value) => setQuery({ operation: value })}
        />
        <ChoiceField
          label={t('mathWorksheet.carry')}
          value={options.carry}
          options={['any', 'with', 'without'].map((value) => ({
            value,
            label: t(`mathWorksheet.${value}`),
          }))}
          onChange={(value) => setQuery({ carry: value })}
        />
        <ChoiceField
          label={t('mathWorksheet.missing')}
          value={options.missing}
          options={['answer', 'left'].map((value) => ({
            value,
            label: t(`mathWorksheet.${value}`),
          }))}
          onChange={(value) => setQuery({ missing: value })}
        />
      </div>
      <Button
        onClick={() => {
          setError(null);
          try {
            const next = generateMath(options);
            const pages = mathSheets(
              next,
              t('mathWorksheet.exerciseTitle'),
              t('mathWorksheet.answerTitle'),
            );
            setProblems(next);
            setResponses(next.map(() => ''));
            setChecked(false);
            setImages(pages);
          } catch (cause) {
            setError(
              t(`studyCommon.${(cause as Error).message}`, {
                defaultValue: t('studyCommon.generateError'),
              }),
            );
          }
        }}
      >
        {t('mathWorksheet.generate')}
      </Button>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {problems.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {problems.map((problem, i) => {
              const correct =
                responses[i]?.trim() &&
                Number(responses[i]) ===
                  (problem.missing === 'left' ? problem.left : problem.answer);
              return (
                <label
                  key={i}
                  className="flex items-center gap-2 rounded-lg border p-3"
                >
                  <span className="flex-1">
                    {i + 1}. {mathExpression(problem)}
                  </span>
                  <Input
                    type="number"
                    className="w-24"
                    aria-label={t('mathWorksheet.response', { count: i + 1 })}
                    value={responses[i] ?? ''}
                    onChange={(e) => {
                      setResponses((previous) =>
                        previous.map((value, index) =>
                          index === i ? e.target.value : value,
                        ),
                      );
                      setChecked(false);
                    }}
                  />
                  {checked && (
                    <span
                      className={correct ? 'text-primary' : 'text-destructive'}
                    >
                      {correct ? '✓' : '✗'}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <Button onClick={() => setChecked(true)}>
            {t('mathWorksheet.check')}
          </Button>
          {checked && (
            <p role="status">
              {t('mathWorksheet.score', {
                correct: score,
                count: problems.length,
              })}
            </p>
          )}
          <h2 className="font-semibold">{t('mathWorksheet.exerciseTitle')}</h2>
          <StudyPreview
            images={images.exercises}
            filename="math-exercises-A4.pdf"
          />
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer font-semibold">
              {t('mathWorksheet.answerTitle')}
            </summary>
            <StudyPreview
              images={images.answers}
              filename="math-answers-A4.pdf"
            />
          </details>
        </>
      )}
    </div>
  );
}
