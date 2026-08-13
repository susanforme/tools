import { StreamingManifestPanel } from '@/components/tool-expansion-panels';
import { Card, CardContent } from '@/components/ui/card';
import { createFileRoute } from '@tanstack/react-router';
import { ListOrdered } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/streaming-manifest')({
  component: StreamingManifestPage,
});

function StreamingManifestPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ListOrdered className="size-6 text-orange-500" />
          {t('streamingManifest.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('streamingManifest.description')}
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <StreamingManifestPanel />
        </CardContent>
      </Card>
    </div>
  );
}
