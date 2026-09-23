import { createFileRoute } from '@tanstack/react-router';
import { MindMap } from '@/components/practical-outlines';
export const Route = createFileRoute('/mind-map')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <MindMap />,
});
