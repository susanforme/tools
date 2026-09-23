import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { ChoiceField } from './calculator-ui';
export function VisualSection({
  base,
  extra,
  original,
  title,
}: {
  base: ReactNode;
  extra: ReactNode;
  original: string;
  title: string;
}) {
  const { t } = useTranslation();
  const [section, setSection] = useQueryParam<string>(
    'section',
    StringParam,
    'original',
  );
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-5">
        <ChoiceField
          label={t('visualDesign.mode')}
          value={section === 'extra' ? 'extra' : 'original'}
          options={[
            {
              value: 'original',
              label: t(original, { defaultValue: original }),
            },
            { value: 'extra', label: t(`visualDesign.${title}`) },
          ]}
          onChange={setSection}
        />
      </div>
      {section === 'extra' ? (
        <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
          <h1 className="text-2xl font-bold">{t(`visualDesign.${title}`)}</h1>
          {extra}
        </main>
      ) : (
        base
      )}
    </>
  );
}
export function VisualError({ error }: { error: string | null }) {
  const { t } = useTranslation();
  return error ? (
    <p
      role="alert"
      className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      {t('visualDesign.error', {
        message: t(`visualDesign.errors.${error}`, {
          defaultValue: t('visualDesign.errors.invalid'),
        }),
      })}
    </p>
  ) : null;
}
