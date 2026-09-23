import { MultiToolWorkbench } from '@/components/multi-tool-workbench';
import { DATA_TOOLS } from '@/lib/next-data-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/data-prep')({ component: DataPrepPage });

function DataPrepPage() {
  const { t } = useTranslation();
  return (
    <MultiToolWorkbench title={t('nextTools.dataTitle')} tools={DATA_TOOLS} />
  );
}
