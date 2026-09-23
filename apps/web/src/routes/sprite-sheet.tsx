import { createFileRoute } from '@tanstack/react-router';
import { SpriteSheet } from '@/components/practical-images';
export const Route = createFileRoute('/sprite-sheet')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <SpriteSheet />,
});
