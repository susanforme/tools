import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { ChoiceField } from './calculator-ui';
export function DocumentSection({
  base,
  extra,
  name,
  original,
}: {
  base: ReactNode;
  extra: ReactNode;
  name: string;
  original: string;
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
          label={t('documentWorkspaces.section')}
          value={section === 'extra' ? 'extra' : 'original'}
          options={[
            {
              value: 'original',
              label: t(original, { defaultValue: original }),
            },
            { value: 'extra', label: t(`documentWorkspaces.${name}`) },
          ]}
          onChange={setSection}
        />
      </div>
      {section === 'extra' ? (
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
          <h1 className="text-2xl font-bold">{t(`documentWorkspaces.${name}`)}</h1>
          {extra}
        </div>
      ) : (
        base
      )}
    </>
  );
}
export function DocumentError({ error }: { error: string | null }) {
  const { t } = useTranslation();
  return error ? (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      {t('documentWorkspaces.error')}{' '}
      {error.startsWith('variable:')
        ? error.slice(9)
        : t(`documentWorkspaces.errors.${error}`, {
            defaultValue: t('documentWorkspaces.errors.invalid'),
          })}
    </p>
  ) : null;
}
