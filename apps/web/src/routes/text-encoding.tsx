import { createFileRoute } from '@tanstack/react-router';
import { PracticalFileTools } from '@/components/practical-file-tools';
export const Route = createFileRoute('/text-encoding')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <PracticalFileTools kind="text-encoding" />,
});
