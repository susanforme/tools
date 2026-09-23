import { createFileRoute } from '@tanstack/react-router';
import { ResistorCode } from '@/components/practical-calculators';
export const Route = createFileRoute('/resistor-code')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <ResistorCode />,
});
