import { createFileRoute } from '@tanstack/react-router';
import { ClipPathEditor } from '@/components/practical-images';
export const Route = createFileRoute('/clip-path-editor')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <ClipPathEditor />,
});
