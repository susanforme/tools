import { createFileRoute } from '@tanstack/react-router';
import { ChessClock } from '@/components/practical-calculators';
export const Route = createFileRoute('/chess-clock')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <ChessClock />,
});
