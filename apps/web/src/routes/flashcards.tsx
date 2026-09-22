import { ChoiceField } from '@/components/calculator-ui';
import { StudyImport, StudyText } from '@/components/study-tools-ui';
import { Button } from '@/components/ui/button';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import {
  clozeQuestion,
  importFlashcards,
  rateFlashcard,
  validateFlashData,
  type FlashData,
} from '@/lib/flashcards';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/flashcards')({
  component: FlashcardsPage,
});
const KEY = 'tools-flashcards-v1';
function FlashcardsPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{ mode: string; header: string }>({
    mode: StringParam,
    header: StringParam,
  });
  const mode = query.mode === 'all' ? 'all' : 'due';
  const [data, setData] = useState<FlashData>({ version: 1, decks: [] });
  const dirty = useRef(false);
  const generation = useRef(0);
  const latestData = useRef(data);
  latestData.current = data;
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const [active, setActive] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{
    id: string;
    front: string;
    back: string;
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = validateFlashData(JSON.parse(raw));
        setData(saved);
        setActive(saved.decks[0]?.id ?? null);
      }
    } catch {
      setError(t('studyCommon.storageError'));
    }
  }, []);
  useEffect(() => {
    if (!dirty.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      setError(t('studyCommon.storageError'));
    }
  }, [data]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const deck =
    data.decks.find((item) => item.id === active) ?? data.decks[0] ?? null;
  const cards =
    deck?.cards.filter((card) => mode === 'all' || card.due <= now) ?? [];
  const card = cards[mode === 'due' ? 0 : index] ?? null;
  const dueCount = deck?.cards.filter((item) => item.due <= now).length ?? 0;
  const nextDue =
    deck?.cards
      .filter((item) => item.due > now)
      .reduce((nearest, item) => Math.min(nearest, item.due), Infinity) ??
    Infinity;
  const invalidateImport = () => {
    generation.current++;
    setBusy(false);
  };
  useEffect(() => {
    setRevealed(false);
  }, [card?.id]);
  const reset = () => {
    setRevealed(false);
    setIndex(0);
    setEditing(null);
  };
  const saveData = (next: FlashData) => {
    try {
      const valid = validateFlashData(next);
      dirty.current = true;
      setData(valid);
      setError(null);
    } catch {
      setError(t('studyCommon.backupError'));
    }
  };
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('flashcards.title')}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <StudyText
          label={t('flashcards.deckName')}
          value={name}
          onChange={(value) => {
            invalidateImport();
            setName(value);
          }}
          maxLength={100}
        />
        <ChoiceField
          label={t('studyCommon.header')}
          value={query.header ?? 'no'}
          options={['no', 'yes'].map((value) => ({
            value,
            label: t(`studyCommon.${value}`),
          }))}
          onChange={(value) => {
            invalidateImport();
            setQuery({ header: value });
          }}
        />
      </div>
      <StudyImport
        onText={(value) => {
          invalidateImport();
          setSource(value);
        }}
      />
      <StudyText
        label={t('flashcards.importText')}
        value={source}
        onChange={(value) => {
          invalidateImport();
          setSource(value);
        }}
        maxLength={500000}
        multiline
      />
      <p className="text-sm text-muted-foreground">
        {t('flashcards.clozeHelp')} <code>{'{{Paris}}'}</code>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !name.trim()}
          onClick={async () => {
            const request = ++generation.current;
            setBusy(true);
            setError(null);
            try {
              const cards = await importFlashcards(
                source,
                query.header === 'yes',
              );
              if (request !== generation.current) return;
              const id = crypto.randomUUID();
              const next = validateFlashData({
                ...latestData.current,
                decks: [
                  ...latestData.current.decks,
                  { id, name: name.trim(), cards },
                ],
              });
              dirty.current = true;
              setData(next);
              setActive(id);
              setName('');
              setSource('');
              reset();
            } catch (cause) {
              if (request === generation.current)
                setError(
                  t(`studyCommon.${(cause as Error).message}`, {
                    defaultValue: t('studyCommon.importError'),
                  }),
                );
            } finally {
              if (request === generation.current) setBusy(false);
            }
          }}
        >
          {t('flashcards.create')}
        </Button>
        <Button
          variant="outline"
          disabled={!data.decks.length}
          onClick={() =>
            downloadBlob(
              new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json',
              }),
              'flashcards-backup.json',
            )
          }
        >
          {t('studyCommon.backup')}
        </Button>
      </div>
      <StudyImport
        json
        onText={(text) => {
          try {
            const backup = validateFlashData(JSON.parse(text));
            const merged = validateFlashData({
              version: 1,
              decks: [
                ...latestData.current.decks,
                ...backup.decks.map((item) => ({
                  ...item,
                  id: crypto.randomUUID(),
                })),
              ],
            });
            invalidateImport();
            dirty.current = true;
            setData(merged);
            reset();
            setError(null);
          } catch {
            setError(t('studyCommon.backupError'));
          }
        }}
      />
      {data.decks.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceField
              label={t('flashcards.deck')}
              value={deck?.id ?? ''}
              options={data.decks.map((item) => ({
                value: item.id,
                label: `${item.name} (${item.cards.length})`,
              }))}
              onChange={(value) => {
                setActive(value);
                reset();
              }}
            />
            <ChoiceField
              label={t('flashcards.mode')}
              value={mode}
              options={['due', 'all'].map((value) => ({
                value,
                label: t(`flashcards.${value}`),
              }))}
              onChange={(value) => {
                setQuery({ mode: value });
                reset();
              }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('flashcards.stats', {
              total: deck?.cards.length ?? 0,
              due: dueCount,
            })}
            {Number.isFinite(nextDue)
              ? ` · ${t('flashcards.nextDue')} ${new Date(nextDue).toLocaleString()}`
              : ''}
          </p>
          {card ? (
            <section className="space-y-4 rounded-xl border p-6">
              <p className="text-xs text-muted-foreground">
                {t('flashcards.reviews', { count: card.reviews })}
              </p>
              <button
                className="min-h-40 w-full whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-5 text-left text-xl focus-visible:outline-2"
                onClick={() => setRevealed((value) => !value)}
                aria-label={t('flashcards.flip')}
              >
                <span>{clozeQuestion(card.front)}</span>
                {revealed && (
                  <span className="mt-5 block border-t pt-5 text-primary">
                    {card.back}
                  </span>
                )}
              </button>
              <Button
                variant="outline"
                onClick={() => setRevealed((value) => !value)}
              >
                {t(revealed ? 'flashcards.hide' : 'flashcards.show')}
              </Button>
              <div className="flex flex-wrap gap-2">
                {(['again', 'hard', 'good', 'easy'] as const).map((grade) => (
                  <Button
                    key={grade}
                    variant={grade === 'good' ? 'default' : 'outline'}
                    disabled={!revealed || busy}
                    onClick={() => {
                      if (!deck) return;
                      const now = Date.now();
                      saveData({
                        ...data,
                        decks: data.decks.map((item) =>
                          item.id === deck.id
                            ? {
                                ...item,
                                cards: item.cards.map((value) =>
                                  value.id === card.id
                                    ? rateFlashcard(value, grade, now)
                                    : value,
                                ),
                              }
                            : item,
                        ),
                      });
                      setNow(now);
                      setRevealed(false);
                      if (mode === 'all') setIndex((value) => value + 1);
                    }}
                  >
                    {t(`flashcards.${grade}`)}
                  </Button>
                ))}
              </div>
            </section>
          ) : (
            <div className="rounded-lg border p-5">
              <p role="status">{t('flashcards.finished')}</p>
              {mode === 'all' && (
                <Button className="mt-3" variant="outline" onClick={reset}>
                  {t('flashcards.restart')}
                </Button>
              )}
            </div>
          )}
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">
              {t('flashcards.manage')}
            </summary>
            <div className="mt-3 space-y-2">
              {deck?.cards.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded border p-2"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {clozeQuestion(item.front)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditing({
                        id: item.id,
                        front: item.front,
                        back: item.back,
                      })
                    }
                  >
                    {t('studyCommon.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      saveData({
                        ...data,
                        decks: data.decks.map((value) =>
                          value.id === deck.id
                            ? {
                                ...value,
                                cards: value.cards.filter(
                                  (c) => c.id !== item.id,
                                ),
                              }
                            : value,
                        ),
                      });
                      reset();
                    }}
                  >
                    {t('studyCommon.remove')}
                  </Button>
                </div>
              ))}
            </div>
          </details>
          {editing && deck && (
            <section className="space-y-3 rounded-lg border p-4">
              <StudyText
                label={t('flashcards.front')}
                value={editing.front}
                maxLength={2000}
                multiline
                onChange={(value) => setEditing({ ...editing, front: value })}
              />
              <StudyText
                label={t('flashcards.back')}
                value={editing.back}
                maxLength={2000}
                multiline
                onChange={(value) => setEditing({ ...editing, back: value })}
              />
              <Button
                disabled={!editing.front.trim() || !editing.back.trim()}
                onClick={() => {
                  saveData({
                    ...data,
                    decks: data.decks.map((item) =>
                      item.id === deck.id
                        ? {
                            ...item,
                            cards: item.cards.map((value) =>
                              value.id === editing.id
                                ? {
                                    ...value,
                                    front: editing.front.trim(),
                                    back: editing.back.trim(),
                                  }
                                : value,
                            ),
                          }
                        : item,
                    ),
                  });
                  reset();
                }}
              >
                {t('studyCommon.save')}
              </Button>
            </section>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
