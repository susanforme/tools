import { createFileRoute } from '@tanstack/react-router';
import { PuzzleBook } from '@/components/puzzle-book-workspace';
export const Route = createFileRoute('/word-search')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <PuzzleBook />,
});
