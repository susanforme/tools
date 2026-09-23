import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
export function ScienceFrame({
  tool,
  children,
  error,
}: {
  tool: string;
  children: ReactNode;
  error?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">
        {t(`scienceTools.tools.${tool}.title`)}
      </h1>
      {children}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {t('scienceTools.error', {
            message: t(`scienceTools.${error}`, { defaultValue: error }),
          })}
        </p>
      )}
    </div>
  );
}
