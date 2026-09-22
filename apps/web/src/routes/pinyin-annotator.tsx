import { ChoiceField, NumberField } from '@/components/calculator-ui';
import { StudyPreview, StudyText } from '@/components/study-tools-ui';
import { Button } from '@/components/ui/button';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  annotatePinyin,
  pinyinSheets,
  type AnnotatedCharacter,
} from '@/lib/pinyin-annotator';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/pinyin-annotator')({
  component: PinyinAnnotatorPage,
});
function PinyinAnnotatorPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    mode: string;
    size: number;
    spacing: number;
  }>({ mode: StringParam, size: NumberParam, spacing: NumberParam });
  const [text, setText] = useState('');
  const [characters, setCharacters] = useState<AnnotatedCharacter[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const size = query.size ?? 6;
  const spacing = query.spacing ?? 6;
  const mode = query.mode === 'surname' ? 'surname' : 'normal';
  const update = (reading: string) => {
    setCharacters((previous) =>
      previous.map((item, index) =>
        index === selected ? { ...item, reading } : item,
      ),
    );
    setImages([]);
  };
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('pinyinAnnotator.title')}</h1>
      <StudyText
        label={t('pinyinAnnotator.text')}
        value={text}
        maxLength={6000}
        multiline
        onChange={(value) => {
          generation.current++;
          setBusy(false);
          setText(value);
          setCharacters([]);
          setSelected(null);
          setImages([]);
        }}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <ChoiceField
          label={t('pinyinAnnotator.mode')}
          value={mode}
          options={['normal', 'surname'].map((value) => ({
            value,
            label: t(`pinyinAnnotator.${value}`),
          }))}
          onChange={(value) => {
            generation.current++;
            setBusy(false);
            setQuery({ mode: value });
            setCharacters([]);
            setImages([]);
            setSelected(null);
          }}
        />
        <NumberField
          label={t('pinyinAnnotator.size')}
          value={size}
          min={4}
          onChange={(value) => {
            setQuery({ size: value });
            setImages([]);
          }}
        />
        <NumberField
          label={t('pinyinAnnotator.spacing')}
          value={spacing}
          min={3}
          onChange={(value) => {
            setQuery({ spacing: value });
            setImages([]);
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={async () => {
            const id = ++generation.current;
            setBusy(true);
            setError(null);
            try {
              const next = await annotatePinyin(text, mode === 'surname');
              if (id === generation.current) {
                setCharacters(next);
                setSelected(null);
                setImages([]);
              }
            } catch (cause) {
              if (id === generation.current)
                setError(
                  t(`studyCommon.${(cause as Error).message}`, {
                    defaultValue: t('studyCommon.generateError'),
                  }),
                );
            } finally {
              if (id === generation.current) setBusy(false);
            }
          }}
        >
          {t(busy ? 'studyCommon.working' : 'pinyinAnnotator.annotate')}
        </Button>
        <Button
          variant="outline"
          disabled={!characters.length}
          onClick={() => {
            setError(null);
            try {
              setImages(
                pinyinSheets(
                  characters,
                  size,
                  spacing,
                  t('pinyinAnnotator.title'),
                ),
              );
            } catch (cause) {
              setError(
                t(`studyCommon.${(cause as Error).message}`, {
                  defaultValue: t('studyCommon.generateError'),
                }),
              );
            }
          }}
        >
          {t('studyCommon.generate')}
        </Button>
      </div>
      {characters.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {t('pinyinAnnotator.hint')}
          </p>
          <div className="max-h-96 overflow-auto rounded-lg border p-4 leading-[3.5]">
            {characters.map((item, index) =>
              item.character === '\n' ? (
                <br key={index} />
              ) : (
                <button
                  key={index}
                  className={`mx-1 rounded px-1 text-2xl hover:bg-muted focus-visible:outline-2 ${selected === index ? 'bg-primary/15' : ''}`}
                  disabled={!item.chinese}
                  onClick={() => setSelected(index)}
                  aria-label={t('pinyinAnnotator.edit', {
                    char: item.character,
                    count: index + 1,
                  })}
                >
                  <ruby>
                    {item.character}
                    <rt className="text-xs">{item.reading || ' '}</rt>
                  </ruby>
                </button>
              ),
            )}
          </div>
          {selected !== null && characters[selected] && (
            <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
              <StudyText
                label={t('pinyinAnnotator.reading', {
                  char: characters[selected]!.character,
                })}
                value={characters[selected]!.reading}
                maxLength={20}
                onChange={update}
              />
              {characters[selected]!.alternatives.length > 0 && (
                <ChoiceField
                  label={t('pinyinAnnotator.alternatives')}
                  value={characters[selected]!.reading}
                  options={[
                    ...new Set([
                      characters[selected]!.reading,
                      ...characters[selected]!.alternatives,
                    ]),
                  ]
                    .filter(Boolean)
                    .map((value) => ({ value, label: value }))}
                  onChange={update}
                />
              )}
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <StudyPreview images={images} filename="pinyin-A4.pdf" />
    </div>
  );
}
