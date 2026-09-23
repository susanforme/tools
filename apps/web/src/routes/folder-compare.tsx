import { createFileRoute } from '@tanstack/react-router';
import { PracticalFileTools } from '@/components/practical-file-tools';
export const Route = createFileRoute('/folder-compare')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <PracticalFileTools kind="folder-compare" />,
});
