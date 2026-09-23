import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
export function ScienceResultFrame({
  title,
  children,
  error,
}: {
  title: string;
  children: ReactNode;
  error?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t(`scienceExpansion.${title}`)}</h1>
      {children}
      {error && (
        <p
          role="alert"
          className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {t('scienceExpansion.error', {
            message: t(`scienceExpansion.${error}`, { defaultValue: error }),
          })}
        </p>
      )}
    </div>
  );
}
