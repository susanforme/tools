import { createFileRoute } from '@tanstack/react-router';
import { HabitTracker } from '@/components/practical-organizers';
export const Route = createFileRoute('/habit-tracker')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <HabitTracker />,
});
