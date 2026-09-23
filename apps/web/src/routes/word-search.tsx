import { createFileRoute } from '@tanstack/react-router';
import { PracticalPuzzles } from '@/components/practical-puzzles';
export const Route = createFileRoute('/word-search')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <PracticalPuzzles kind="word-search" />,
});
