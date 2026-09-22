import { ChoiceField, NumberField } from '@/components/calculator-ui';
import {
  StudyImport,
  StudyPreview,
  StudyText,
} from '@/components/study-tools-ui';
import { Button } from '@/components/ui/button';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { makeLabels } from '@/lib/label-maker';
import { studyRows } from '@/lib/study-print';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/label-maker')({
  component: LabelMakerPage,
});
function LabelMakerPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    type: string;
    width: number;
    height: number;
    margin: number;
    gap: number;
    font: number;
    copies: number;
    header: string;
  }>({
    type: StringParam,
    width: NumberParam,
    height: NumberParam,
    margin: NumberParam,
    gap: NumberParam,
    font: NumberParam,
    copies: NumberParam,
    header: StringParam,
  });
  const type = ['name', 'storage', 'tent'].includes(query.type ?? '')
    ? query.type!
    : 'name';
  const options = {
    width: query.width ?? (type === 'tent' ? 90 : 60),
    height: query.height ?? (type === 'tent' ? 80 : 30),
    margin: query.margin ?? 10,
    gap: query.gap ?? 3,
    font: query.font ?? 5,
    copies: query.copies ?? 1,
    fold: type === 'tent',
  };
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const invalidate = () => {
    generation.current++;
    setImages([]);
    setBusy(false);
  };
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('labelMaker.title')}</h1>
      <StudyImport
        onText={(value) => {
          setText(value);
          invalidate();
        }}
      />
      <StudyText
        label={t('labelMaker.input')}
        value={text}
        onChange={(value) => {
          setText(value);
          invalidate();
        }}
        multiline
        maxLength={500000}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <ChoiceField
          label={t('labelMaker.type')}
          value={type}
          options={['name', 'storage', 'tent'].map((value) => ({
            value,
            label: t(`labelMaker.${value}`),
          }))}
          onChange={(value) => {
            setQuery({
              type: value,
              width: value === 'tent' ? 90 : 60,
              height: value === 'tent' ? 80 : 30,
            });
            invalidate();
          }}
        />
        {(['width', 'height', 'margin', 'gap', 'font', 'copies'] as const).map(
          (key) => (
            <NumberField
              key={key}
              label={t(`labelMaker.${key}`)}
              value={options[key]}
              onChange={(value) => {
                setQuery({ [key]: value });
                invalidate();
              }}
            />
          ),
        )}
        <ChoiceField
          label={t('studyCommon.header')}
          value={query.header ?? 'no'}
          options={['no', 'yes'].map((value) => ({
            value,
            label: t(`studyCommon.${value}`),
          }))}
          onChange={(value) => {
            setQuery({ header: value });
            invalidate();
          }}
        />
      </div>
      <Button
        disabled={busy}
        onClick={async () => {
          const id = ++generation.current;
          setBusy(true);
          setError(null);
          try {
            const rows = await studyRows(text);
            if (id !== generation.current) return;
            const labels = (query.header === 'yes' ? rows.slice(1) : rows)
              .map((row) => row.filter(Boolean).join('\n'))
              .filter(Boolean);
            setImages(makeLabels(labels, options));
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
        {t('studyCommon.generate')}
      </Button>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <StudyPreview images={images} filename="labels-A4.pdf" />
    </div>
  );
}
