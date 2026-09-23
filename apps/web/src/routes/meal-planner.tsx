import { createFileRoute } from '@tanstack/react-router';
import { MealPlanner } from '@/components/practical-organizers';
export const Route = createFileRoute('/meal-planner')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <MealPlanner />,
});
