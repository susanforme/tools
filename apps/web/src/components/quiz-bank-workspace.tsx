import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  drawQuestions,
  scoreQuestions,
  validQuestions,
  type Question,
} from '@/lib/life-workspace-data';
import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from './organizer-store';
import { ChoiceField } from './calculator-ui';
import { PracticalText } from './practical-ui';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { LifeError, LifePrint } from './life-workspace-ui';
const INITIAL: Question[] = [];
export function ExamBuilderPanel() {
  const { t } = useTranslation();
  const tr = (k: string) => t(`lifeWorkspace.${k}`);
  const store = useOrganizerStore('question-bank-v1', INITIAL, validQuestions);
  const [q, setQ] = useQueryParams<{
    examMode: string;
    category: string;
    count: number;
  }>({ examMode: StringParam, category: StringParam, count: NumberParam });
  const mode = q.examMode === 'paper' ? 'paper' : 'bank',
    category = q.category ?? '',
    count = q.count ?? 10;
  const [draft, setDraft] = useState<Question | null>(null),
    [paper, setPaper] = useState<Question[]>([]),
    [answers, setAnswers] = useState<Record<string, string[]>>({}),
    [score, setScore] = useState<ReturnType<typeof scoreQuestions> | null>(
      null,
    ),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setPaper([]);
    setAnswers({});
    setScore(null);
  }, [store.data, category, count]);
  const categories = [
    ...new Set(store.data.map((x) => x.category).filter(Boolean)),
  ];
  const text = (s: string) =>
    s === 'true' ? tr('true') : s === 'false' ? tr('false') : s;
  return (
    <OrganizerFrame title={tr('exam.title')} store={store}>
      <ChoiceField
        label={tr('mode')}
        value={mode}
        options={['bank', 'paper'].map((value) => ({
          value,
          label: tr(`exam.${value}`),
        }))}
        onChange={(examMode) => setQ({ examMode })}
      />
      <p className="text-sm text-muted-foreground">{tr('exam.hint')}</p>
      {mode === 'bank' ? (
        <>
          <Button
            disabled={store.data.length >= 500}
            onClick={() =>
              setDraft({
                id: crypto.randomUUID(),
                kind: 'single',
                category: '',
                stem: '',
                options: ['A', 'B'],
                correct: ['A'],
                explanation: '',
                points: 1,
              })
            }
          >
            {tr('add')}
          </Button>
          {draft && (
            <section className="min-w-0 space-y-3 break-words rounded border p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <ChoiceField
                  label={tr('kind')}
                  value={draft.kind}
                  options={['single', 'multiple', 'boolean', 'blank'].map(
                    (value) => ({ value, label: tr(`exam.${value}`) }),
                  )}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      kind: value as Question['kind'],
                      options:
                        value === 'boolean'
                          ? ['true', 'false']
                          : value === 'blank'
                            ? []
                            : ['A', 'B'],
                      correct:
                        value === 'boolean'
                          ? ['true']
                          : value === 'blank'
                            ? []
                            : ['A'],
                    })
                  }
                />
                <OrganizerInput
                  label={tr('category')}
                  value={draft.category}
                  maxLength={100}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                />
                <OrganizerInput
                  label={tr('exam.points')}
                  type="number"
                  min={1}
                  max={1000}
                  value={draft.points}
                  onChange={(e) =>
                    setDraft({ ...draft, points: Number(e.target.value) })
                  }
                />
              </div>
              <PracticalText
                label={tr('exam.stem')}
                multiline
                value={draft.stem}
                maxLength={2000}
                onChange={(stem) => setDraft({ ...draft, stem })}
              />
              {!['blank', 'boolean'].includes(draft.kind) && (
                <PracticalText
                  label={tr('exam.options')}
                  multiline
                  value={draft.options.join('\n')}
                  maxLength={4000}
                  onChange={(value) =>
                    setDraft({ ...draft, options: value.split('\n') })
                  }
                />
              )}
              <PracticalText
                label={tr(
                  draft.kind === 'blank' ? 'exam.alternatives' : 'exam.correct',
                )}
                multiline
                value={draft.correct.join('\n')}
                maxLength={3000}
                onChange={(value) =>
                  setDraft({ ...draft, correct: value.split('\n') })
                }
              />
              <PracticalText
                label={tr('exam.explanation')}
                multiline
                value={draft.explanation}
                maxLength={2000}
                onChange={(explanation) => setDraft({ ...draft, explanation })}
              />
              <Button
                onClick={() => {
                  const item = {
                    ...draft,
                    stem: draft.stem.trim(),
                    options: draft.options.map((s) => s.trim()).filter(Boolean),
                    correct: draft.correct.map((s) => s.trim()).filter(Boolean),
                  };
                  const next = store.data.some((q) => q.id === item.id)
                    ? store.data.map((q) => (q.id === item.id ? item : q))
                    : [...store.data, item];
                  if (!validQuestions(next)) {
                    setError('questionInvalid');
                    return;
                  }
                  if (store.setData(next)) {
                    setDraft(null);
                    setError(null);
                  }
                }}
              >
                {tr('save')}
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                {tr('cancel')}
              </Button>
            </section>
          )}
          {store.data.map((item) => (
            <article key={item.id} className="space-y-2 rounded border p-3">
              <h2 className="whitespace-pre-wrap break-words font-semibold">
                {item.stem}
              </h2>
              <p>
                {tr(`exam.${item.kind}`)} · {item.category || '—'} ·{' '}
                {item.points} {tr('exam.points')}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDraft(item)}
              >
                {tr('edit')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  store.setData((d) => d.filter((q) => q.id !== item.id))
                }
              >
                {tr('delete')}
              </Button>
            </article>
          ))}
        </>
      ) : (
        <>
          <div className="grid items-end gap-3 md:grid-cols-3">
            <ChoiceField
              label={tr('category')}
              value={category || '__all'}
              options={[
                { value: '__all', label: tr('all') },
                ...categories.map((value) => ({ value, label: value })),
              ]}
              onChange={(value) =>
                setQ({ category: value === '__all' ? '' : value })
              }
            />
            <OrganizerInput
              label={tr('exam.count')}
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setQ({ count: Number(e.target.value) })}
            />
            <Button
              onClick={() => {
                try {
                  setPaper(drawQuestions(store.data, category, count));
                  setAnswers({});
                  setScore(null);
                  setError(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {tr('exam.draw')}
            </Button>
          </div>
          {paper.map((item, index) => (
            <fieldset
              key={item.id}
              className="min-w-0 space-y-3 break-words rounded border p-4"
            >
              <legend className="break-words font-semibold">
                {index + 1}. {item.stem} ({item.points})
              </legend>
              {item.kind === 'blank' ? (
                <OrganizerInput
                  label={tr('exam.answer')}
                  value={answers[item.id]?.[0] ?? ''}
                  maxLength={300}
                  onChange={(e) => {
                    setAnswers({ ...answers, [item.id]: [e.target.value] });
                    setScore(null);
                  }}
                />
              ) : (
                <div className="space-y-2">
                  {item.options.map((option) => (
                    <label key={option} className="flex items-center gap-2">
                      <Checkbox
                        checked={answers[item.id]?.includes(option) ?? false}
                        onCheckedChange={(checked) => {
                          setAnswers({
                            ...answers,
                            [item.id]:
                              item.kind === 'multiple'
                                ? checked
                                  ? [...(answers[item.id] ?? []), option]
                                  : (answers[item.id] ?? []).filter(
                                      (a) => a !== option,
                                    )
                                : checked
                                  ? [option]
                                  : [],
                          });
                          setScore(null);
                        }}
                      />
                      {text(option)}
                    </label>
                  ))}
                </div>
              )}
              {score && (
                <div className="space-y-1 border-t pt-2">
                  <p>
                    {score.results[index].correct
                      ? tr('exam.right')
                      : tr('exam.wrong')}{' '}
                    · {item.correct.map(text).join(' / ')}
                  </p>
                  <p className="whitespace-pre-wrap break-words">
                    {item.explanation}
                  </p>
                </div>
              )}
            </fieldset>
          ))}
          {paper.length > 0 && (
            <>
              <Button onClick={() => setScore(scoreQuestions(paper, answers))}>
                {tr('exam.grade')}
              </Button>
              {score && (
                <p role="status" className="text-lg font-semibold">
                  {tr('exam.score')}: {score.earned} / {score.total}
                </p>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <section>
                  <h2 className="font-semibold">{tr('exam.questionsPdf')}</h2>
                  <LifePrint
                    title={tr('exam.questionsPdf')}
                    filename="questions.pdf"
                    lines={paper.map(
                      (item, i) =>
                        `${i + 1}. ${item.stem} (${item.points})\n${item.options.map((s, j) => `${String.fromCharCode(65 + j)}. ${text(s)}`).join('\n')}\n________________________`,
                    )}
                  />
                </section>
                <section>
                  <h2 className="font-semibold">{tr('exam.answersPdf')}</h2>
                  <LifePrint
                    title={tr('exam.answersPdf')}
                    filename="answers.pdf"
                    lines={paper.map(
                      (item, i) =>
                        `${i + 1}. ${item.stem}\n${item.correct.map(text).join(' / ')}\n${item.explanation}`,
                    )}
                  />
                </section>
              </div>
            </>
          )}
        </>
      )}
      <LifeError error={error} />
    </OrganizerFrame>
  );
}
