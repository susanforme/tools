import { MultiToolWorkbench } from '@/components/multi-tool-workbench';
import { MEDIA_AUDITS } from '@/lib/media-audits';
import { MEDIA_TOOLS } from '@/lib/next-media-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/media-finishing')({
  component: MediaFinishingPage,
});

function MediaFinishingPage() {
  const { t } = useTranslation();
  return (
    <MultiToolWorkbench
      title={t('nextTools.mediaTitle')}
      tools={[...MEDIA_TOOLS, ...MEDIA_AUDITS]}
    />
  );
}
