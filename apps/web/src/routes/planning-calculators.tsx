import { MultiToolWorkbench } from '@/components/multi-tool-workbench';
import { PLANNING_TOOLS } from '@/lib/next-planning-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/planning-calculators')({
  component: PlanningCalculatorsPage,
});

function PlanningCalculatorsPage() {
  const { t } = useTranslation();
  return (
    <MultiToolWorkbench
      title={t('nextTools.planningTitle')}
      tools={PLANNING_TOOLS}
    />
  );
}
