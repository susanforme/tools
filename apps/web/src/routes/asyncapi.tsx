import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import SchemaWorkbenchPanel from '../components/schema-workbench-panel';
export const Route = createFileRoute('/asyncapi')({ component: AsyncApiPage });
function AsyncApiPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">
        {t('communitySchema.asyncapiTitle')}
      </h1>
      <SchemaWorkbenchPanel kind="asyncapi" />
    </div>
  );
}
