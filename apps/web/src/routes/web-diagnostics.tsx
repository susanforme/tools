import { MultiToolWorkbench } from '@/components/multi-tool-workbench';
import { DEVELOPER_TOOLS } from '@/lib/next-developer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/web-diagnostics')({
  component: WebDiagnosticsPage,
});

function WebDiagnosticsPage() {
  const { t } = useTranslation();
  return (
    <MultiToolWorkbench
      title={t('nextTools.webTitle')}
      tools={DEVELOPER_TOOLS}
    />
  );
}
