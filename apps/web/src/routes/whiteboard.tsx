import { createFileRoute } from '@tanstack/react-router';
import { Whiteboard } from '@/components/practical-whiteboard';
export const Route = createFileRoute('/whiteboard')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <Whiteboard />,
});
