import { createFileRoute } from '@tanstack/react-router';
import { PuzzleBook } from '@/components/batch4-puzzles';
export const Route = createFileRoute('/word-search')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <PuzzleBook />,
});
