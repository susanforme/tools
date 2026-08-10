import { TraceContextPanel } from '@/components/protocol-tool-panels';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/trace-context')({
  component: TraceContextPage,
});

function TraceContextPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('protocol.trace.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('protocol.trace.description')}
        </p>
      </div>
      <TraceContextPanel />
    </div>
  );
}
