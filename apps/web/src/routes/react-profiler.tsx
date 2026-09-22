import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import PerformanceImportPanel from '../components/performance-import-panel';
export const Route = createFileRoute('/react-profiler')({ component: Page });
function Page() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">
        {t('performanceImport.reactTitle')}
      </h1>
      <PerformanceImportPanel kind="react" />
    </div>
  );
}
